
-- 1) METAS
CREATE TABLE IF NOT EXISTS public.metas_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  mes_ref INT NOT NULL,
  ano_ref INT NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  valor_meta NUMERIC(14,2) NOT NULL DEFAULT 0,
  consultor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operadora TEXT,
  produto TEXT,
  status TEXT NOT NULL DEFAULT 'em_andamento', -- em_andamento | batida | nao_batida | encerrada | cancelada
  valor_vendido NUMERIC(14,2) NOT NULL DEFAULT 0,
  batida_em TIMESTAMPTZ,
  observacao TEXT,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.metas_mensais TO authenticated;
GRANT ALL ON public.metas_mensais TO service_role;

ALTER TABLE public.metas_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metas admin/gestor manage" ON public.metas_mensais
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

CREATE POLICY "metas consultor read own" ON public.metas_mensais
  FOR SELECT TO authenticated
  USING (consultor_id = auth.uid());

CREATE TRIGGER trg_metas_updated_at BEFORE UPDATE ON public.metas_mensais
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_metas_consultor_periodo ON public.metas_mensais(consultor_id, data_inicio, data_fim);

-- 2) meta_id em comissao_itens
ALTER TABLE public.comissao_itens ADD COLUMN IF NOT EXISTS meta_id UUID REFERENCES public.metas_mensais(id) ON DELETE SET NULL;

-- 3) Função: encontra meta aplicável (consultor + data)
CREATE OR REPLACE FUNCTION public.find_meta_for_venda(_consultor UUID, _data DATE, _operadora TEXT, _produto TEXT)
RETURNS public.metas_mensais
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT * FROM public.metas_mensais
  WHERE consultor_id = _consultor
    AND status NOT IN ('cancelada','encerrada')
    AND _data BETWEEN data_inicio AND data_fim
    AND (operadora IS NULL OR operadora = _operadora)
    AND (produto IS NULL OR produto = _produto)
  ORDER BY (operadora IS NOT NULL) DESC, (produto IS NOT NULL) DESC, created_at DESC
  LIMIT 1;
$$;

-- 4) Reescreve calc_comissao_venda para regra fixa 10%/20%
CREATE OR REPLACE FUNCTION public.calc_comissao_venda(_venda_id UUID)
RETURNS TABLE(percentual NUMERIC, bonus NUMERIC, valor NUMERIC, regra_id UUID)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_consultor UUID; v_operadora TEXT; v_valor NUMERIC; v_produto TEXT;
  v_data DATE; m public.metas_mensais; pct NUMERIC := 10;
BEGIN
  SELECT consultor_id, operadora::text, COALESCE(valor,0), produto, COALESCE(data_ativacao::date, CURRENT_DATE)
    INTO v_consultor, v_operadora, v_valor, v_produto, v_data
  FROM public.vendas WHERE id = _venda_id;

  IF v_consultor IS NULL THEN
    percentual := 10; bonus := 0; valor := ROUND(v_valor*0.10,2); regra_id := NULL; RETURN NEXT; RETURN;
  END IF;

  m := public.find_meta_for_venda(v_consultor, v_data, v_operadora, v_produto);
  IF m.id IS NOT NULL AND m.status = 'batida' THEN pct := 20; END IF;

  percentual := pct;
  bonus := 0;
  valor := ROUND(v_valor * pct / 100.0, 2);
  regra_id := NULL;
  RETURN NEXT;
END;$$;

