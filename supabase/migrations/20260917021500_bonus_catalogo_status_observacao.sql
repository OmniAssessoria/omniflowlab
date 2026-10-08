-- Ajustes de validação 2026-09-16:
-- 1) bônus VIVO passa a usar catálogo gerenciável por Admin/BKO;
-- 2) observação do Status Comercial passa a ser registrada depois da troca.

create table if not exists public.bonus_vivo_catalogo (
  id uuid primary key default gen_random_uuid(),
  gb integer not null check (gb > 0),
  ativo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bonus_vivo_catalogo_gb_inteiro check (gb = trunc(gb))
);

create unique index if not exists idx_bonus_vivo_catalogo_gb
  on public.bonus_vivo_catalogo(gb);

insert into public.bonus_vivo_catalogo (gb, ativo)
values (10, true), (20, true)
on conflict (gb) do update set ativo = true;

alter table public.bonus_vivo_catalogo enable row level security;

revoke all on table public.bonus_vivo_catalogo from anon, authenticated;
grant select, insert, update, delete on table public.bonus_vivo_catalogo to authenticated;

drop policy if exists authenticated_read on public.bonus_vivo_catalogo;
create policy authenticated_read
on public.bonus_vivo_catalogo for select
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists admin_bko_write_insert on public.bonus_vivo_catalogo;
create policy admin_bko_write_insert
on public.bonus_vivo_catalogo for insert
to authenticated
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
);

drop policy if exists admin_bko_write_update on public.bonus_vivo_catalogo;
create policy admin_bko_write_update
on public.bonus_vivo_catalogo for update
to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
)
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
);

drop policy if exists admin_bko_write_delete on public.bonus_vivo_catalogo;
create policy admin_bko_write_delete
on public.bonus_vivo_catalogo for delete
to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
);

create or replace function public.guard_venda_linha_bonus()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_operadora public.operadora_enum;
begin
  select operadora into v_operadora
  from public.vendas
  where id = new.venda_id;

  if v_operadora is null then
    raise exception 'Venda da linha não encontrada.';
  end if;

  if v_operadora <> 'VIVO'::public.operadora_enum then
    new.possui_bonus := null;
    new.bonus_gb := null;
    return new;
  end if;

  if coalesce(new.possui_bonus, false) = false then
    new.bonus_gb := null;
    return new;
  end if;

  -- Preserva valores históricos. Se uma opção for editada/excluída do catálogo,
  -- linhas antigas continuam válidas enquanto o bônus não estiver sendo alterado.
  if tg_op = 'UPDATE'
     and new.venda_id is not distinct from old.venda_id
     and new.possui_bonus is not distinct from old.possui_bonus
     and new.bonus_gb is not distinct from old.bonus_gb then
    return new;
  end if;

  if new.bonus_gb is null or not exists (
    select 1
    from public.bonus_vivo_catalogo b
    where b.gb = new.bonus_gb
      and b.ativo = true
  ) then
    raise exception 'Selecione uma opção ativa do catálogo de bônus VIVO.';
  end if;

  return new;
end;
$$;

alter table public.venda_status_comercial_historico
  add column if not exists observacao_user_id uuid references auth.users(id) on delete set null,
  add column if not exists observacao_user_nome text,
  add column if not exists observacao_user_role text,
  add column if not exists observacao_em timestamptz;

create index if not exists idx_venda_status_comercial_hist_observacao_user
  on public.venda_status_comercial_historico(observacao_user_id);

create or replace function public.atualizar_observacao_status_comercial(
  p_venda_id uuid,
  p_observacao text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_historico_id uuid;
  v_observacao text := nullif(trim(p_observacao), '');
  v_nome text;
  v_role text;
begin
  if v_uid is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_uid, 'admin'::public.app_role)
    or public.has_role(v_uid, 'bko'::public.app_role)
  ) then
    raise exception 'Somente BKO ou Administrador podem registrar observação do Status Comercial.';
  end if;

  if v_observacao is null then
    raise exception 'Informe uma observação.';
  end if;

  select h.id
    into v_historico_id
  from public.venda_status_comercial_historico h
  where h.venda_id = p_venda_id
  order by h.created_at desc, h.id desc
  limit 1
  for update;

  if v_historico_id is null then
    raise exception 'Nenhum Status Comercial ativo encontrado para este pedido.';
  end if;

  select coalesce(nullif(trim(p.nome_completo), ''), nullif(trim(p.email), ''), 'Usuário')
    into v_nome
  from public.profiles p
  where p.id = v_uid;

  v_nome := coalesce(v_nome, 'Usuário');
  v_role := case
    when public.has_role(v_uid, 'admin'::public.app_role) then 'admin'
    when public.has_role(v_uid, 'bko'::public.app_role) then 'bko'
    else 'usuario'
  end;

  update public.venda_status_comercial_historico
  set observacao = v_observacao,
      observacao_user_id = v_uid,
      observacao_user_nome = v_nome,
      observacao_user_role = v_role,
      observacao_em = now()
  where id = v_historico_id;

  return v_historico_id;
end;
$$;

revoke all on function public.atualizar_observacao_status_comercial(uuid, text) from public, anon;
grant execute on function public.atualizar_observacao_status_comercial(uuid, text) to authenticated;
