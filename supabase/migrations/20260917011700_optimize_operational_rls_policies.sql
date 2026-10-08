-- Evolução Operacional 2026-09-16
-- Remove sobreposição de políticas e evita reavaliar auth.uid() por linha
-- nas políticas novas do upgrade.

-- Evita política ALL sobrepor a leitura comum de Status Comercial.
drop policy if exists admin_manage_status_comercial_operadoras on public.status_comercial_operadoras;

drop policy if exists admin_insert_status_comercial_operadoras on public.status_comercial_operadoras;
create policy admin_insert_status_comercial_operadoras
on public.status_comercial_operadoras for insert to authenticated
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists admin_update_status_comercial_operadoras on public.status_comercial_operadoras;
create policy admin_update_status_comercial_operadoras
on public.status_comercial_operadoras for update to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy if exists admin_delete_status_comercial_operadoras on public.status_comercial_operadoras;
create policy admin_delete_status_comercial_operadoras
on public.status_comercial_operadoras for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role));

-- Evita reavaliar auth.uid() por linha nas políticas novas de suporte.
drop policy if exists suporte_informacoes_insert on public.suporte_informacoes;
create policy suporte_informacoes_insert
on public.suporte_informacoes for insert to authenticated
with check (
  created_by = (select auth.uid())
  and public.suporte_usuario_tem_acesso(solicitacao_id)
  and (
    (created_by_role = 'admin' and public.has_role((select auth.uid()), 'admin'::public.app_role))
    or (created_by_role = 'bko' and public.has_role((select auth.uid()), 'bko'::public.app_role))
    or (created_by_role = 'consultor' and public.has_role((select auth.uid()), 'consultor'::public.app_role))
  )
);

drop policy if exists suporte_documentos_insert on public.suporte_documentos;
create policy suporte_documentos_insert
on public.suporte_documentos for insert to authenticated
with check (
  created_by = (select auth.uid())
  and deleted_at is null
  and public.suporte_usuario_tem_acesso(solicitacao_id)
  and (
    (created_by_role = 'admin' and public.has_role((select auth.uid()), 'admin'::public.app_role))
    or (created_by_role = 'bko' and public.has_role((select auth.uid()), 'bko'::public.app_role))
    or (created_by_role = 'consultor' and public.has_role((select auth.uid()), 'consultor'::public.app_role))
  )
);
