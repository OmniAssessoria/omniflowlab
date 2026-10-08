DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated;', r.proname, r.args);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

DROP POLICY IF EXISTS "Inserir versões de nota" ON public.venda_nota_versoes;
CREATE POLICY "Inserir versões de nota" ON public.venda_nota_versoes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_nota_versoes.venda_id)
  );
