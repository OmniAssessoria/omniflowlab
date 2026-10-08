-- Adicionar coluna de exclusão lógica para tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- Habilitar RLS e permissões
GRANT UPDATE ON public.tickets TO authenticated;
CREATE INDEX IF NOT EXISTS idx_tickets_deleted_at ON public.tickets(deleted_at);