-- 5) Recalcula uma meta específica (soma vendas ativadas do consultor no período) e re-aplica em comissões pendentes
CREATE OR REPLACE FUNCTION public.recalc_meta(_meta_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  m public.metas_mensais; total NUMERIC; novo_status TEXT; foi_batida BOOLEAN := false;
BEGIN
  SELECT * INTO m FROM public.metas_mensais WHERE id = _meta_id;
  IF m.id IS NULL OR m.status IN ('cancelada','encerrada') THEN RETURN; END IF;

  SELECT COALESCE(SUM(COALESCE(v.valor,0)),0) INTO total
  FROM public.vendas v
  WHERE v.consultor_id = m.consultor_id
    AND v.status_pedido = 'ativado'
    AND COALESCE(v.data_ativacao::date, v.created_at::date) BETWEEN m.data_inicio AND m.data_fim
    AND (m.operadora IS NULL OR v.operadora::text = m.operadora)
    AND (m.produto IS NULL OR v.produto = m.produto);

  IF total >= m.valor_meta AND m.valor_meta > 0 THEN
    novo_status := 'batida';
    foi_batida := (m.status <> 'batida');
  ELSIF CURRENT_DATE > m.data_fim THEN
    novo_status := 'nao_batida';
  ELSE
    novo_status := 'em_andamento';
  END IF;

  UPDATE public.metas_mensais
    SET valor_vendido = total,
        status = novo_status,
        batida_em = CASE WHEN novo_status='batida' AND batida_em IS NULL THEN now() ELSE batida_em END
    WHERE id = m.id;

  -- Re-aplica pct em comissões pendentes (não confirmadas/pagas) desse consultor no período
  UPDATE public.comissao_itens ci
    SET percentual_aplicado = CASE WHEN novo_status='batida' THEN 20 ELSE 10 END,
        valor_comissao = ROUND(COALESCE(ci.base_calculo,0) * CASE WHEN novo_status='batida' THEN 0.20 ELSE 0.10 END, 2),
        meta_id = m.id,
        sem_regra = false,
        status = CASE WHEN ci.status = 'pendente_regra' THEN 'pendente_confirmacao'::public.comissao_status_enum ELSE ci.status END,
        updated_at = now()
    FROM public.vendas v
    WHERE ci.venda_id = v.id
      AND v.consultor_id = m.consultor_id
      AND ci.status IN ('pendente_regra','pendente_confirmacao')
      AND COALESCE(v.data_ativacao::date, v.created_at::date) BETWEEN m.data_inicio AND m.data_fim
      AND (m.operadora IS NULL OR v.operadora::text = m.operadora)
      AND (m.produto IS NULL OR v.produto = m.produto);

  IF foi_batida THEN
    INSERT INTO public.notificacoes(user_id, tipo, titulo, descricao, criticidade, link)
    VALUES (m.consultor_id, 'meta_batida', 'Meta batida: ' || m.nome,
      'Comissões do período dobradas para 20%.', 'alta', '/comissoes');
  END IF;
END;$$;

-- 6) Recalcula todas as metas relevantes de uma venda
CREATE OR REPLACE FUNCTION public.recalc_metas_da_venda(_venda_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r RECORD; v RECORD;
BEGIN
  SELECT consultor_id, operadora::text AS operadora, produto,
         COALESCE(data_ativacao::date, created_at::date) AS d
    INTO v FROM public.vendas WHERE id = _venda_id;
  IF v.consultor_id IS NULL THEN RETURN; END IF;

  FOR r IN
    SELECT id FROM public.metas_mensais
    WHERE consultor_id = v.consultor_id
      AND status NOT IN ('cancelada','encerrada')
      AND v.d BETWEEN data_inicio AND data_fim
      AND (operadora IS NULL OR operadora = v.operadora)
      AND (produto IS NULL OR produto = v.produto)
  LOOP
    PERFORM public.recalc_meta(r.id);
  END LOOP;
END;$$;

-- 7) Substitui gera_comissao_on_ativado (10%/20% + vincula meta)
CREATE OR REPLACE FUNCTION public.gera_comissao_on_ativado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  c RECORD; f_id UUID; existing_id UUID; _ano INT; _mes INT;
  v_user UUID := auth.uid(); v_nome TEXT; m public.metas_mensais;
