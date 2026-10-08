-- Planos comerciais pertencem permanentemente a uma única operadora.
-- A leitura já é filtrada por operadora no frontend; esta migração blinda a regra no banco.

alter table public.planos_catalogo
  drop constraint if exists planos_catalogo_operadora_valida;

alter table public.planos_catalogo
  add constraint planos_catalogo_operadora_valida
  check (operadora in ('CLARO','VIVO'));

create or replace function public.guard_planos_catalogo_operadora()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.nome := btrim(new.nome);

  if new.nome = '' then
    raise exception 'Informe o nome do plano.';
  end if;

  if new.operadora not in ('CLARO','VIVO') then
    raise exception 'Operadora do plano deve ser CLARO ou VIVO.';
  end if;

  if tg_op = 'UPDATE'
     and new.operadora is distinct from old.operadora then
    raise exception 'A operadora de um plano não pode ser alterada. Crie ou edite o plano na operadora correta.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_planos_catalogo_operadora on public.planos_catalogo;
create trigger trg_guard_planos_catalogo_operadora
before insert or update
on public.planos_catalogo
for each row execute function public.guard_planos_catalogo_operadora();

revoke all on function public.guard_planos_catalogo_operadora() from public;
