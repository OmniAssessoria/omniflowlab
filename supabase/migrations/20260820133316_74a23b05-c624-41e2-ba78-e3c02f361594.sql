
-- Garante que o default seguro da flag commissions_enabled seja FALSE.
UPDATE public.app_settings 
SET valor = false 
WHERE chave = 'commissions_enabled';

-- Caso o registro tenha sido deletado ou não exista, garante que a função is_module_enabled
-- use false como fallback padrão para 'commissions_enabled' especificamente.
CREATE OR REPLACE FUNCTION public.is_module_enabled(_chave text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT valor FROM public.app_settings WHERE chave = _chave), 
    CASE WHEN _chave = 'commissions_enabled' THEN false ELSE true END
  )
$$;

REVOKE ALL ON FUNCTION public.is_module_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_module_enabled(text) TO authenticated, service_role;
