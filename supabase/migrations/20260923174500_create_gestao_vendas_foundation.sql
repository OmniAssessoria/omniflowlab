-- Fundação isolada da Gestão de Vendas.
-- Não altera triggers, automações ou logs do robô.
-- Escopo: Administrador e Gestor.

create table if not exists public.gestao_status_classificacao (
  id uuid primary key default gen_random_uuid(),
  status_id uuid not null references public.status_comercial_catalogo(id) on delete cascade,
  operadora public.operadora_enum not null,
  grupo_gestao text not null check (grupo_gestao in ('COMERCIAL','ASSINATURA','ADMINISTRATIVO','IMPLANTACAO','CONCLUIDO','CANCELADO','OUTROS')),
  responsabilidade text not null default 'ADMINISTRATIVO' check (responsabilidade in ('COMERCIAL','ADMINISTRATIVO','NEUTRO')),
  participa_forecast boolean not null default true,
  participa_assinatura boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(status_id, operadora)
);

alter table public.gestao_status_classificacao enable row level security;

drop policy if exists gestao_status_select on public.gestao_status_classificacao;
create policy gestao_status_select on public.gestao_status_classificacao
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
);

drop policy if exists gestao_status_manage on public.gestao_status_classificacao;
create policy gestao_status_manage on public.gestao_status_classificacao
for all to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
)
with check (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
);

insert into public.gestao_status_classificacao
  (status_id, operadora, grupo_gestao, responsabilidade, participa_forecast, participa_assinatura)
select
  sco.status_id,
  sco.operadora,
  case
    when sco.is_final then 'CONCLUIDO'
    when upper(c.nome) like '%CANCEL%' or upper(c.nome) = 'VENDA PERDIDA' then 'CANCELADO'
    when upper(c.nome) like '%ACEITE%'
      or upper(c.nome) like '%ASSIN%'
      or upper(c.nome) like '%CONFECÇÃO%'
      or upper(c.nome) like '%DE ACORDO%' then 'ASSINATURA'
    when upper(c.nome) like '%INSTALA%'
      or upper(c.nome) like '%ENTREGA%'
      or upper(c.nome) like '%PORTABILIDADE%'
      or upper(c.nome) like '%PORTIN%'
      or upper(c.nome) like '%ATIVA%'
      or upper(c.nome) like '%LOGÍSTICA%'
      or upper(c.nome) like '%CONECTADO%'
      or upper(c.nome) like '%NOTA FISCAL%'
      or upper(c.nome) like '%BAIXA NF%' then 'IMPLANTACAO'
    when upper(c.nome) like 'COM -%'
      or upper(c.nome) like '%PENDÊNCIA COMERCIAL%'
      or upper(c.nome) like '%PENDENTE CONSULTOR%'
      or upper(c.nome) like '%INTERAÇÃO COM CLIENTE%'
      or upper(c.nome) like '%AGUARDANDO INTERAÇÃO%'
      or upper(c.nome) like '%RETORNO FUTURO%' then 'COMERCIAL'
    else 'ADMINISTRATIVO'
  end,
  case
    when sco.is_final or upper(c.nome) like '%CANCEL%' or upper(c.nome) = 'VENDA PERDIDA' then 'NEUTRO'
    when upper(c.nome) like 'COM -%'
      or upper(c.nome) like '%PENDÊNCIA COMERCIAL%'
      or upper(c.nome) like '%PENDENTE CONSULTOR%'
      or upper(c.nome) like '%INTERAÇÃO COM CLIENTE%'
      or upper(c.nome) like '%AGUARDANDO INTERAÇÃO%'
      or upper(c.nome) like '%RETORNO FUTURO%'
      or upper(c.nome) like '%ACEITE%'
      or upper(c.nome) like '%ASSIN%' then 'COMERCIAL'
    else 'ADMINISTRATIVO'
  end,
  not (sco.is_final or upper(c.nome) like '%CANCEL%' or upper(c.nome) = 'VENDA PERDIDA'),
  (
    upper(c.nome) like '%ACEITE%'
    or upper(c.nome) like '%ASSIN%'
    or upper(c.nome) like '%CONFECÇÃO%'
    or upper(c.nome) like '%DE ACORDO%'
  )
from public.status_comercial_operadoras sco
join public.status_comercial_catalogo c on c.id = sco.status_id
on conflict (status_id, operadora) do nothing;

