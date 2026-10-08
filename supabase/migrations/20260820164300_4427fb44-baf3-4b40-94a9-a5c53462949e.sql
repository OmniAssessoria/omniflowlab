
REVOKE EXECUTE ON FUNCTION public.delete_colaborador_transacional(uuid, text, uuid, app_role, text) FROM public, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.delete_colaborador_transacional(uuid, text, uuid, app_role, text) TO service_role;
-- O middleware requireSupabaseAuth usa o cliente autenticado, então precisamos de EXECUTE para authenticated
-- mas o RLS na função (SECURITY DEFINER) protege os dados.
GRANT EXECUTE ON FUNCTION public.delete_colaborador_transacional(uuid, text, uuid, app_role, text) TO authenticated;
