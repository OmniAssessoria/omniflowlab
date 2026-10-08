-- Completa a criação por BKO/Admin: o Closer atribuído a um pedido também pode
-- atualizar os dados do cliente pela própria tela do pedido, mesmo quando esse
-- cadastro-base já existia e foi criado por outro Closer.

drop policy if exists closer_clientes_update on public.closer_clientes;
create policy closer_clientes_update
on public.closer_clientes
for update
to authenticated
using (
  (
    public.has_role((select auth.uid()), 'closer'::public.app_role)
    and (
      closer_id = (select auth.uid())
      or exists (
        select 1
        from public.closer_pedidos p
        where p.cliente_id = closer_clientes.id
          and p.closer_id = (select auth.uid())
      )
    )
  )
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
)
with check (
  (
    public.has_role((select auth.uid()), 'closer'::public.app_role)
    and (
      closer_id = (select auth.uid())
      or exists (
        select 1
        from public.closer_pedidos p
        where p.cliente_id = closer_clientes.id
          and p.closer_id = (select auth.uid())
      )
    )
  )
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
);
