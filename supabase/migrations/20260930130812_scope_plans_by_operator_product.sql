
-- Planos são específicos do Produto. Permite, por exemplo, "5 GB" em
-- diferentes Passaportes CLARO sem misturar suas ofertas.

drop index if exists public.idx_planos_catalogo_operadora_nome;

create unique index if not exists idx_planos_catalogo_operadora_produto_nome
  on public.planos_catalogo (
    operadora,
    coalesce(produto_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(nome))
  );
