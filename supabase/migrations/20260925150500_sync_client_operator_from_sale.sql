
create or replace function public.sync_cliente_operadora_from_venda()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.cliente_id is null or new.operadora is null then
    return new;
  end if;

  update public.clientes c
  set operadoras = case
    when coalesce(c.operadoras, array[]::text[]) @> array[new.operadora::text]
      then coalesce(c.operadoras, array[]::text[])
    else array_append(coalesce(c.operadoras, array[]::text[]), new.operadora::text)
  end
  where c.id = new.cliente_id;

  return new;
end;
$function$;

drop trigger if exists trg_sync_cliente_operadora_from_venda on public.vendas;

create trigger trg_sync_cliente_operadora_from_venda
after insert or update of operadora, cliente_id
on public.vendas
for each row
execute function public.sync_cliente_operadora_from_venda();
