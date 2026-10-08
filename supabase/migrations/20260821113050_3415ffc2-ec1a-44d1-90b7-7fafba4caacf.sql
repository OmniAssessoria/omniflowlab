ALTER FUNCTION public.enforce_cliente_ownership() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.enforce_cliente_ownership() FROM PUBLIC, anon, authenticated;