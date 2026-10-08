-- Campo livre de operadora doadora por linha.
-- A operadora comercial do pedido/linha continua separada para regras de catálogo e bônus.

alter table public.venda_linhas
  add column if not exists operadora_doadora text;

comment on column public.venda_linhas.operadora_doadora is
  'Operadora doadora informada livremente por linha; não se confunde com a operadora comercial do pedido.';
