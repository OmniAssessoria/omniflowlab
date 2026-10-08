-- Endereço cadastral da empresa/cliente.
-- O dado pertence ao cliente único e pode ser utilizado por todos os pedidos vinculados.

alter table public.clientes
  add column if not exists endereco text;
