begin;

-- Separa definitivamente Pessoa Jurídica (Cedente) de Pessoa Física (Cessionário).
-- Cedente: CNPJ, Razão Social, Nome e E-mail.
-- Cessionário: CPF, Nome e E-mail.
-- Cessionário é opcional e só pode ser usado nas mesmas linhas/tipos que já permitem Cedente.

create table if not exists public.cessionarios (
  id uuid primary key default gen_random_uuid(),
  cpf text not null,
  nome text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id)
);

create table if not exists public.cliente_cessionarios (
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  cessionario_id uuid not null references public.cessionarios(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  ativo boolean not null default true,
  primary key (cliente_id, cessionario_id)
);

create table if not exists public.venda_cessionarios (
  venda_id uuid not null references public.vendas(id) on delete cascade,
  cessionario_id uuid not null references public.cessionarios(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id),
  primary key (venda_id, cessionario_id)
);

create table if not exists public.venda_linha_cessionarios (
  id uuid primary key default gen_random_uuid(),
  linha_id uuid not null references public.venda_linhas(id) on delete cascade,
  cessionario_id uuid not null references public.cessionarios(id) on delete cascade,
  created_by uuid null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (linha_id)
);

create index if not exists cliente_cessionarios_cessionario_idx
  on public.cliente_cessionarios(cessionario_id);
create index if not exists venda_cessionarios_cessionario_idx
  on public.venda_cessionarios(cessionario_id);
create index if not exists venda_linha_cessionarios_cessionario_idx
  on public.venda_linha_cessionarios(cessionario_id);

-- A migração histórica não deve disparar sincronizações legadas de Cedente,
-- totais de cliente, logs ou outras automações de negócio.
alter table public.vendas disable trigger user;
alter table public.venda_cedentes disable trigger user;
alter table public.cliente_cedentes disable trigger user;
alter table public.venda_linha_doadores disable trigger user;

-- Migra automaticamente os Cedentes PF legados para Cessionários,
-- mantendo os mesmos IDs para preservar referência e rastreabilidade.
insert into public.cessionarios(id, cpf, nome, email, created_at, updated_at, created_by)
select
  c.id,
  c.cnpj_cpf,
  coalesce(nullif(btrim(c.nome), ''), 'Não informado'),
  coalesce(nullif(btrim(c.email), ''), 'nao-informado@omni.local'),
  c.created_at,
  c.updated_at,
  c.created_by
from public.cedentes c
where length(regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g')) = 11
on conflict (id) do update set
  cpf = excluded.cpf,
  nome = excluded.nome,
  email = excluded.email,
  updated_at = excluded.updated_at;

insert into public.cliente_cessionarios(cliente_id, cessionario_id, created_at, created_by, ativo)
select cc.cliente_id, cc.cedente_id, cc.created_at, cc.created_by, cc.ativo
from public.cliente_cedentes cc
join public.cedentes c on c.id = cc.cedente_id
where length(regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g')) = 11
on conflict (cliente_id, cessionario_id)
do update set ativo = excluded.ativo;

insert into public.venda_cessionarios(venda_id, cessionario_id, created_at, created_by)
select vc.venda_id, vc.cedente_id, vc.created_at, vc.created_by
from public.venda_cedentes vc
join public.cedentes c on c.id = vc.cedente_id
where length(regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g')) = 11
on conflict (venda_id, cessionario_id) do nothing;

insert into public.venda_linha_cessionarios(id, linha_id, cessionario_id, created_by, created_at, updated_at)
select vld.id, vld.linha_id, vld.cedente_id, vld.created_by, vld.created_at, vld.updated_at
from public.venda_linha_doadores vld
join public.cedentes c on c.id = vld.cedente_id
where length(regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g')) = 11
on conflict (linha_id) do update set
  cessionario_id = excluded.cessionario_id,
  updated_at = excluded.updated_at;

delete from public.venda_linha_doadores vld
using public.cedentes c
where c.id = vld.cedente_id
  and length(regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g')) = 11;

delete from public.venda_cedentes vc
using public.cedentes c
where c.id = vc.cedente_id
  and length(regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g')) = 11;

-- O campo legado vendas.cedente_id só pode apontar para Cedente PJ.
-- Se o valor atual era PF migrado para Cessionário, reaponta para outro Cedente
-- ainda vinculado ao pedido ou limpa o campo.
update public.vendas v
set cedente_id = (
  select vc.cedente_id
  from public.venda_cedentes vc
  where vc.venda_id = v.id
  order by vc.created_at asc, vc.cedente_id asc
  limit 1
)
where exists (
  select 1
  from public.cedentes c
  where c.id = v.cedente_id
    and length(regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g')) = 11
);

delete from public.cliente_cedentes cc
using public.cedentes c
where c.id = cc.cedente_id
  and length(regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g')) = 11;

delete from public.cedentes c
where length(regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g')) = 11;

alter table public.venda_linha_doadores enable trigger user;
alter table public.cliente_cedentes enable trigger user;
alter table public.venda_cedentes enable trigger user;
alter table public.vendas enable trigger user;

-- A partir daqui Cedente é sempre PJ.
alter table public.cedentes
  drop constraint if exists cedentes_documento_cnpj_check,
  drop constraint if exists cedentes_razao_social_obrigatoria_check,
  drop constraint if exists cedentes_nome_obrigatorio_check,
  drop constraint if exists cedentes_email_obrigatorio_check;

alter table public.cedentes
  add constraint cedentes_documento_cnpj_check
    check (length(regexp_replace(coalesce(cnpj_cpf,''), '[^0-9]', '', 'g')) = 14) not valid,
  add constraint cedentes_razao_social_obrigatoria_check
    check (nullif(btrim(coalesce(razao_social,'')), '') is not null),
  add constraint cedentes_nome_obrigatorio_check
    check (nullif(btrim(coalesce(nome,'')), '') is not null),
  add constraint cedentes_email_obrigatorio_check
    check (nullif(btrim(coalesce(email,'')), '') is not null);

alter table public.cessionarios
  drop constraint if exists cessionarios_cpf_check,
  drop constraint if exists cessionarios_nome_check,
  drop constraint if exists cessionarios_email_check;

alter table public.cessionarios
  add constraint cessionarios_cpf_check
    check (length(regexp_replace(coalesce(cpf,''), '[^0-9]', '', 'g')) = 11),
  add constraint cessionarios_nome_check
    check (nullif(btrim(coalesce(nome,'')), '') is not null),
  add constraint cessionarios_email_check
    check (nullif(btrim(coalesce(email,'')), '') is not null);

-- RLS espelha exatamente o acesso operacional já usado por Cedentes.
alter table public.cessionarios enable row level security;
alter table public.cliente_cessionarios enable row level security;
alter table public.venda_cessionarios enable row level security;
alter table public.venda_linha_cessionarios enable row level security;

drop policy if exists "cessionarios select operacao" on public.cessionarios;
create policy "cessionarios select operacao"
on public.cessionarios for select to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  or public.has_role((select auth.uid()), 'consultor'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'suporte'::public.app_role)
  or public.has_role((select auth.uid()), 'closer'::public.app_role)
);

drop policy if exists "cessionarios insert operacao" on public.cessionarios;
create policy "cessionarios insert operacao"
on public.cessionarios for insert to authenticated
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  or public.has_role((select auth.uid()), 'consultor'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'suporte'::public.app_role)
  or public.has_role((select auth.uid()), 'closer'::public.app_role)
);

drop policy if exists "cessionarios update operacao" on public.cessionarios;
create policy "cessionarios update operacao"
on public.cessionarios for update to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  or public.has_role((select auth.uid()), 'consultor'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'suporte'::public.app_role)
  or public.has_role((select auth.uid()), 'closer'::public.app_role)
)
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  or public.has_role((select auth.uid()), 'consultor'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'suporte'::public.app_role)
  or public.has_role((select auth.uid()), 'closer'::public.app_role)
);

drop policy if exists "cliente cessionarios select operacao" on public.cliente_cessionarios;
create policy "cliente cessionarios select operacao"
on public.cliente_cessionarios for select to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  or public.has_role((select auth.uid()), 'consultor'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'suporte'::public.app_role)
  or public.has_role((select auth.uid()), 'closer'::public.app_role)
);

drop policy if exists "cliente cessionarios insert operacao" on public.cliente_cessionarios;
create policy "cliente cessionarios insert operacao"
on public.cliente_cessionarios for insert to authenticated
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  or public.has_role((select auth.uid()), 'consultor'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'suporte'::public.app_role)
  or public.has_role((select auth.uid()), 'closer'::public.app_role)
);

drop policy if exists "cliente cessionarios update operacao" on public.cliente_cessionarios;
create policy "cliente cessionarios update operacao"
on public.cliente_cessionarios for update to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  or public.has_role((select auth.uid()), 'consultor'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'suporte'::public.app_role)
  or public.has_role((select auth.uid()), 'closer'::public.app_role)
)
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  or public.has_role((select auth.uid()), 'consultor'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'suporte'::public.app_role)
  or public.has_role((select auth.uid()), 'closer'::public.app_role)
);

drop policy if exists "venda cessionarios select operacao" on public.venda_cessionarios;
create policy "venda cessionarios select operacao"
on public.venda_cessionarios for select to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  or public.has_role((select auth.uid()), 'consultor'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'suporte'::public.app_role)
  or public.has_role((select auth.uid()), 'closer'::public.app_role)
);

drop policy if exists "venda cessionarios insert operacao" on public.venda_cessionarios;
create policy "venda cessionarios insert operacao"
on public.venda_cessionarios for insert to authenticated
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  or public.has_role((select auth.uid()), 'consultor'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'suporte'::public.app_role)
  or public.has_role((select auth.uid()), 'closer'::public.app_role)
);

