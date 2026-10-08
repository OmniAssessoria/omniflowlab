
CREATE OR REPLACE FUNCTION public.recalc_cliente_totais(_cliente_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ops text[];
BEGIN
  IF _cliente_id IS NULL THEN RETURN; END IF;
  SELECT ARRAY(SELECT DISTINCT v.operadora::text FROM public.vendas v WHERE v.cliente_id = _cliente_id AND v.operadora IS NOT NULL) INTO _ops;
  UPDATE public.clientes c SET
    qtd_linhas_total = COALESCE((SELECT SUM(v.quantidade_linhas) FROM public.vendas v WHERE v.cliente_id = _cliente_id), 0),
    receita_total    = COALESCE((SELECT SUM(v.valor)             FROM public.vendas v WHERE v.cliente_id = _cliente_id), 0),
    ultima_venda_em  = (SELECT MAX(COALESCE(v.data_ativacao, v.data_recebimento, v.updated_at, v.created_at)) FROM public.vendas v WHERE v.cliente_id = _cliente_id),
    operadoras       = CASE WHEN array_length(_ops,1) IS NULL THEN c.operadoras ELSE _ops END
  WHERE c.id = _cliente_id;
END; $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.clientes LOOP
    PERFORM public.recalc_cliente_totais(r.id);
  END LOOP;
END $$;