create table if not exists public.gestao_metas (
  id uuid primary key default gen_random_uuid(),
  ano_ref integer not null check (ano_ref between 2020 and 2100),
  mes_ref integer not null check (mes_ref between 1 and 12),
  consultor_id uuid null references public.profiles(id) on delete set null,
  operadora text null check (operadora is null or operadora in ('CLARO','VIVO')),
  grupo_meta text not null check (grupo_meta in ('GERAL','NP_FIXA','OUTROS')),
  valor_meta numeric(14,2) not null default 0 check (valor_meta >= 0),
  fonte text null,
  observacao text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id) on delete set null
);

create unique index if not exists gestao_metas_scope_uidx
on public.gestao_metas (
  ano_ref,
  mes_ref,
  coalesce(consultor_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(operadora, 'GERAL'),
  grupo_meta
);

alter table public.gestao_metas enable row level security;

drop policy if exists gestao_metas_select on public.gestao_metas;
create policy gestao_metas_select on public.gestao_metas
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
);

drop policy if exists gestao_metas_manage on public.gestao_metas;
create policy gestao_metas_manage on public.gestao_metas
for all to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
)
with check (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
);

insert into public.gestao_metas (ano_ref, mes_ref, operadora, grupo_meta, valor_meta, fonte, observacao)
values
  (2026, 9, null, 'GERAL', 15000, 'SIMULADOR VENDAS MÊS', 'Meta mensal consolidada da planilha de gestão'),
  (2026, 9, null, 'NP_FIXA', 4000, 'SIMULADOR VENDAS MÊS', 'Novo + Portabilidade + Fixa'),
  (2026, 9, null, 'OUTROS', 11000, 'SIMULADOR VENDAS MÊS', 'Demais tipos de venda')
on conflict do nothing;

create table if not exists public.gestao_cancelamento_motivos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  descricao text null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gestao_cancelamento_motivos enable row level security;

drop policy if exists gestao_cancelamento_motivos_select on public.gestao_cancelamento_motivos;
create policy gestao_cancelamento_motivos_select on public.gestao_cancelamento_motivos
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
);

drop policy if exists gestao_cancelamento_motivos_manage on public.gestao_cancelamento_motivos;
create policy gestao_cancelamento_motivos_manage on public.gestao_cancelamento_motivos
for all to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
)
with check (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
);

insert into public.gestao_cancelamento_motivos (codigo, nome, descricao)
values
  ('PI','PI','Código histórico recuperado da planilha'),
  ('DES','DES','Código histórico recuperado da planilha'),
  ('INAD','INAD','Código histórico recuperado da planilha'),
  ('FD','FD','Código histórico recuperado da planilha'),
  ('IS','IS','Código histórico recuperado da planilha'),
  ('INF','INF','Código histórico recuperado da planilha')
on conflict (codigo) do nothing;

create table if not exists public.gestao_cancelamentos (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid null references public.vendas(id) on delete set null,
  venda_numero text not null,
  motivo_id uuid null references public.gestao_cancelamento_motivos(id) on delete set null,
  cancelado_em timestamptz not null default now(),
  observacao text null,
  registrado_por uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(venda_numero)
);

alter table public.gestao_cancelamentos enable row level security;

drop policy if exists gestao_cancelamentos_select on public.gestao_cancelamentos;
create policy gestao_cancelamentos_select on public.gestao_cancelamentos
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
);

drop policy if exists gestao_cancelamentos_manage on public.gestao_cancelamentos;
create policy gestao_cancelamentos_manage on public.gestao_cancelamentos
for all to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
)
with check (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
);

create table if not exists public.gestao_venda_classificacao_override (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid null references public.vendas(id) on delete set null,
  venda_numero text not null unique,
  categoria_gestao text not null check (categoria_gestao in ('NOVO','PORTABILIDADE','FIXA','OUTROS')),
  grupo_meta text not null check (grupo_meta in ('NP_FIXA','OUTROS')),
  observacao text null,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gestao_venda_classificacao_override enable row level security;

drop policy if exists gestao_classificacao_select on public.gestao_venda_classificacao_override;
create policy gestao_classificacao_select on public.gestao_venda_classificacao_override
for select to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
);

drop policy if exists gestao_classificacao_manage on public.gestao_venda_classificacao_override;
create policy gestao_classificacao_manage on public.gestao_venda_classificacao_override
for all to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
)
with check (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
);