drop policy if exists "venda cessionarios delete operacao" on public.venda_cessionarios;
create policy "venda cessionarios delete operacao"
on public.venda_cessionarios for delete to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  or public.has_role((select auth.uid()), 'consultor'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'suporte'::public.app_role)
  or public.has_role((select auth.uid()), 'closer'::public.app_role)
);

drop policy if exists venda_linha_cessionarios_read on public.venda_linha_cessionarios;
create policy venda_linha_cessionarios_read
on public.venda_linha_cessionarios for select to authenticated
using (
  exists (
    select 1
    from public.venda_linhas vl
    join public.vendas v on v.id = vl.venda_id
    where vl.id = venda_linha_cessionarios.linha_id
      and (
        public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        or v.consultor_id = (select auth.uid())
      )
  )
);

drop policy if exists venda_linha_cessionarios_insert on public.venda_linha_cessionarios;
create policy venda_linha_cessionarios_insert
on public.venda_linha_cessionarios for insert to authenticated
with check (
  exists (
    select 1
    from public.venda_linhas vl
    join public.vendas v on v.id = vl.venda_id
    where vl.id = venda_linha_cessionarios.linha_id
      and (
        public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        or (v.consultor_id = (select auth.uid()) and v.concluido_em is null)
      )
  )
);

