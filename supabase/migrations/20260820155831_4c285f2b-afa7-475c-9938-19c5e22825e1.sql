-- Restrict EXECUTE on delete_cliente_transacional to service_role and revoke from public
REVOKE EXECUTE ON FUNCTION public.delete_cliente_transacional(UUID, TEXT, UUID, public.app_role, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_cliente_transacional(UUID, TEXT, UUID, public.app_role, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_cliente_transacional(UUID, TEXT, UUID, public.app_role, TEXT) FROM anon;

GRANT EXECUTE ON FUNCTION public.delete_cliente_transacional(UUID, TEXT, UUID, public.app_role, TEXT) TO service_role;
-- Also grant to authenticated since we call it via server function which uses authenticated client? 
-- Actually, the server function uses context.supabase which is usually the authenticated client.
-- But we want to call it securely. Let's grant to authenticated as well but the function itself validates the role inside.
GRANT EXECUTE ON FUNCTION public.delete_cliente_transacional(UUID, TEXT, UUID, public.app_role, TEXT) TO authenticated;
