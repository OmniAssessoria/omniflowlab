create or replace function public.recalc_venda_totais_from_linhas(p_venda_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_qtd integer;
  v_valor numeric;
begin
  if p_venda_id is null then
    return;
  end if;

  select
    count(*)::integer,
    coalesce(sum(
      case
        when lower(btrim(coalesce(l.produto, ''))) = 'aparelho' then 0
        else coalesce(l.valor_mensal, 0)
      end
    ), 0)
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
$function$;

create or replace function public.vendas_forcar_totais_das_linhas()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_quantidade integer := 0;
  v_valor numeric := 0;
begin
  if tg_op = 'INSERT' then
    new.quantidade_linhas := 0;
    new.valor := 0;
    return new;
  end if;

  select
    count(*)::integer,
    coalesce(sum(
      case
        when lower(btrim(coalesce(l.produto, ''))) = 'aparelho' then 0
        else coalesce(l.valor_mensal, 0)
      end
    ), 0)
  into v_quantidade, v_valor
  from public.venda_linhas l
  where l.venda_id = new.id
    and lower(trim(coalesce(l.status, ''))) not in ('cancelada', 'cancelado');

  new.quantidade_linhas := coalesce(v_quantidade, 0);
  new.valor := coalesce(v_valor, 0);
  return new;
end;
$function$;

drop trigger if exists venda_linhas_00_recalc_venda on public.venda_linhas;
create trigger venda_linhas_00_recalc_venda
after insert or delete or update of venda_id, valor_mensal, status, produto
on public.venda_linhas
for each row
execute function public.trg_recalc_venda_from_linha();

do $$
declare
  r record;
begin
  for r in
    select distinct l.venda_id
    from public.venda_linhas l
    where l.venda_id is not null
  loop
    perform public.recalc_venda_totais_from_linhas(r.venda_id);
  end loop;
end
$$;
