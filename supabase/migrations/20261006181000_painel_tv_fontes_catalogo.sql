create or replace view public.vw_painel_tv_telecom
with (security_barrier = true)
as
with primeira_assinatura as (
  select
    vh.venda_id,
    min(vh.created_at) as data_assinatura
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
  case
    when pc.grupo_compatibilidade = 'G1' then 'Móvel'
    when pc.grupo_compatibilidade = 'G2' then 'Fixa/Internet'
    else 'Outros'
  end as fonte,
  coalesce(v.valor, 0)::numeric as valor,
  pa.data_assinatura
from primeira_assinatura pa
join public.vendas v on v.id = pa.venda_id
left join public.profiles p on p.id = v.consultor_id
left join lateral (
  select cat.grupo_compatibilidade
  from public.produtos_catalogo cat
  where upper(trim(cat.nome)) = upper(trim(coalesce(v.produto, '')))
    and cat.operadora = v.operadora::text
  order by cat.ativo desc, cat.created_at desc
  limit 1
) pc on true
where v.deleted_at is null
  and coalesce(v.is_deleted, false) = false
  and v.consultor_id is not null;

comment on view public.vw_painel_tv_telecom is
'Somente leitura. Fonte é derivada do grupo de compatibilidade do catálogo: G1=Móvel, G2=Fixa/Internet, demais=Outros. Não altera vendas, linhas, planos, tipos de pedido, status ou regras do Pipeline.';

revoke all on public.vw_painel_tv_telecom from anon, authenticated;
grant select on public.vw_painel_tv_telecom to service_role;
