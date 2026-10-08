
-- Nota do Pedido: modo auto/manual + versões
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS nota_modo TEXT NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS nota_manual TEXT,
  ADD COLUMN IF NOT EXISTS nota_atualizada_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nota_atualizada_por UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendas_nota_modo_check'
  ) THEN
    ALTER TABLE public.vendas
      ADD CONSTRAINT vendas_nota_modo_check CHECK (nota_modo IN ('auto','manual'));
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.venda_nota_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('auto','manual','snapshot')),
  conteudo TEXT NOT NULL,
  user_id UUID,
  user_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_nota_versoes TO authenticated;
GRANT ALL ON public.venda_nota_versoes TO service_role;

ALTER TABLE public.venda_nota_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver versões de notas das vendas visíveis"
  ON public.venda_nota_versoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vendas v
      WHERE v.id = venda_nota_versoes.venda_id
    )
  );

CREATE POLICY "Inserir versões de nota"
  ON public.venda_nota_versoes FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_venda_nota_versoes_venda
  ON public.venda_nota_versoes(venda_id, created_at DESC);

-- Histórico automático de mudanças na nota
CREATE OR REPLACE FUNCTION public.log_venda_nota_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
BEGIN
  SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = v_user;
  IF NEW.nota_modo IS DISTINCT FROM OLD.nota_modo THEN
    INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
    VALUES (NEW.id, 'nota', 'nota_modo', COALESCE(OLD.nota_modo,'—'), COALESCE(NEW.nota_modo,'—'),
            'Modo da nota: ' || COALESCE(OLD.nota_modo,'—') || ' → ' || COALESCE(NEW.nota_modo,'—'),
            v_user, v_nome);
  END IF;
  IF COALESCE(NEW.nota_manual,'') IS DISTINCT FROM COALESCE(OLD.nota_manual,'') THEN
    INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
    VALUES (NEW.id, 'nota', 'nota_manual', NULL, NULL,
            'Nota manual atualizada', v_user, v_nome);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_venda_nota ON public.vendas;
CREATE TRIGGER trg_log_venda_nota
AFTER UPDATE ON public.vendas
FOR EACH ROW
WHEN (OLD.nota_modo IS DISTINCT FROM NEW.nota_modo OR COALESCE(OLD.nota_manual,'') IS DISTINCT FROM COALESCE(NEW.nota_manual,''))
EXECUTE FUNCTION public.log_venda_nota_change();
