-- Evolução Operacional 2026-09-16
-- Status Comercial por operadora + SLA + Ativado 100%

create table if not exists public.status_comercial_operadoras (
  status_id uuid not null references public.status_comercial_catalogo(id) on delete cascade,
  operadora public.operadora_enum not null,
  sla_horas integer null check (sla_horas is null or sla_horas > 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (status_id, operadora)
);

alter table public.status_comercial_operadoras enable row level security;

drop policy if exists authenticated_read_status_comercial_operadoras on public.status_comercial_operadoras;
create policy authenticated_read_status_comercial_operadoras
on public.status_comercial_operadoras for select to authenticated
using ((select auth.uid()) is not null);

drop policy if exists admin_manage_status_comercial_operadoras on public.status_comercial_operadoras;
create policy admin_manage_status_comercial_operadoras
on public.status_comercial_operadoras for all to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

grant select, insert, update, delete on public.status_comercial_operadoras to authenticated;

alter table public.venda_status_comercial_historico
  add column if not exists observacao text,
  add column if not exists operadora_snapshot public.operadora_enum,
  add column if not exists sla_horas_snapshot integer,
  add column if not exists sla_inicio_em timestamptz,
  add column if not exists sla_metade_em timestamptz,
  add column if not exists sla_limite_em timestamptz;

alter table public.vendas
  add column if not exists status_comercial_id uuid references public.status_comercial_catalogo(id),
  add column if not exists status_comercial_nome text,
  add column if not exists status_comercial_em timestamptz,
  add column if not exists sla_horas_atual integer,
  add column if not exists sla_metade_em timestamptz,
  add column if not exists sla_limite_em timestamptz,
  add column if not exists ativado_100_em timestamptz,
  add column if not exists ativado_100_por uuid references auth.users(id);

create index if not exists idx_status_comercial_operadoras_operadora_ativo
  on public.status_comercial_operadoras (operadora, ativo, status_id);
create index if not exists idx_vendas_status_comercial_id
  on public.vendas (status_comercial_id);
create index if not exists idx_vendas_sla_limite_em
  on public.vendas (sla_limite_em) where sla_limite_em is not null;
create index if not exists idx_venda_status_hist_venda_created
  on public.venda_status_comercial_historico (venda_id, created_at desc);

-- Referências com SLA conhecidas por operadora.
insert into public.status_comercial_operadoras(status_id, operadora, sla_horas, ativo)
select c.id, x.operadora::public.operadora_enum, x.sla_horas, true
from (values
  ('AGUARDANDO CORREÇÃO CADASTRAL','CLARO',24),
  ('AUDITORIA','CLARO',24),
  ('AVA - AGUARDANDO ACEITE','CLARO',72),
  ('AVA - CANCELADO','CLARO',null),
  ('CONFECÇÃO ANDAMENTO','CLARO',24),
  ('FB - CONECTADO','CLARO',null),
  ('FB - FILA INPUT','CLARO',24),
  ('FB - PENDENTE INSTALAÇÃO','CLARO',48),
  ('FB - PENDÊNCIA SISTÊMICA','CLARO',48),
  ('FB - QUALIFICAÇÃO','CLARO',24),
  ('FB - REQUALIFICAÇÃO','CLARO',24),
  ('MV - ABRIR TROCA DE CARTEIRA','CLARO',48),
  ('MV - AGUARDANDO ACEITE','CLARO',72),
  ('MV - AGUARDANDO BAIXA NF','CLARO',120),
  ('MV - AGUARDANDO BIOMETRIA','CLARO',24),
  ('MV - AGUARDANDO DE ACORDO','CLARO',240),
  ('MV - AGUARDANDO ENTREGA','CLARO',240),
  ('MV - AGUARDANDO ENVIO GC','CLARO',24),
  ('MV - AGUARDANDO NOTA FISCAL','CLARO',120),
  ('MV - AGUARDANDO PORTABILIDADE','CLARO',120),
  ('MV - ANÁLISE DE CRÉDITO (CPC)','CLARO',72),
  ('MV - ATIVADO 100%','CLARO',null),
  ('MV - CANCELADO','CLARO',null),
  ('MV - CONCLUÍDO INSPEÇÃO (CPO)','CLARO',24),
  ('MV - CONFECÇÃO ACEITE','CLARO',24),
  ('MV - CONFLITOS PORTABILIDADE','CLARO',120),
  ('MV - DEVOLVIDO BKO','CLARO',24),
  ('MV - DEVOLVIDO CONFECÇÃO','CLARO',24),
  ('MV - FALTA EQUIPAMENTO','CLARO',168),
  ('MV - FILA INPUT','CLARO',24),
  ('MV - INPUT EM ANDAMENTO','CLARO',24),
  ('MV - INSUCESSO DE ENTREGA','CLARO',120),
  ('MV - PENDENTE MKT','CLARO',480),
  ('MV - PENDÊNCIA COMERCIAL','CLARO',48),
  ('MV - PORTABILIDADE NEGADA','CLARO',120),
  ('MV - PRD - SUPORTE','CLARO',120),
  ('MV - PRD CORREÇÃO','CLARO',120),
  ('MV - PRD ERRO SOLAR','CLARO',24),
  ('MV - RENOVAÇÃO ANTECIPADA EM ANALISE','CLARO',72),
  ('MV - SOLICITAR RENOVAÇÃO ANTECIPADA','CLARO',24),
  ('MV - TROCA DE CARTEIRA EM ANÁLISE','CLARO',48),
  ('MV - TROCA NEGADA','CLARO',72),
  ('MV - VALIDAR ATIVAÇÃO','CLARO',null),
  ('MV - VALIDAÇÃO PENDENTE (CPC)','CLARO',48),
  ('AUDITORIA','VIVO',72),
  ('AVA - AGUARDANDO ACEITE','VIVO',72),
  ('AVA - CANCELADO','VIVO',null),
  ('AVA - INSTALADO','VIVO',null),
  ('FB - PENDÊNCIA SISTÊMICA','VIVO',120),
  ('MV - AGUARDANDO ACEITE','VIVO',72),
  ('MV - AGUARDANDO ENTREGA','VIVO',240),
  ('MV - ANÁLISE DE CRÉDITO (CPC)','VIVO',72),
  ('MV - AUDITORIA','VIVO',72),
  ('MV - CANCELADO','VIVO',null),
  ('MV - PENDÊNCIA COMERCIAL','VIVO',48)
) as x(nome, operadora, sla_horas)
join public.status_comercial_catalogo c on c.nome = x.nome
on conflict (status_id, operadora)
do update set sla_horas = excluded.sla_horas, ativo = true, updated_at = now();

-- Status sem referência específica ficam disponíveis nas duas operadoras, inicialmente Sem SLA.
insert into public.status_comercial_operadoras(status_id, operadora, sla_horas, ativo)
select c.id, o.operadora, null, true
from public.status_comercial_catalogo c
cross join (values ('CLARO'::public.operadora_enum),('VIVO'::public.operadora_enum)) o(operadora)
where not exists (
  select 1 from public.status_comercial_operadoras sco where sco.status_id = c.id
)
on conflict (status_id, operadora) do nothing;

create or replace function public.prepare_status_comercial_historico()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_catalog_nome text;
  v_actor_nome text;
  v_operadora public.operadora_enum;
  v_sla_horas integer;
  v_missing text[] := array[]::text[];
begin
  if auth.uid() is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode alterar Status Comercial.';
  end if;

  select v.operadora into v_operadora
  from public.vendas v
  where v.id = new.venda_id
    and v.deleted_at is null
    and not coalesce(v.is_deleted, false);

  if v_operadora is null then
    raise exception 'Pedido não encontrado.';
  end if;

  select c.nome, sco.sla_horas into v_catalog_nome, v_sla_horas
  from public.status_comercial_catalogo c
  join public.status_comercial_operadoras sco
    on sco.status_id = c.id
   and sco.operadora = v_operadora
   and sco.ativo = true
  where c.id = new.status_id and c.ativo = true;

  if v_catalog_nome is null then
    raise exception 'Status Comercial não disponível para a operadora %.', v_operadora;
  end if;

  if v_catalog_nome = 'MV - ATIVADO 100%' then
    select array_remove(array[
      case when v.data_recebimento is null then 'Recebimento' end,
      case when v.data_preenchimento is null then 'Preenchimento' end,
      case when v.data_aceite is null then 'Aceite' end,
      case when v.data_input is null then 'Input' end,
      case when v.data_ativacao is null then 'Ativação' end,
      case when v.data_portabilidade is null then 'Portabilidade' end,
      case when v.data_entrega is null then 'Entrega/Instalação' end
    ], null)
    into v_missing
    from public.vendas v where v.id = new.venda_id;

    if coalesce(array_length(v_missing, 1), 0) > 0 then
      raise exception 'ATIVADO_100_DATAS_PENDENTES:%', array_to_string(v_missing, '|');
    end if;
  end if;

  select coalesce(p.nome_completo, p.email) into v_actor_nome
  from public.profiles p where p.id = auth.uid();

  new.status_nome_snapshot := v_catalog_nome;
  new.user_id := auth.uid();
  new.user_nome := coalesce(v_actor_nome, auth.jwt() ->> 'email', 'Sistema');
  new.user_role := case when public.has_role(auth.uid(), 'admin'::public.app_role) then 'admin' else 'bko' end;
  new.operadora_snapshot := v_operadora;
  new.sla_horas_snapshot := v_sla_horas;
  new.created_at := coalesce(new.created_at, now());
  new.sla_inicio_em := case when v_sla_horas is null then null else new.created_at end;
  new.sla_metade_em := case when v_sla_horas is null then null else new.created_at + make_interval(secs => v_sla_horas * 1800.0) end;
  new.sla_limite_em := case when v_sla_horas is null then null else new.created_at + make_interval(hours => v_sla_horas) end;
  return new;
end;
$$;

create or replace function public.sync_venda_status_comercial_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.vendas
  set status_comercial_id = new.status_id,
      status_comercial_nome = new.status_nome_snapshot,
      status_comercial_em = new.created_at,
      sla_horas_atual = new.sla_horas_snapshot,
      sla_metade_em = new.sla_metade_em,
      sla_limite_em = new.sla_limite_em,
      ativado_100_em = case when new.status_nome_snapshot = 'MV - ATIVADO 100%' then coalesce(ativado_100_em, new.created_at) else ativado_100_em end,
      ativado_100_por = case when new.status_nome_snapshot = 'MV - ATIVADO 100%' then coalesce(ativado_100_por, new.user_id) else ativado_100_por end
  where id = new.venda_id;
  return new;
end;
$$;

drop trigger if exists trg_prepare_status_comercial_historico on public.venda_status_comercial_historico;
create trigger trg_prepare_status_comercial_historico
before insert on public.venda_status_comercial_historico
for each row execute function public.prepare_status_comercial_historico();

drop trigger if exists trg_sync_venda_status_comercial_snapshot on public.venda_status_comercial_historico;
create trigger trg_sync_venda_status_comercial_snapshot
after insert on public.venda_status_comercial_historico
for each row execute function public.sync_venda_status_comercial_snapshot();

revoke all on function public.prepare_status_comercial_historico() from public;
revoke all on function public.sync_venda_status_comercial_snapshot() from public;
