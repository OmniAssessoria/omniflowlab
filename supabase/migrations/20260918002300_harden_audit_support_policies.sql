-- Endurecimento final de Auditoria/Suporte/SLA.
-- Otimiza RLS e evita políticas SELECT permissivas duplicadas.

create index if not exists idx_suporte_solicitacoes_deleted_by
  on public.suporte_solicitacoes(deleted_by)
  where deleted_by is not null;

drop policy if exists audit_select_admin_gestor on public.audit_logs;
create policy audit_select_admin_gestor
on public.audit_logs
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
);

drop policy if exists audit_insert_self on public.audit_logs;
create policy audit_insert_self
on public.audit_logs
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
);

-- A leitura já é concedida a todo usuário autenticado pela policy
-- authenticated_read_status_comercial_operadoras. Separamos apenas as escritas
-- de Admin/BKO para não duplicar a policy SELECT com um FOR ALL.
drop policy if exists admin_bko_manage_status_comercial_operadoras on public.status_comercial_operadoras;

drop policy if exists admin_bko_insert_status_comercial_operadoras on public.status_comercial_operadoras;
create policy admin_bko_insert_status_comercial_operadoras
on public.status_comercial_operadoras
for insert
to authenticated
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
);

drop policy if exists admin_bko_update_status_comercial_operadoras on public.status_comercial_operadoras;
create policy admin_bko_update_status_comercial_operadoras
on public.status_comercial_operadoras
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
)
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
);

drop policy if exists admin_bko_delete_status_comercial_operadoras on public.status_comercial_operadoras;
create policy admin_bko_delete_status_comercial_operadoras
on public.status_comercial_operadoras
for delete
to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
);
