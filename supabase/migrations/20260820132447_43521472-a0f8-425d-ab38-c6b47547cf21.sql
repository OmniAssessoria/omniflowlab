CREATE TABLE IF NOT EXISTS public.app_settings (
  chave text PRIMARY KEY,
  valor boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings read all" ON public.app_settings;
CREATE POLICY "app_settings read all" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings admin write" ON public.app_settings;
CREATE POLICY "app_settings admin write" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, UPDATE ON public.app_settings TO authenticated;

INSERT INTO public.app_settings (chave, valor)
VALUES ('commissions_enabled', true)
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_module_enabled(_chave text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT valor FROM public.app_settings WHERE chave = _chave), true)
$$;

REVOKE ALL ON FUNCTION public.is_module_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_module_enabled(text) TO authenticated, service_role;