create or replace function public.guard_venda_biometria_operadora()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.operadora = 'VIVO'::public.operadora_enum then
    new.tem_biometria := false;
    new.status_biometria := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_venda_biometria_operadora on public.vendas;
create trigger trg_guard_venda_biometria_operadora
before insert or update of operadora, tem_biometria, status_biometria
on public.vendas
for each row execute function public.guard_venda_biometria_operadora();

update public.vendas
set tem_biometria = false,
    status_biometria = null
where operadora = 'VIVO'::public.operadora_enum
  and (coalesce(tem_biometria, false) = true or status_biometria is not null);
