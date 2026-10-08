ALTER TABLE public.comissao_itens ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.comissao_itens ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.comissao_itens ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

GRANT SELECT, UPDATE ON public.comissao_itens TO authenticated;
GRANT ALL ON public.comissao_itens TO service_role;