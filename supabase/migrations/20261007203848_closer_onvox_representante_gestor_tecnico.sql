alter table public.closer_pedidos
  add column if not exists representante_legal_nome text,
  add column if not exists representante_legal_email text,
  add column if not exists representante_legal_telefone text,
  add column if not exists gestor_tecnico_nome text,
  add column if not exists gestor_tecnico_email text,
  add column if not exists gestor_tecnico_telefone text,
  add column if not exists gestor_tecnico_email_faturas text;
