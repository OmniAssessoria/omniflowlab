-- Nome fantasia não faz parte da planilha/origem da Operação Closer.
-- O campo permanece no schema por compatibilidade com registros legados,
-- mas deixa de ser obrigatório e não é mais usado no cadastro.

alter table public.closer_clientes
  drop constraint if exists closer_clientes_fantasia_required_chk;
