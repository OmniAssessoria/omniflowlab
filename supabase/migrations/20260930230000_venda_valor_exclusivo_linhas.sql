-- A venda não possui valor próprio: quantidade e valor são derivados exclusivamente de venda_linhas.
-- Impede importações/edições de sobrescreverem os totais consolidados.

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
    -- Uma venda nova ainda não pode ter linhas por causa da FK.
    new.quantidade_linhas := 0;
    new.valor := 0;
    return new;
  end if;

  select
    count(*)::integer,
    coalesce(sum(coalesce(l.valor_mensal, 0)), 0)
  into v_quantidade, v_valor
  from public.venda_linhas l
  where l.venda_id = new.id
    and lower(trim(coalesce(l.status, ''))) not in ('cancelada', 'cancelado');

  new.quantidade_linhas := coalesce(v_quantidade, 0);
  new.valor := coalesce(v_valor, 0);
  return new;
end;
$function$;

revoke all on function public.vendas_forcar_totais_das_linhas() from public, anon, authenticated;

drop trigger if exists vendas_00_forcar_totais_das_linhas on public.vendas;
create trigger vendas_00_forcar_totais_das_linhas
before insert or update of valor, quantidade_linhas
on public.vendas
for each row
execute function public.vendas_forcar_totais_das_linhas();

-- Corrige os registros atuais sem transformar a correção técnica em
-- "última alteração do pedido" nem poluir o histórico manual.
alter table public.vendas disable trigger vendas_touch_updated_at;
alter table public.vendas disable trigger vendas_log_historico;

with totais as (
  select
    v.id as venda_id,
    count(l.id) filter (
      where lower(trim(coalesce(l.status, ''))) not in ('cancelada', 'cancelado')
    )::integer as quantidade,
    coalesce(sum(coalesce(l.valor_mensal, 0)) filter (
      where lower(trim(coalesce(l.status, ''))) not in ('cancelada', 'cancelado')
    ), 0) as valor
  from public.vendas v
  left join public.venda_linhas l on l.venda_id = v.id
  group by v.id
)
update public.vendas v
set
  quantidade_linhas = t.quantidade,
  valor = t.valor
from totais t
where v.id = t.venda_id
  and (
    v.quantidade_linhas is distinct from t.quantidade
    or v.valor is distinct from t.valor
  );

alter table public.vendas enable trigger vendas_log_historico;
alter table public.vendas enable trigger vendas_touch_updated_at;
