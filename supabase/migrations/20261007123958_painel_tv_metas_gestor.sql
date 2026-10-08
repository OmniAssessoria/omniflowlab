-- Painel TV: Gestores definem as metas; telespectador apenas consome no painel.
drop policy if exists painel_tv_metas_select on public.painel_tv_metas;
create policy painel_tv_metas_select
on public.painel_tv_metas for select to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text in ('gestor','telespectador')
  )
);

drop policy if exists painel_tv_metas_admin_insert on public.painel_tv_metas;
drop policy if exists painel_tv_metas_admin_update on public.painel_tv_metas;
drop policy if exists painel_tv_metas_admin_delete on public.painel_tv_metas;

drop policy if exists painel_tv_metas_gestor_insert on public.painel_tv_metas;
create policy painel_tv_metas_gestor_insert
on public.painel_tv_metas for insert to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text = 'gestor'
  )
);

drop policy if exists painel_tv_metas_gestor_update on public.painel_tv_metas;
create policy painel_tv_metas_gestor_update
on public.painel_tv_metas for update to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text = 'gestor'
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text = 'gestor'
  )
);
