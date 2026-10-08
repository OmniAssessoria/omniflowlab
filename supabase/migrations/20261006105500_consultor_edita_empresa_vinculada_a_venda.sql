-- O consultor pode acessar/editar a empresa quando existir uma venda vinculada a ele,
-- mesmo que o consultor_id legado do cadastro do cliente ainda esteja desatualizado.

create policy "consultor visualiza empresa vinculada a venda propria"
on public.clientes
for select
to authenticated
using (
  public.has_role(auth.uid(), 'consultor'::public.app_role)
  and exists (
    select 1
    from public.vendas v
    where v.cliente_id = clientes.id
      and v.consultor_id = auth.uid()
      and v.deleted_at is null
      and coalesce(v.is_deleted, false) = false
  )
);

create policy "consultor edita empresa vinculada a venda propria"
on public.clientes
for update
to authenticated
using (
  public.has_role(auth.uid(), 'consultor'::public.app_role)
  and exists (
    select 1
    from public.vendas v
    where v.cliente_id = clientes.id
      and v.consultor_id = auth.uid()
      and v.deleted_at is null
      and coalesce(v.is_deleted, false) = false
  )
)
with check (
  public.has_role(auth.uid(), 'consultor'::public.app_role)
  and exists (
    select 1
    from public.vendas v
    where v.cliente_id = clientes.id
      and v.consultor_id = auth.uid()
      and v.deleted_at is null
      and coalesce(v.is_deleted, false) = false
  )
);
