alter table public.venda_linhas
  add column if not exists tamanho_plano numeric,
  add column if not exists tamanho_plano_unidade text;

alter table public.venda_linhas
  drop constraint if exists venda_linhas_tamanho_plano_nonnegative,
  add constraint venda_linhas_tamanho_plano_nonnegative
    check (tamanho_plano is null or tamanho_plano >= 0),
  drop constraint if exists venda_linhas_tamanho_plano_unidade_check,
  add constraint venda_linhas_tamanho_plano_unidade_check
    check (tamanho_plano_unidade is null or tamanho_plano_unidade in ('GB', 'MB'));
