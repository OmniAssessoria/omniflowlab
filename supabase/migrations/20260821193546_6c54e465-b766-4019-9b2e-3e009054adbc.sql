UPDATE public.vendas v
SET cliente_id = c.id
FROM public.clientes c
WHERE v.cliente_cnpj = c.cnpj_cpf
  AND (v.cliente_id IS NULL OR v.cliente_id != c.id)
  AND v.deleted_at IS NULL;
