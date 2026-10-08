
CREATE TABLE IF NOT EXISTS public.venda_linhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  numero TEXT,
  ddd TEXT,
  plano TEXT,
  produto TEXT,
  valor_mensal NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','renovada','cancelada','portada','concluida')),
  data_ativacao DATE,
  iccid TEXT,
  observacao TEXT,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_linhas TO authenticated;
GRANT ALL ON public.venda_linhas TO service_role;

ALTER TABLE public.venda_linhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver linhas das vendas visíveis"
  ON public.venda_linhas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_linhas.venda_id));

CREATE POLICY "Inserir linhas em vendas visíveis"
  ON public.venda_linhas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_linhas.venda_id));

CREATE POLICY "Atualizar linhas das vendas visíveis"
  ON public.venda_linhas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_linhas.venda_id));

CREATE POLICY "Excluir linhas das vendas visíveis"
  ON public.venda_linhas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_linhas.venda_id));

CREATE INDEX IF NOT EXISTS idx_venda_linhas_venda ON public.venda_linhas(venda_id, ordem);

CREATE TRIGGER trg_venda_linhas_updated
BEFORE UPDATE ON public.venda_linhas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Recalculo automático dos totais na venda
CREATE OR REPLACE FUNCTION public.recalc_venda_totais()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_total NUMERIC;
  v_qtd INT;
BEGIN
  v_id := COALESCE(NEW.venda_id, OLD.venda_id);
  SELECT
    COALESCE(SUM(valor_mensal) FILTER (WHERE status <> 'cancelada'), 0),
    COALESCE(COUNT(*) FILTER (WHERE status <> 'cancelada'), 0)
  INTO v_total, v_qtd
  FROM public.venda_linhas
  WHERE venda_id = v_id;

  UPDATE public.vendas
  SET valor = v_total,
      quantidade_linhas = v_qtd
  WHERE id = v_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_venda_totais_ins ON public.venda_linhas;
CREATE TRIGGER trg_recalc_venda_totais_ins
AFTER INSERT OR UPDATE OR DELETE ON public.venda_linhas
FOR EACH ROW EXECUTE FUNCTION public.recalc_venda_totais();
