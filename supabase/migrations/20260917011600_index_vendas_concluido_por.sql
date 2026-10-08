-- Evolução Operacional 2026-09-16
-- Índice para a FK de auditoria da conclusão definitiva do pedido.

create index if not exists idx_vendas_concluido_por
  on public.vendas(concluido_por)
  where concluido_por is not null;
