ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_operadora_default_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_operadora_default_check
  CHECK (operadora_default IS NULL OR operadora_default = ANY (ARRAY['CLARO'::text, 'VIVO'::text, 'AMBAS'::text]));