BEGIN
  IF NEW.status_pedido IS DISTINCT FROM OLD.status_pedido AND NEW.status_pedido = 'ativado' THEN
    SELECT id INTO existing_id FROM public.comissao_itens WHERE venda_id = NEW.id;
    IF existing_id IS NULL THEN
      SELECT * FROM public.calc_comissao_venda(NEW.id) INTO c;
      _ano := EXTRACT(YEAR FROM now())::int;
      _mes := EXTRACT(MONTH FROM now())::int;
      SELECT id INTO f_id FROM public.comissao_fechamentos WHERE ano = _ano AND mes = _mes AND status = 'aberto';
      IF f_id IS NULL THEN
        INSERT INTO public.comissao_fechamentos(ano, mes) VALUES (_ano, _mes) RETURNING id INTO f_id;
      END IF;

      m := public.find_meta_for_venda(NEW.consultor_id,
             COALESCE(NEW.data_ativacao::date, CURRENT_DATE),
             NEW.operadora::text, NEW.produto);

      INSERT INTO public.comissao_itens(
        fechamento_id, venda_id, consultor_id, operadora, produto, tipo_pedido,
        base_calculo, percentual_aplicado, bonus_fixo, valor_comissao, regra_id,
        status, sem_regra, data_ativacao_100, meta_id
      ) VALUES (
        f_id, NEW.id, NEW.consultor_id, NEW.operadora, NEW.produto, NEW.tipo_pedido,
        COALESCE(NEW.valor,0), COALESCE(c.percentual,10), 0, COALESCE(c.valor,0), NULL,
        'pendente_confirmacao'::public.comissao_status_enum, false, now(), m.id
      );

      SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = COALESCE(NEW.consultor_id, v_user);
      INSERT INTO public.venda_historico (venda_id, tipo, descricao, user_id, user_nome)
      VALUES (NEW.id, 'observacao',
        'Comissão gerada — Ativado 100% — ' || COALESCE(c.percentual,10)::text || '% — R$ ' ||
        to_char(COALESCE(c.valor,0),'FM999G999G990D00') ||
        CASE WHEN m.id IS NOT NULL THEN ' — Meta: ' || m.nome ELSE '' END,
        v_user, v_nome);
    END IF;

    PERFORM public.recalc_metas_da_venda(NEW.id);
  END IF;

  -- Se saiu de ativado, marca comissão como cancelada e recalcula meta antiga
  IF NEW.status_pedido IS DISTINCT FROM OLD.status_pedido
     AND OLD.status_pedido = 'ativado' AND NEW.status_pedido <> 'ativado' THEN
    UPDATE public.comissao_itens
      SET status = 'cancelada'::public.comissao_status_enum, updated_at = now()
      WHERE venda_id = NEW.id AND status IN ('pendente_regra','pendente_confirmacao');
    PERFORM public.recalc_metas_da_venda(NEW.id);
  END IF;

  RETURN NEW;
END;$$;

-- 8) Trigger para recalcular metas quando valor da venda ativada muda
CREATE OR REPLACE FUNCTION public.recalc_meta_on_valor_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status_pedido = 'ativado' AND (NEW.valor IS DISTINCT FROM OLD.valor OR NEW.consultor_id IS DISTINCT FROM OLD.consultor_id) THEN
    -- Atualiza base_calculo da comissão existente
    UPDATE public.comissao_itens
      SET base_calculo = COALESCE(NEW.valor,0), updated_at = now()
      WHERE venda_id = NEW.id AND status IN ('pendente_regra','pendente_confirmacao');
    PERFORM public.recalc_metas_da_venda(NEW.id);
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_recalc_meta_valor ON public.vendas;
CREATE TRIGGER trg_recalc_meta_valor AFTER UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.recalc_meta_on_valor_change();

-- 9) Trigger nas próprias metas: recalcula ao criar/editar
CREATE OR REPLACE FUNCTION public.trg_recalc_meta_self()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.recalc_meta(NEW.id);
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_meta_after_change ON public.metas_mensais;
CREATE TRIGGER trg_meta_after_change AFTER INSERT OR UPDATE OF valor_meta, data_inicio, data_fim, consultor_id, operadora, produto, status
  ON public.metas_mensais FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_meta_self();
