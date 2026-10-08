-- Admin e BKO podem gerenciar a relação Status Comercial x Operadora x SLA.
-- O catálogo-base continua somente leitura pela aplicação.

drop policy if exists admin_delete_status_comercial_operadoras on public.status_comercial_operadoras;
drop policy if exists admin_insert_status_comercial_operadoras on public.status_comercial_operadoras;
drop policy if exists admin_update_status_comercial_operadoras on public.status_comercial_operadoras;
drop policy if exists admin_manage_status_comercial_operadoras on public.status_comercial_operadoras;

drop policy if exists admin_bko_manage_status_comercial_operadoras on public.status_comercial_operadoras;
create policy admin_bko_manage_status_comercial_operadoras
on public.status_comercial_operadoras
for all
to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
)
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
);