drop policy if exists venda_linha_cessionarios_update on public.venda_linha_cessionarios;
create policy venda_linha_cessionarios_update
on public.venda_linha_cessionarios for update to authenticated
using (
  exists (
    select 1
    from public.venda_linhas vl
    join public.vendas v on v.id = vl.venda_id
    where vl.id = venda_linha_cessionarios.linha_id
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
    select 1
    from public.venda_linhas vl
    join public.vendas v on v.id = vl.venda_id
    where vl.id = venda_linha_cessionarios.linha_id
      and (
        public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        or (v.consultor_id = (select auth.uid()) and v.concluido_em is null)
      )
  )
);

drop policy if exists venda_linha_cessionarios_delete on public.venda_linha_cessionarios;
create policy venda_linha_cessionarios_delete
on public.venda_linha_cessionarios for delete to authenticated
using (
  exists (
    select 1
    from public.venda_linhas vl
    join public.vendas v on v.id = vl.venda_id
    where vl.id = venda_linha_cessionarios.linha_id
      and (
        public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        or (v.consultor_id = (select auth.uid()) and v.concluido_em is null)
      )
  )
);

grant select, insert, update on public.cessionarios to authenticated;
grant select, insert, update on public.cliente_cessionarios to authenticated;
grant select, insert, delete on public.venda_cessionarios to authenticated;
grant select, insert, update, delete on public.venda_linha_cessionarios to authenticated;

-- Cedente deixa de aceitar CPF. Validação de vínculo permanece igual.
create or replace function public.validar_cedente_da_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_venda_id uuid;
  v_documento text;
  v_razao text;
