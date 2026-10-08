
-- 1. Atualizar ENUM funil_enum para incluir processos_bko
ALTER TYPE public.funil_enum ADD VALUE IF NOT EXISTS 'processos_bko' BEFORE 'assinatura';

-- 2. Recriar GRANTs básicos caso necessário
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_historico TO authenticated;
