alter table public.venda_consultor_notas
  alter column created_by drop not null;

alter table public.venda_consultor_notas
  drop constraint if exists venda_consultor_notas_created_by_fkey;

alter table public.venda_consultor_notas
  add constraint venda_consultor_notas_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
