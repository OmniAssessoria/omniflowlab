CREATE OR REPLACE FUNCTION public.calc_comissao_venda(_venda_id uuid)
 RETURNS TABLE(percentual numeric, bonus numeric, valor numeric, regra_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_consultor UUID; v_operadora TEXT; v_valor NUMERIC; v_produto TEXT;
  v_data DATE; m public.metas_mensais; pct NUMERIC := 10;
BEGIN
  SELECT vd.consultor_id, vd.operadora::text, COALESCE(vd.valor,0), vd.produto, COALESCE(vd.data_ativacao::date, CURRENT_DATE)
    INTO v_consultor, v_operadora, v_valor, v_produto, v_data
  FROM public.vendas vd WHERE vd.id = _venda_id;

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
END;$function$;