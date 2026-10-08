-- Planos podem compartilhar o mesmo nome dentro da mesma Operadora + Produto.
-- A diferenciação comercial pode estar no bônus, valor e demais dados da oferta.
-- Mantém apenas um índice não-único para consultas por operadora/produto/nome.

drop index if exists public.idx_planos_catalogo_operadora_produto_nome;

create index if not exists idx_planos_catalogo_operadora_produto_nome
  on public.planos_catalogo (
    operadora,
    coalesce(produto_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(nome))
  );

comment on index public.idx_planos_catalogo_operadora_produto_nome is
  'Índice de busca não-único. Nomes de planos podem se repetir; bônus/valor/oferta diferenciam as opções.';
