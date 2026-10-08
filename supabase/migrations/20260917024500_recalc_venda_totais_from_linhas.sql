-- Keep sale-level quantity/value in sync with the source of truth: venda_linhas.

create or replace function public.recalc_venda_totais_from_linhas(p_venda_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd integer;
  v_valor numeric;
begin
  if p_venda_id is null then
    return;
  end if;

  select
    count(*)::integer,
    coalesce(sum(coalesce(l.valor_mensal, 0)), 0)
  into v_qtd, v_valor
  from public.venda_linhas l
  where l.venda_id = p_venda_id
    and lower(trim(coalesce(l.status, ''))) not in ('cancelada', 'cancelado');

  update public.vendas
  set quantidade_linhas = coalesce(v_qtd, 0),
      valor = coalesce(v_valor, 0)
  where id = p_venda_id
    and (
      quantidade_linhas is distinct from coalesce(v_qtd, 0)
      or valor is distinct from coalesce(v_valor, 0)
    );
end;
$$;

revoke all on function public.recalc_venda_totais_from_linhas(uuid) from public, anon, authenticated;

create or replace function public.trg_recalc_venda_from_linha()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda_id uuid;
begin
  v_venda_id := case when tg_op = 'DELETE' then old.venda_id else new.venda_id end;
  perform public.recalc_venda_totais_from_linhas(v_venda_id);

  if tg_op = 'UPDATE' and old.venda_id is distinct from new.venda_id then
    perform public.recalc_venda_totais_from_linhas(old.venda_id);
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.trg_recalc_venda_from_linha() from public, anon, authenticated;

drop trigger if exists venda_linhas_00_recalc_venda on public.venda_linhas;
create trigger venda_linhas_00_recalc_venda
after insert or delete or update of venda_id, valor_mensal, status
on public.venda_linhas
for each row execute function public.trg_recalc_venda_from_linha();

-- Backfill all existing sales so every screen starts from consistent totals.
with totais as (
  select
    v.id as venda_id,
    count(l.id) filter (
      where lower(trim(coalesce(l.status, ''))) not in ('cancelada', 'cancelado')
    )::integer as qtd,
    coalesce(sum(coalesce(l.valor_mensal, 0)) filter (
      where lower(trim(coalesce(l.status, ''))) not in ('cancelada', 'cancelado')
    ), 0) as valor
  from public.vendas v
  left join public.venda_linhas l on l.venda_id = v.id
  group by v.id
)
update public.vendas v
set quantidade_linhas = t.qtd,
    valor = t.valor
from totais t
where v.id = t.venda_id
  and (
    v.quantidade_linhas is distinct from t.qtd
    or v.valor is distinct from t.valor
  );
