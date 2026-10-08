-- Movimentação comercial explícita, conclusão terminal e reabertura segura.
-- Concluído é estado de ciclo de vida da venda, não funil/etapa configurável.

alter table public.vendas
  add column if not exists concluido_em timestamptz,
  add column if not exists concluido_por uuid references auth.users(id) on delete set null;

create index if not exists vendas_concluido_em_idx
  on public.vendas(concluido_em)
  where deleted_at is null and coalesce(is_deleted, false) = false;

-- Pedidos concluídos preservam último funil/etapa, mas deixam de ocupar a estrutura ativa.
create or replace function public.pipeline_active_sale_count(p_funil_id text, p_etapa_id text default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.vendas v
  where v.deleted_at is null
    and coalesce(v.is_deleted, false) = false
    and v.concluido_em is null
    and coalesce(v.status_pedido, '') not in ('cancelado', 'reprovado')
    and v.etapa_id <> 's-concluido'
    and v.funil::text = p_funil_id
    and (p_etapa_id is null or v.etapa_id = p_etapa_id);
$$;

revoke all on function public.pipeline_active_sale_count(text,text) from public, anon, authenticated;
