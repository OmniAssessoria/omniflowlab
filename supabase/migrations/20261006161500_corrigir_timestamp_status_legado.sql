-- Limpa timestamps legados de status_pedido que foram preenchidos por edições
-- sem troca real de status e recompõe o SLA usando somente eventos comprováveis.

alter table public.vendas disable trigger user;

with evidencias as (
  select
    v.id as venda_id,
    h.created_at as evento_em,
    h.user_id,
    h.user_nome,
    0 as prioridade
  from public.vendas v
  join public.venda_historico h
    on h.venda_id = v.id
   and h.campo = 'status_pedido'
   and nullif(btrim(coalesce(h.valor_novo, '')), '') is not null
   and lower(public.status_comercial_nome_reduzido(h.valor_novo))
       = lower(public.status_comercial_nome_reduzido(v.status_pedido))
  where v.deleted_at is null
    and not coalesce(v.is_deleted, false)
    and nullif(btrim(coalesce(v.status_pedido, '')), '') is not null

  union all

  select
    v.id,
    r.created_at,
    null::uuid,
    null::text,
    1
  from public.vendas v
  join public.venda_robo_logs r
    on (r.venda_id = v.id or (r.venda_id is null and r.venda_numero = v.numero))
   and r.campo = 'status_pedido'
   and nullif(btrim(coalesce(r.valor_novo, '')), '') is not null
   and lower(public.status_comercial_nome_reduzido(r.valor_novo))
       = lower(public.status_comercial_nome_reduzido(v.status_pedido))
  where v.deleted_at is null
    and not coalesce(v.is_deleted, false)
    and nullif(btrim(coalesce(v.status_pedido, '')), '') is not null
),
ultima_evidencia as (
  select distinct on (e.venda_id)
    e.venda_id,
    e.evento_em,
    e.user_id,
    e.user_nome,
    e.prioridade
  from evidencias e
  order by e.venda_id, e.evento_em desc, e.prioridade
)
update public.vendas v
set status_pedido_em = e.evento_em,
    status_pedido_user_id = e.user_id,
    status_pedido_user_nome = case
      when e.user_id is null then null
      when v.status_pedido_user_id = e.user_id and v.status_pedido_user_nome is not null
        then v.status_pedido_user_nome
      else e.user_nome
    end
from ultima_evidencia e
where v.id = e.venda_id;

-- Sem evento real correspondente, o horário antigo não é confiável: ele era
-- justamente o horário de alguma edição de data/informação.
update public.vendas v
set status_pedido_em = null,
    status_pedido_user_id = null,
    status_pedido_user_nome = null
where v.deleted_at is null
  and not coalesce(v.is_deleted, false)
  and nullif(btrim(coalesce(v.status_pedido, '')), '') is not null
  and not exists (
    select 1
    from public.venda_historico h
    where h.venda_id = v.id
      and h.campo = 'status_pedido'
      and lower(public.status_comercial_nome_reduzido(h.valor_novo))
          = lower(public.status_comercial_nome_reduzido(v.status_pedido))
  )
  and not exists (
    select 1
    from public.venda_robo_logs r
    where (r.venda_id = v.id or (r.venda_id is null and r.venda_numero = v.numero))
      and r.campo = 'status_pedido'
      and lower(public.status_comercial_nome_reduzido(r.valor_novo))
          = lower(public.status_comercial_nome_reduzido(v.status_pedido))
  );

-- Recompõe o relógio atual a partir de fontes com timestamp confiável:
-- Status do Pedido comprovado, Status Comercial e Status legado comprovado.
with status_pedido_evento as (
  select
    v.id as venda_id,
    v.operadora,
    v.status_pedido as status_nome,
    v.status_pedido_em as evento_em,
    'status_pedido'::text as origem
  from public.vendas v
  where v.deleted_at is null
    and not coalesce(v.is_deleted, false)
    and nullif(btrim(coalesce(v.status_pedido, '')), '') is not null
    and v.status_pedido_em is not null
),
status_comercial_evento as (
  select
    v.id as venda_id,
    v.operadora,
    v.status_comercial_nome as status_nome,
    v.status_comercial_em as evento_em,
    'status_comercial'::text as origem
  from public.vendas v
  where v.deleted_at is null
    and not coalesce(v.is_deleted, false)
    and nullif(btrim(coalesce(v.status_comercial_nome, '')), '') is not null
    and v.status_comercial_em is not null
),
status_generico_evento as (
  select distinct on (v.id)
    v.id as venda_id,
    v.operadora,
    h.valor_novo as status_nome,
    h.created_at as evento_em,
    'status'::text as origem
  from public.vendas v
  join public.venda_historico h
    on h.venda_id = v.id
   and h.campo = 'status'
   and lower(public.status_comercial_nome_reduzido(h.valor_novo))
       = lower(public.status_comercial_nome_reduzido(v.status))
  where v.deleted_at is null
    and not coalesce(v.is_deleted, false)
    and nullif(btrim(coalesce(v.status, '')), '') is not null
  order by v.id, h.created_at desc, h.id desc
),
candidatos as (
  select * from status_pedido_evento
  union all
  select * from status_comercial_evento
  union all
  select * from status_generico_evento
),
mapeados as (
  select
    c.venda_id,
    c.origem,
    c.status_nome,
    c.evento_em,
    cfg.sla_horas
  from candidatos c
  join lateral (
    select sco.sla_horas
    from public.status_comercial_operadoras sco
    join public.status_comercial_catalogo cat
      on cat.id = sco.status_id
     and cat.ativo = true
    where sco.operadora = c.operadora
      and sco.ativo = true
      and lower(public.status_comercial_nome_reduzido(coalesce(sco.nome, cat.nome)))
          = lower(public.status_comercial_nome_reduzido(c.status_nome))
    order by
      case when lower(btrim(coalesce(sco.nome, cat.nome))) = lower(btrim(c.status_nome)) then 0 else 1 end,
      sco.updated_at desc
    limit 1
  ) cfg on true
),
vigente as (
  select distinct on (m.venda_id)
    m.*
  from mapeados m
  order by
    m.venda_id,
    m.evento_em desc,
    case m.origem when 'status_pedido' then 0 when 'status_comercial' then 1 else 2 end
)
update public.vendas v
set sla_horas_atual = x.sla_horas,
    sla_metade_em = case
      when x.sla_horas is null then null
      else x.evento_em + make_interval(secs => x.sla_horas * 1800.0)
    end,
    sla_limite_em = case
      when x.sla_horas is null then null
      else x.evento_em + make_interval(hours => x.sla_horas)
    end
from vigente x
where v.id = x.venda_id;

alter table public.vendas enable trigger user;
