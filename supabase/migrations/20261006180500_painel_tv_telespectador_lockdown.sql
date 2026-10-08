-- O perfil telespectador não pode acessar nem modificar tabelas operacionais.
-- Demais perfis mantêm exatamente as políticas existentes.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = true
      and c.relname not in ('profiles', 'user_roles', 'painel_tv_metas')
  loop
    execute format('drop policy if exists %I on %I.%I', 'telespectador_bloqueio_operacional', r.schema_name, r.table_name);
    execute format(
      'create policy %I on %I.%I as restrictive for all to authenticated using (not public.has_role(auth.uid(), ''telespectador''::public.app_role)) with check (not public.has_role(auth.uid(), ''telespectador''::public.app_role))',
      'telespectador_bloqueio_operacional',
      r.schema_name,
      r.table_name
    );
  end loop;
end $$;
