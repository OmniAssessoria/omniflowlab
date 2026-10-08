-- Mantém closer_pedidos.updated_at como "última alteração" real
-- também quando itens ou documentos vinculados mudam.

create or replace function public.closer_touch_order_from_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido_id uuid;
begin
  v_pedido_id := coalesce(new.pedido_id, old.pedido_id);

  update public.closer_pedidos
  set updated_at = now()
  where id = v_pedido_id;

  return coalesce(new, old);
end;
$$;

revoke all on function public.closer_touch_order_from_child() from public, anon, authenticated;

drop trigger if exists trg_closer_item_touch_order on public.closer_pedido_itens;
create trigger trg_closer_item_touch_order
after insert or update or delete on public.closer_pedido_itens
for each row execute function public.closer_touch_order_from_child();

drop trigger if exists trg_closer_document_touch_order on public.closer_pedido_documentos;
create trigger trg_closer_document_touch_order
after insert or delete on public.closer_pedido_documentos
for each row execute function public.closer_touch_order_from_child();
