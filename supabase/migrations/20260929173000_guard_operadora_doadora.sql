-- Operadora Doadora só pode existir quando o Tipo de Pedido da linha utiliza Cedente.

create or replace function public.normalizar_operadora_doadora_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_permite_doador boolean := false;
begin
  select coalesce(t.permite_doador,false)
    into v_permite_doador
  from public.tipos_pedido_catalogo t
  where t.operadora = new.operadora
    and t.ativo = true
    and lower(btrim(t.nome)) = lower(btrim(coalesce(new.tipo_produto,'')))
  limit 1;

  if not coalesce(v_permite_doador,false) then
    new.operadora_doadora := null;
  end if;

  return new;
end;
$function$;

drop trigger if exists normalizar_operadora_doadora_linha_before_write
  on public.venda_linhas;

create trigger normalizar_operadora_doadora_linha_before_write
before insert or update of operadora, tipo_produto, operadora_doadora
on public.venda_linhas
for each row execute function public.normalizar_operadora_doadora_linha();
