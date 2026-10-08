
-- =========================================================
-- COMISSIONAMENTO
-- =========================================================

CREATE TABLE public.comissao_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  consultor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  operadora TEXT,
  valor_min NUMERIC(14,2) DEFAULT 0,
  valor_max NUMERIC(14,2),
  percentual NUMERIC(6,3) NOT NULL DEFAULT 0,
  bonus_fixo NUMERIC(14,2) NOT NULL DEFAULT 0,
  vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissao_regras TO authenticated;
GRANT ALL ON public.comissao_regras TO service_role;
ALTER TABLE public.comissao_regras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regras_select_all" ON public.comissao_regras FOR SELECT TO authenticated USING (true);
CREATE POLICY "regras_write_admin_gestor" ON public.comissao_regras FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE TRIGGER trg_comissao_regras_updated BEFORE UPDATE ON public.comissao_regras
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.comissao_fechamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano INT NOT NULL,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','fechado','pago')),
  total_bruto NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_comissao NUMERIC(14,2) NOT NULL DEFAULT 0,
  fechado_por UUID REFERENCES public.profiles(id),
  fechado_em TIMESTAMPTZ,
  pago_em TIMESTAMPTZ,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ano, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissao_fechamentos TO authenticated;
GRANT ALL ON public.comissao_fechamentos TO service_role;
ALTER TABLE public.comissao_fechamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fech_select_all" ON public.comissao_fechamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "fech_write_admin_gestor" ON public.comissao_fechamentos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE TRIGGER trg_comissao_fech_updated BEFORE UPDATE ON public.comissao_fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.comissao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id UUID REFERENCES public.comissao_fechamentos(id) ON DELETE CASCADE,
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  consultor_id UUID REFERENCES public.profiles(id),
  operadora TEXT,
  base_calculo NUMERIC(14,2) NOT NULL DEFAULT 0,
  percentual_aplicado NUMERIC(6,3) NOT NULL DEFAULT 0,
  bonus_fixo NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_comissao NUMERIC(14,2) NOT NULL DEFAULT 0,
  regra_id UUID REFERENCES public.comissao_regras(id),
  observacao TEXT,
  ajuste_manual NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(venda_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissao_itens TO authenticated;
GRANT ALL ON public.comissao_itens TO service_role;
ALTER TABLE public.comissao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "itens_select_admin_gestor" ON public.comissao_itens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "itens_select_consultor_self" ON public.comissao_itens FOR SELECT TO authenticated
  USING (consultor_id = auth.uid());
CREATE POLICY "itens_write_admin_gestor" ON public.comissao_itens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE TRIGGER trg_comissao_itens_updated BEFORE UPDATE ON public.comissao_itens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Função: calcula comissão para uma venda usando a regra mais específica vigente
CREATE OR REPLACE FUNCTION public.calc_comissao_venda(_venda_id UUID)
RETURNS TABLE(percentual NUMERIC, bonus NUMERIC, valor NUMERIC, regra_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v RECORD;
  r RECORD;
BEGIN
  SELECT id, consultor_id, operadora, valor FROM public.vendas WHERE id = _venda_id INTO v;
  IF v.id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO r FROM public.comissao_regras
    WHERE ativo = true
      AND CURRENT_DATE BETWEEN vigencia_inicio AND COALESCE(vigencia_fim, CURRENT_DATE)
      AND (consultor_id = v.consultor_id OR consultor_id IS NULL)
      AND (operadora = v.operadora OR operadora IS NULL)
      AND COALESCE(v.valor,0) >= COALESCE(valor_min,0)
      AND (valor_max IS NULL OR COALESCE(v.valor,0) <= valor_max)
    ORDER BY
      (consultor_id = v.consultor_id) DESC NULLS LAST,
      (operadora = v.operadora) DESC NULLS LAST,
      vigencia_inicio DESC
    LIMIT 1;

  IF r.id IS NULL THEN
    percentual := 0; bonus := 0; valor := 0; regra_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  percentual := r.percentual;
  bonus := r.bonus_fixo;
  valor := ROUND(COALESCE(v.valor,0) * r.percentual / 100.0, 2) + r.bonus_fixo;
  regra_id := r.id;
  RETURN NEXT;
END;
$$;

-- Trigger: gera/atualiza item de comissão quando venda muda para etapa concluída
CREATE OR REPLACE FUNCTION public.gera_comissao_on_concluida()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
  f_id UUID;
  _ano INT;
  _mes INT;
BEGIN
  IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id AND NEW.etapa_id ILIKE '%conclu%' THEN
    SELECT * FROM public.calc_comissao_venda(NEW.id) INTO c;
    IF c IS NULL OR COALESCE(c.valor,0) = 0 THEN
      RETURN NEW;
    END IF;

    _ano := EXTRACT(YEAR FROM now())::int;
    _mes := EXTRACT(MONTH FROM now())::int;

    SELECT id INTO f_id FROM public.comissao_fechamentos WHERE ano = _ano AND mes = _mes AND status = 'aberto';
    IF f_id IS NULL THEN
      INSERT INTO public.comissao_fechamentos(ano, mes) VALUES (_ano, _mes) RETURNING id INTO f_id;
    END IF;

    INSERT INTO public.comissao_itens(fechamento_id, venda_id, consultor_id, operadora, base_calculo, percentual_aplicado, bonus_fixo, valor_comissao, regra_id)
    VALUES (f_id, NEW.id, NEW.consultor_id, NEW.operadora, COALESCE(NEW.valor,0), c.percentual, c.bonus, c.valor, c.regra_id)
    ON CONFLICT (venda_id) DO UPDATE SET
      fechamento_id = EXCLUDED.fechamento_id,
      base_calculo = EXCLUDED.base_calculo,
      percentual_aplicado = EXCLUDED.percentual_aplicado,
      bonus_fixo = EXCLUDED.bonus_fixo,
      valor_comissao = EXCLUDED.valor_comissao,
      regra_id = EXCLUDED.regra_id,
      updated_at = now();

    UPDATE public.comissao_fechamentos SET
      total_bruto = (SELECT COALESCE(SUM(base_calculo),0) FROM public.comissao_itens WHERE fechamento_id = f_id),
      total_comissao = (SELECT COALESCE(SUM(valor_comissao + ajuste_manual),0) FROM public.comissao_itens WHERE fechamento_id = f_id)
    WHERE id = f_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_gera_comissao_concluida
  AFTER UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.gera_comissao_on_concluida();

-- =========================================================
-- PUSH SUBSCRIPTIONS
-- =========================================================

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_self" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- coluna na notificacoes pra marcar push enviado
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS push_enviado_em TIMESTAMPTZ;