create or replace view public.vw_gestao_vendas_base
with (security_invoker = true)
as
with base as (
  select
    v.*,
    coalesce(
      o.categoria_gestao,
      case
        when upper(coalesce(v.produto,'')) like '%FIX%'
          or exists (
            select 1 from public.venda_linhas vl
            where vl.venda_id = v.id
              and (
                upper(coalesce(vl.produto,'')) like '%FIX%'
                or upper(coalesce(vl.tipo_produto,'')) like '%FIX%'
              )
          ) then 'FIXA'
        when upper(coalesce(v.tipo_pedido,'')) like '%PORT%' then 'PORTABILIDADE'
        when upper(coalesce(v.tipo_pedido,'')) like '%NOV%' then 'NOVO'
        else 'OUTROS'
      end
    ) as categoria_gestao,
    o.grupo_meta as grupo_meta_override
  from public.vendas v
  left join public.gestao_venda_classificacao_override o
    on o.venda_numero = v.numero
  where v.deleted_at is null
    and coalesce(v.is_deleted,false) = false
),
enriched as (
  select
    b.*,
    coalesce(
      b.grupo_meta_override,
      case when b.categoria_gestao in ('NOVO','PORTABILIDADE','FIXA') then 'NP_FIXA' else 'OUTROS' end
    ) as grupo_meta,
    coalesce(gsc.grupo_gestao,
      case
        when b.ativado_100_em is not null or b.concluido_em is not null then 'CONCLUIDO'
        when upper(coalesce(b.status_comercial_nome,'')) like '%CANCEL%'
          or upper(coalesce(b.status_comercial_nome,'')) = 'VENDA PERDIDA'
          or lower(coalesce(b.status_pedido,'')) in ('cancelado','reprovado') then 'CANCELADO'
        else 'OUTROS'
      end
    ) as status_grupo_gestao,
    coalesce(gsc.responsabilidade,'NEUTRO') as status_responsabilidade,
    coalesce(gsc.participa_forecast,
      not (
        b.ativado_100_em is not null
        or b.concluido_em is not null
        or upper(coalesce(b.status_comercial_nome,'')) like '%CANCEL%'
        or lower(coalesce(b.status_pedido,'')) in ('cancelado','reprovado')
      )
    ) as participa_forecast,
    coalesce(gsc.participa_assinatura,false) as participa_assinatura
  from base b
  left join public.gestao_status_classificacao gsc
    on gsc.status_id = b.status_comercial_id
   and gsc.operadora = b.operadora
)
select
  e.id, e.numero, e.operadora, e.consultor_id, e.consultor_colab_id, e.consultor_nome,
  e.bko_id, e.bko_colab_id, e.bko_nome, e.cliente_id, e.cliente_razao_social, e.cliente_cnpj,
  e.produto, e.tipo_pedido, e.valor, e.quantidade_linhas, e.mes_ref, e.ano_ref,
  e.data_recebimento, e.data_preenchimento, e.data_envio, e.data_aceite, e.data_input,
  e.data_ativacao, e.data_portabilidade, e.data_entrega, e.status_comercial_id,
  e.status_comercial_nome, e.status_comercial_em, e.status_pedido, e.created_at, e.updated_at,
  e.ativado_100_em, e.concluido_em, e.categoria_gestao, e.grupo_meta,
  e.status_grupo_gestao, e.status_responsabilidade, e.participa_forecast,
  e.participa_assinatura,
  (e.status_grupo_gestao = 'CANCELADO') as cancelada,
  (e.status_grupo_gestao = 'CONCLUIDO' or e.ativado_100_em is not null or e.concluido_em is not null) as concluida,
  coalesce(
    gc.cancelado_em,
    (
      select min(h.created_at)
      from public.venda_status_comercial_historico h
      where h.venda_id = e.id
        and (upper(h.status_nome_snapshot) like '%CANCEL%' or upper(h.status_nome_snapshot) = 'VENDA PERDIDA')
    ),
    case when lower(coalesce(e.status_pedido,'')) in ('cancelado','reprovado') then e.status_pedido_em else null end
  ) as cancelado_em,
  gcm.codigo as motivo_cancelamento_codigo,
  gcm.nome as motivo_cancelamento_nome,
  gc.observacao as cancelamento_observacao,
  case when e.data_recebimento is null then null else least(5, ((extract(day from e.data_recebimento)::int - 1) / 7) + 1) end as semana_recebimento,
  case when e.data_aceite is null then null else least(5, ((extract(day from e.data_aceite)::int - 1) / 7) + 1) end as semana_aceite
from enriched e
left join public.gestao_cancelamentos gc on gc.venda_numero = e.numero
left join public.gestao_cancelamento_motivos gcm on gcm.id = gc.motivo_id;

grant select on public.vw_gestao_vendas_base to authenticated;
