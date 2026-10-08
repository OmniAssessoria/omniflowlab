-- Corrige a classificação de NOVO para não confundir RENOVAÇÃO com NOVO.
-- Mantém a view isolada e sem alterar dados das vendas.

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
        when upper(trim(coalesce(v.tipo_pedido,''))) in ('NOVO','NOVA','LINHA NOVA','NOVO ACESSO','NOVA LINHA')
          or upper(trim(coalesce(v.tipo_pedido,''))) like 'NOVO %'
          or upper(trim(coalesce(v.tipo_pedido,''))) like 'NOVA %'
          then 'NOVO'
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
