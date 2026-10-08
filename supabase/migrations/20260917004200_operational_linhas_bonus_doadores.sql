-- Evolução Operacional 2026-09-16
-- Bônus VIVO por linha e múltiplos doadores por linha.

alter table public.venda_linhas
  add column if not exists possui_bonus boolean,
  add column if not exists bonus_gb integer;

create or replace function public.guard_venda_linha_bonus()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_operadora public.operadora_enum;
begin
  select operadora into v_operadora from public.vendas where id = new.venda_id;
  if v_operadora is null then
    raise exception 'Venda da linha não encontrada.';
  end if;

  if v_operadora <> 'VIVO'::public.operadora_enum then
    new.possui_bonus := null;
    new.bonus_gb := null;
    return new;
  end if;

  if new.possui_bonus is true and new.bonus_gb not in (10,20) then
    raise exception 'Bônus VIVO deve ser 10 GB ou 20 GB.';
  end if;

  if coalesce(new.possui_bonus, false) = false then
    new.bonus_gb := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_venda_linha_bonus on public.venda_linhas;
create trigger trg_guard_venda_linha_bonus
before insert or update of possui_bonus, bonus_gb, venda_id on public.venda_linhas
for each row execute function public.guard_venda_linha_bonus();

create table if not exists public.venda_linha_doadores (
  id uuid primary key default gen_random_uuid(),
  linha_id uuid not null references public.venda_linhas(id) on delete cascade,
  nome_completo text not null check (length(trim(nome_completo)) > 2),
  email text not null check (position('@' in email) > 1),
  telefone text not null check (length(regexp_replace(telefone, '\D', '', 'g')) >= 10),
  operadora public.operadora_enum not null,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_venda_linha_doadores_linha_id
  on public.venda_linha_doadores(linha_id);

alter table public.venda_linha_doadores enable row level security;

drop policy if exists venda_linha_doadores_read on public.venda_linha_doadores;
create policy venda_linha_doadores_read
on public.venda_linha_doadores for select to authenticated
using (
  exists (
    select 1 from public.venda_linhas vl
    join public.vendas v on v.id = vl.venda_id
    where vl.id = venda_linha_doadores.linha_id
      and (
        public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        or v.consultor_id = (select auth.uid())
      )
  )
);

drop policy if exists venda_linha_doadores_insert on public.venda_linha_doadores;
create policy venda_linha_doadores_insert
on public.venda_linha_doadores for insert to authenticated
with check (
  exists (
    select 1 from public.venda_linhas vl
    join public.vendas v on v.id = vl.venda_id
    where vl.id = venda_linha_doadores.linha_id
      and (
        public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        or (v.consultor_id = (select auth.uid()) and v.concluido_em is null)
      )
  )
);

drop policy if exists venda_linha_doadores_update on public.venda_linha_doadores;
create policy venda_linha_doadores_update
on public.venda_linha_doadores for update to authenticated
using (
  exists (
    select 1 from public.venda_linhas vl
    join public.vendas v on v.id = vl.venda_id
    where vl.id = venda_linha_doadores.linha_id
      and (
        public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        or (v.consultor_id = (select auth.uid()) and v.concluido_em is null)
      )
  )
)
with check (
  exists (
    select 1 from public.venda_linhas vl
    join public.vendas v on v.id = vl.venda_id
    where vl.id = venda_linha_doadores.linha_id
      and (
        public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        or (v.consultor_id = (select auth.uid()) and v.concluido_em is null)
      )
  )
);

drop policy if exists venda_linha_doadores_delete on public.venda_linha_doadores;
create policy venda_linha_doadores_delete
on public.venda_linha_doadores for delete to authenticated
using (
  exists (
    select 1 from public.venda_linhas vl
    join public.vendas v on v.id = vl.venda_id
    where vl.id = venda_linha_doadores.linha_id
      and (
        public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        or (v.consultor_id = (select auth.uid()) and v.concluido_em is null)
      )
  )
);

grant select, insert, update, delete on public.venda_linha_doadores to authenticated;
