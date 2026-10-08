-- Painel TV: fonte real da venda, sem mapeamento fixo G1/G2/Outros.
-- O filtro por equipe Telecom permanece pendente porque o cadastro atual
-- não possui campo confiável de equipe em profiles/colaboradores.
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
  coalesce(nullif(trim(v.produto), ''), 'Não informado') as fonte,
  coalesce(v.valor, 0)::numeric as valor,
  pa.data_assinatura
from primeira_assinatura pa
join public.vendas v on v.id = pa.venda_id
join public.profiles p
  on p.id = v.consultor_id
 and p.ativo = true
 and p.deleted_at is null
 and coalesce(p.is_deleted, false) = false
join public.user_roles ur
  on ur.user_id = v.consultor_id
 and ur.role::text = 'consultor'
where v.deleted_at is null
  and coalesce(v.is_deleted, false) = false
  and v.consultor_id is not null;

comment on view public.vw_painel_tv_telecom is
'Painel TV somente leitura. Fonte vem diretamente de vendas.produto, sem CASE/IF fixo. Contratos limitados a usuarios ativos com perfil consultor. Filtro por equipe Telecom depende de campo de equipe ainda inexistente no cadastro.';

revoke all on public.vw_painel_tv_telecom from anon, authenticated;
grant select on public.vw_painel_tv_telecom to service_role;
