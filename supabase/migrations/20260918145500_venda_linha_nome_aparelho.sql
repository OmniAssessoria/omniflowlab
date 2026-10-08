alter table public.venda_linhas
  add column if not exists nome_aparelho text;

comment on column public.venda_linhas.nome_aparelho is
  'Nome/modelo comercial do aparelho quando tipo_produto = Aparelhos.';
