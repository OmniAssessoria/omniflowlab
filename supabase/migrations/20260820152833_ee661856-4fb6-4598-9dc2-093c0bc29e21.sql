-- Adicionar colunas de exclusão lógica para vendas
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS deleted_by_role public.app_role;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Adicionar colunas de exclusão lógica para clientes
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS deleted_by_role public.app_role;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Habilitar RLS e permissões
GRANT UPDATE ON public.vendas TO authenticated;
GRANT UPDATE ON public.clientes TO authenticated;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_vendas_deleted_at ON public.vendas(deleted_at);
CREATE INDEX IF NOT EXISTS idx_clientes_deleted_at ON public.clientes(deleted_at);
