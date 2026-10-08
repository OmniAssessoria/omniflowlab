-- Painel TV: objetos isolados e somente leitura do Pipeline operacional.
alter type public.app_role add value if not exists 'telespectador';

create table if not exists public.painel_tv_metas (
  id uuid primary key default gen_random_uuid(),
  ano integer not null check (ano between 2020 and 2200),
  mes integer not null check (mes between 1 and 12),
  meta numeric not null default 0 check (meta >= 0),
  super_meta numeric not null default 0 check (super_meta >= 0),
  meta_elite numeric not null default 0 check (meta_elite >= 0),
  meta_individual numeric not null default 0 check (meta_individual >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id),
  constraint painel_tv_metas_ordem_check check (meta <= super_meta and super_meta <= meta_elite),
  constraint painel_tv_metas_mes_unique unique (ano, mes)
);

alter table public.painel_tv_metas enable row level security;

drop policy if exists painel_tv_metas_select on public.painel_tv_metas;
create policy painel_tv_metas_select
on public.painel_tv_metas for select to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text in ('admin','telespectador')
  )
);

drop policy if exists painel_tv_metas_admin_insert on public.painel_tv_metas;
create policy painel_tv_metas_admin_insert
on public.painel_tv_metas for insert to authenticated
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  )
);

drop policy if exists painel_tv_metas_admin_update on public.painel_tv_metas;
create policy painel_tv_metas_admin_update
on public.painel_tv_metas for update to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  )
)
with check (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  )
);

drop policy if exists painel_tv_metas_admin_delete on public.painel_tv_metas;
create policy painel_tv_metas_admin_delete
on public.painel_tv_metas for delete to authenticated
using (
  exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role::text = 'admin'
  )
);

create or replace view public.vw_painel_tv_consultores
with (security_barrier = true)
as
select
  p.id,
  p.nome_completo as nome,
  coalesce(nullif(initcap(c.funcao), ''), 'Consultor') as cargo,
  p.avatar_url as foto_url
from public.profiles p
join public.user_roles ur on ur.user_id = p.id and ur.role::text = 'consultor'
left join public.colaboradores c
  on c.user_id = p.id
 and c.ativo = true
 and coalesce(c.is_deleted, false) = false
where p.ativo = true
  and p.deleted_at is null
  and coalesce(p.is_deleted, false) = false;

create or replace view public.vw_painel_tv_telecom
with (security_barrier = true)
as
with primeira_assinatura as (
  select vh.venda_id, min(vh.created_at) as data_assinatura
  from public.venda_historico vh
  where vh.campo = 'movimentacao_pipeline'
    and coalesce(vh.valor_novo, '') like '%a-assinado%'
  group by vh.venda_id
)
select
  v.id,
  v.cliente_razao_social as empresa,
  v.consultor_id,
  coalesce(p.nome_completo, v.consultor_nome, 'Consultor') as consultor,
  coalesce(nullif(initcap(trim(v.produto)), ''), 'Não informado') as fonte,
  coalesce(v.valor, 0)::numeric as valor,
  pa.data_assinatura
from primeira_assinatura pa
join public.vendas v on v.id = pa.venda_id
left join public.profiles p on p.id = v.consultor_id
where v.deleted_at is null
  and coalesce(v.is_deleted, false) = false
  and v.consultor_id is not null;

comment on view public.vw_painel_tv_telecom is
'Somente leitura. Não usar para editar vendas, linhas, planos, tipos de pedido, status ou regras do Pipeline.';
comment on view public.vw_painel_tv_consultores is
'Somente leitura para o Painel TV. Lista consultores ativos sem alterar cadastro.';

revoke all on public.vw_painel_tv_telecom from anon, authenticated;
revoke all on public.vw_painel_tv_consultores from anon, authenticated;
grant select on public.vw_painel_tv_telecom to service_role;
grant select on public.vw_painel_tv_consultores to service_role;
