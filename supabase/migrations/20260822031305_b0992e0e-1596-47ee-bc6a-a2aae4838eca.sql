DELETE FROM public.comissao_itens 
WHERE EXTRACT(MONTH FROM data_ativacao_100) = 8 
  AND EXTRACT(YEAR FROM data_ativacao_100) = 2026
  AND (deleted_at IS NOT NULL OR status = 'cancelada');

UPDATE public.metas_mensais
SET valor_vendido = (
  SELECT COALESCE(SUM(base_calculo), 0)
  FROM public.comissao_itens
  WHERE consultor_id = metas_mensais.consultor_id
    AND meta_id = metas_mensais.id
    AND deleted_at IS NULL
    AND status NOT IN ('cancelada')
)
WHERE mes_ref = 8 AND ano_ref = 2026;