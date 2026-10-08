
-- 1) Corrige ambiguidade da coluna "valor" em calc_comissao_venda
CREATE OR REPLACE FUNCTION public.calc_comissao_venda(_venda_id uuid)
 RETURNS TABLE(percentual numeric, bonus numeric, valor numeric, regra_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_consultor uuid;
  v_operadora text;
  v_valor numeric;
  v_produto text;
  v_tipo_pedido text;
  r RECORD;
BEGIN
  SELECT vd.id, vd.consultor_id, vd.operadora::text, vd.valor, vd.produto, vd.tipo_pedido
    INTO v_id, v_consultor, v_operadora, v_valor, v_produto, v_tipo_pedido
  FROM public.vendas vd WHERE vd.id = _venda_id;

  IF v_id IS NULL THEN RETURN; END IF;

  SELECT * INTO r FROM public.comissao_regras
    WHERE ativo = true
      AND CURRENT_DATE BETWEEN vigencia_inicio AND COALESCE(vigencia_fim, CURRENT_DATE)
      AND (consultor_id = v_consultor OR consultor_id IS NULL)
      AND (operadora = v_operadora OR operadora IS NULL)
      AND (produto IS NULL OR produto = v_produto)
      AND (tipo_pedido IS NULL OR tipo_pedido = v_tipo_pedido)
      AND COALESCE(v_valor,0) >= COALESCE(valor_min,0)
      AND (valor_max IS NULL OR COALESCE(v_valor,0) <= valor_max)
    ORDER BY
      (consultor_id = v_consultor) DESC NULLS LAST,
      (produto IS NOT NULL AND produto = v_produto) DESC,
      (tipo_pedido IS NOT NULL AND tipo_pedido = v_tipo_pedido) DESC,
      (operadora = v_operadora) DESC NULLS LAST,
      vigencia_inicio DESC
    LIMIT 1;

  IF r.id IS NULL THEN
    percentual := 0; bonus := 0; valor := 0; regra_id := NULL;
    RETURN NEXT; RETURN;
  END IF;

  percentual := r.percentual;
  bonus := r.bonus_fixo;
  valor := ROUND(COALESCE(v_valor,0) * r.percentual / 100.0, 2) + r.bonus_fixo;
  regra_id := r.id;
  RETURN NEXT;
END;
$function$;

-- 2) Backfill: gera comissão pendente para qualquer venda já "ativado" sem comissão
DO $$
DECLARE
  v RECORD;
  c RECORD;
  f_id UUID;
  _ano INT;
  _mes INT;
BEGIN
  FOR v IN
    SELECT vd.* FROM public.vendas vd
    WHERE vd.status_pedido = 'ativado'
      AND NOT EXISTS (SELECT 1 FROM public.comissao_itens ci WHERE ci.venda_id = vd.id)
  LOOP
    SELECT * FROM public.calc_comissao_venda(v.id) INTO c;

    _ano := EXTRACT(YEAR FROM now())::int;
    _mes := EXTRACT(MONTH FROM now())::int;

    SELECT id INTO f_id FROM public.comissao_fechamentos WHERE ano = _ano AND mes = _mes AND status = 'aberto';
    IF f_id IS NULL THEN
      INSERT INTO public.comissao_fechamentos(ano, mes) VALUES (_ano, _mes) RETURNING id INTO f_id;
    END IF;

    INSERT INTO public.comissao_itens(
      fechamento_id, venda_id, consultor_id, operadora, produto, tipo_pedido,
      base_calculo, percentual_aplicado, bonus_fixo, valor_comissao, regra_id,
      status, sem_regra, data_ativacao_100
    ) VALUES (
      f_id, v.id, v.consultor_id, v.operadora, v.produto, v.tipo_pedido,
      COALESCE(v.valor,0), COALESCE(c.percentual,0), COALESCE(c.bonus,0), COALESCE(c.valor,0), c.regra_id,
      CASE WHEN c.regra_id IS NULL THEN 'pendente_regra'::public.comissao_status_enum
           ELSE 'pendente_confirmacao'::public.comissao_status_enum END,
      c.regra_id IS NULL,
      now()
    );

    INSERT INTO public.venda_historico (venda_id, tipo, descricao, user_nome)
    VALUES (v.id, 'observacao',
      'Comissão gerada (backfill) — Valor previsto: R$ ' || to_char(COALESCE(c.valor,0),'FM999G999G990D00') ||
      ' — Status: ' || CASE WHEN c.regra_id IS NULL THEN 'Pendente de regra' ELSE 'Pendente de confirmação' END,
      'Sistema');
  END LOOP;
END $$;