begin
  select venda_id into v_venda_id
  from public.venda_linhas
  where id = new.linha_id;

  if v_venda_id is null then
    raise exception 'Linha não encontrada para vínculo de Cedente';
  end if;

  if not exists (
    select 1
    from public.venda_cedentes vc
    where vc.venda_id = v_venda_id
      and vc.cedente_id = new.cedente_id
  ) then
    raise exception 'Cedente não pertence aos Cedentes disponíveis deste pedido';
  end if;

  select regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g'),
         nullif(btrim(coalesce(c.razao_social,'')), '')
    into v_documento, v_razao
  from public.cedentes c
  where c.id = new.cedente_id;

  if length(coalesce(v_documento,'')) <> 14 then
    raise exception 'Cedente deve ser Pessoa Jurídica com CNPJ de 14 dígitos';
  end if;

  if v_razao is null then
    raise exception 'Cedente deve possuir Razão Social';
  end if;

  return new;
end;
$function$;

create or replace function public.validar_cessionario_da_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_venda_id uuid;
  v_operadora text;
  v_tipo_pedido text;
  v_permite boolean := false;
  v_documento text;
begin
  select venda_id, operadora, tipo_produto
    into v_venda_id, v_operadora, v_tipo_pedido
  from public.venda_linhas
  where id = new.linha_id;

  if v_venda_id is null then
    raise exception 'Linha não encontrada para vínculo de Cessionário';
  end if;

  if not exists (
    select 1
    from public.venda_cessionarios vc
    where vc.venda_id = v_venda_id
      and vc.cessionario_id = new.cessionario_id
  ) then
    raise exception 'Cessionário não pertence aos Cessionários disponíveis deste pedido';
  end if;

  select coalesce(t.permite_doador, false)
    into v_permite
  from public.tipos_pedido_catalogo t
  where t.operadora = v_operadora
    and t.ativo = true
    and lower(btrim(t.nome)) = lower(btrim(coalesce(v_tipo_pedido,'')))
  limit 1;

  if not coalesce(v_permite,false) then
    raise exception 'Este Tipo de Pedido da linha não utiliza Cedente/Cessionário.';
  end if;

  select regexp_replace(coalesce(c.cpf,''), '[^0-9]', '', 'g')
    into v_documento
  from public.cessionarios c
  where c.id = new.cessionario_id;

  if length(coalesce(v_documento,'')) <> 11 then
    raise exception 'Cessionário deve possuir CPF de 11 dígitos';
  end if;

  return new;
end;
$function$;

drop trigger if exists validar_cessionario_da_linha_before_write
  on public.venda_linha_cessionarios;
create trigger validar_cessionario_da_linha_before_write
before insert or update of linha_id, cessionario_id
on public.venda_linha_cessionarios
for each row execute function public.validar_cessionario_da_linha();

-- Uma linha pode ter Cedente OU Cessionário, nunca os dois ao mesmo tempo.
create or replace function public.validar_exclusividade_cedente_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if exists (
    select 1 from public.venda_linha_cessionarios vlc
    where vlc.linha_id = new.linha_id
  ) then
    raise exception 'A linha já possui um Cessionário. Remova-o antes de vincular um Cedente.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_validar_exclusividade_cedente_linha
  on public.venda_linha_doadores;
create trigger trg_validar_exclusividade_cedente_linha
before insert or update of linha_id, cedente_id
on public.venda_linha_doadores
for each row execute function public.validar_exclusividade_cedente_linha();

create or replace function public.validar_exclusividade_cessionario_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if exists (
    select 1 from public.venda_linha_doadores vld
    where vld.linha_id = new.linha_id
  ) then
    raise exception 'A linha já possui um Cedente. Remova-o antes de vincular um Cessionário.';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_validar_exclusividade_cessionario_linha
  on public.venda_linha_cessionarios;
create trigger trg_validar_exclusividade_cessionario_linha
before insert or update of linha_id, cessionario_id
on public.venda_linha_cessionarios
for each row execute function public.validar_exclusividade_cessionario_linha();

create or replace function public.proteger_cessionario_em_uso_na_venda()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if exists (
    select 1
    from public.venda_linha_cessionarios vlc
    join public.venda_linhas vl on vl.id = vlc.linha_id
    where vl.venda_id = old.venda_id
      and vlc.cessionario_id = old.cessionario_id
  ) then
    raise exception 'Cessionário está vinculado a uma ou mais linhas deste pedido';
  end if;
  return old;
end;
$function$;

