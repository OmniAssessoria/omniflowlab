-- Operação Closer: exclusão de pedido restrita ao Admin e auditoria da exclusão.

drop policy if exists closer_pedidos_delete_admin on public.closer_pedidos;

create policy closer_pedidos_delete_admin
on public.closer_pedidos
for delete
to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
);

create or replace function public.closer_auditar_exclusao_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    user_id,
    user_email,
    acao,
    descricao,
    entidade,
    entidade_id,
    valor_anterior,
    valor_novo
  )
  values (
    auth.uid(),
    auth.jwt() ->> 'email',
    'DELETE',
    format(
      'Exclusão definitiva do pedido Closer #%s (%s).',
      coalesce(old.numero::text, old.id::text),
      old.produto
    ),
    'closer_pedidos',
    old.id::text,
    to_jsonb(old),
    null
  );

  return old;
end;
$$;

revoke all on function public.closer_auditar_exclusao_pedido() from public, anon, authenticated;

drop trigger if exists trg_closer_pedido_auditar_delete on public.closer_pedidos;

create trigger trg_closer_pedido_auditar_delete
before delete on public.closer_pedidos
for each row execute function public.closer_auditar_exclusao_pedido();
