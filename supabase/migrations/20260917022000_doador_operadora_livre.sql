-- Operadora do doador passa a ser texto livre preenchido pelo usuário.
alter table public.venda_linha_doadores
  alter column operadora type text using operadora::text;

alter table public.venda_linha_doadores
  drop constraint if exists venda_linha_doadores_operadora_not_blank;

alter table public.venda_linha_doadores
  add constraint venda_linha_doadores_operadora_not_blank
  check (length(trim(operadora)) between 1 and 80);
