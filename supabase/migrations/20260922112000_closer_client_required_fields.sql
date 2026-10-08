-- OMNI PipeLab: dados do cliente obrigatórios na Operação Closer.
-- Constraints NOT VALID preservam registros legados fora do padrão,
-- mas passam a bloquear novos inserts/updates inválidos.

alter table public.closer_clientes
  add constraint closer_clientes_razao_required_chk
  check (nullif(btrim(razao_social), '') is not null) not valid;

alter table public.closer_clientes
  add constraint closer_clientes_fantasia_required_chk
  check (nullif(btrim(nome_fantasia), '') is not null) not valid;

alter table public.closer_clientes
  add constraint closer_clientes_cnpj_14_digits_chk
  check (length(regexp_replace(cnpj, '\D', '', 'g')) = 14) not valid;

alter table public.closer_clientes
  add constraint closer_clientes_origem_required_chk
  check (nullif(btrim(origem_lead), '') is not null) not valid;

alter table public.closer_clientes
  add constraint closer_clientes_contato_required_chk
  check (nullif(btrim(contato), '') is not null) not valid;

alter table public.closer_clientes
  add constraint closer_clientes_telefone_required_chk
  check (nullif(btrim(telefone), '') is not null) not valid;

alter table public.closer_clientes
  add constraint closer_clientes_email_required_valid_chk
  check (
    nullif(btrim(email), '') is not null
    and btrim(email) ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ) not valid;