drop trigger if exists proteger_cessionario_em_uso_before_delete
  on public.venda_cessionarios;
create trigger proteger_cessionario_em_uso_before_delete
before delete on public.venda_cessionarios
for each row execute function public.proteger_cessionario_em_uso_na_venda();

-- Quando a linha deixa de usar Cedente/Cessionário, limpa o vínculo opcional do Cessionário.
create or replace function public.cleanup_venda_linha_cessionario_after_type_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_permite boolean := false;
  v_cessionario record;
  v_user_nome text;
begin
  if coalesce(current_setting('app.tipo_produto_catalog_rename', true), '0') = '1' then
    return new;
  end if;

  if new.venda_id is not distinct from old.venda_id
     and new.tipo_produto is not distinct from old.tipo_produto
     and new.operadora is not distinct from old.operadora then
    return new;
  end if;

  select coalesce(t.permite_doador, false)
    into v_permite
  from public.tipos_pedido_catalogo t
  where t.operadora = new.operadora
    and t.ativo = true
    and lower(btrim(t.nome)) = lower(btrim(coalesce(new.tipo_produto,'')))
  limit 1;

  if coalesce(v_permite,false) then
    return new;
  end if;

  select c.id, c.cpf, c.nome, c.email
    into v_cessionario
  from public.venda_linha_cessionarios vlc
  join public.cessionarios c on c.id = vlc.cessionario_id
  where vlc.linha_id = new.id
  limit 1;

  if found then
    select nome_completo into v_user_nome
    from public.profiles where id = auth.uid();

    insert into public.venda_historico(
      venda_id, tipo, campo, valor_anterior, valor_novo,
      descricao, user_id, user_nome
    ) values (
      new.venda_id,
      'campo'::public.historico_tipo_enum,
      'cessionario_linha',
      concat_ws(' | ', v_cessionario.nome, v_cessionario.cpf, v_cessionario.email),
      null,
      'Cessionário removido automaticamente porque a linha mudou para o Tipo de Pedido “'
        || coalesce(new.tipo_produto, 'Não informado')
        || '” / Operadora “'
        || coalesce(new.operadora, 'Não informada')
        || '”, combinação que não utiliza Cedente/Cessionário.',
      auth.uid(),
      v_user_nome
    );

    delete from public.venda_linha_cessionarios
    where linha_id = new.id;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_cleanup_venda_linha_cessionario_after_type_change
  on public.venda_linhas;
create trigger trg_cleanup_venda_linha_cessionario_after_type_change
after update of venda_id, tipo_produto, operadora
on public.venda_linhas
for each row execute function public.cleanup_venda_linha_cessionario_after_type_change();

-- RPC atômica usada pela tela de linhas para trocar entre Cedente e Cessionário.
create or replace function public.definir_parte_linha(
  p_linha_id uuid,
  p_tipo text,
  p_parte_id uuid default null
)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $function$
declare
  v_tipo text := lower(btrim(coalesce(p_tipo,'')));
begin
  if auth.uid() is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if v_tipo in ('', 'nenhum', 'sem_vinculo') or p_parte_id is null then
    delete from public.venda_linha_doadores where linha_id = p_linha_id;
    delete from public.venda_linha_cessionarios where linha_id = p_linha_id;
    return;
  end if;

  if v_tipo = 'cedente' then
    delete from public.venda_linha_cessionarios where linha_id = p_linha_id;
    insert into public.venda_linha_doadores(linha_id, cedente_id, created_by)
    values (p_linha_id, p_parte_id, auth.uid())
    on conflict (linha_id)
    do update set cedente_id = excluded.cedente_id, updated_at = now();
    return;
  end if;

  if v_tipo = 'cessionario' then
    delete from public.venda_linha_doadores where linha_id = p_linha_id;
    insert into public.venda_linha_cessionarios(linha_id, cessionario_id, created_by)
    values (p_linha_id, p_parte_id, auth.uid())
    on conflict (linha_id)
    do update set cessionario_id = excluded.cessionario_id, updated_at = now();
    return;
  end if;

  raise exception 'Tipo de vínculo inválido. Use Cedente ou Cessionário.';
end;
$function$;

revoke all on function public.definir_parte_linha(uuid,text,uuid) from public;
grant execute on function public.definir_parte_linha(uuid,text,uuid) to authenticated;

commit;
