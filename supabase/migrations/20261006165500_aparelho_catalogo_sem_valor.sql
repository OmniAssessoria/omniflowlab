-- Produto APARELHO usa o catálogo apenas para o nome/modelo.
-- O valor da venda é informado manualmente na linha e não deve vir do plano.

update public.plano_ofertas_catalogo po
set valor_mes = 0
where exists (
  select 1
  from public.planos_catalogo pl
  join public.produtos_catalogo pc on pc.id = pl.produto_id
  where pl.id = po.plano_id
    and lower(btrim(pc.nome)) in ('aparelho', 'aparelhos')
);

update public.planos_catalogo pl
set valor_mes = 0
where exists (
  select 1
  from public.produtos_catalogo pc
  where pc.id = pl.produto_id
    and lower(btrim(pc.nome)) in ('aparelho', 'aparelhos')
);
