create policy closer_pedido_itens_delete
on public.closer_pedido_itens
for delete
to authenticated
using (
  exists (
    select 1
    from public.closer_pedidos p
    where p.id = closer_pedido_itens.pedido_id
      and p.produto = 'ONVOX'
      and (
        p.closer_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'admin'::public.app_role)
      )
  )
);
