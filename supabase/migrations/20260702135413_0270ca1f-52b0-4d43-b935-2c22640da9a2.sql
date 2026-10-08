-- Limpar tickets órfãos (sem venda vinculada ou apontando para venda inexistente)
DELETE FROM public.ticket_mensagens WHERE ticket_id IN (
  SELECT t.id FROM public.tickets t
  LEFT JOIN public.vendas v ON v.id = t.venda_id
  WHERE t.venda_id IS NULL OR v.id IS NULL
);
DELETE FROM public.ticket_leituras WHERE ticket_id IN (
  SELECT t.id FROM public.tickets t
  LEFT JOIN public.vendas v ON v.id = t.venda_id
  WHERE t.venda_id IS NULL OR v.id IS NULL
);
DELETE FROM public.ticket_sla_historico WHERE ticket_id IN (
  SELECT t.id FROM public.tickets t
  LEFT JOIN public.vendas v ON v.id = t.venda_id
  WHERE t.venda_id IS NULL OR v.id IS NULL
);
DELETE FROM public.tickets t
WHERE t.venda_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = t.venda_id);

-- Garantir vínculo obrigatório e cascata quando a venda é excluída
ALTER TABLE public.tickets
  ALTER COLUMN venda_id SET NOT NULL;

ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_venda_id_fkey;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_venda_id_fkey
  FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE CASCADE;