-- Endurecimento de integridade concorrente da estrutura dinâmica.
-- Serializa inserts/movimentos com ativações/desativações e alinha "ativo" ao Pipeline.

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
    and coalesce(v.status_pedido, '') not in ('cancelado', 'reprovado')
    and v.etapa_id <> 's-concluido'
    and v.funil::text = p_funil_id
    and (p_etapa_id is null or v.etapa_id = p_etapa_id);
$$;

revoke all on function public.pipeline_active_sale_count(text,text) from public, anon, authenticated;

create or replace function public.pipeline_validate_venda_destination()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funil_ativo boolean;
  v_etapa_ativa boolean;
  v_etapa_funil text;
begin
  if tg_op = 'UPDATE' and new.funil = old.funil and new.etapa_id = old.etapa_id then
    return new;
  end if;

  -- FOR SHARE coordena esta escrita com RPCs administrativas que bloqueiam a linha
  -- do funil/etapa com FOR UPDATE antes de desativar/renomear.
  select f.ativo, e.ativo, e.funil_id
    into v_funil_ativo, v_etapa_ativa, v_etapa_funil
  from public.pipeline_funis f
  cross join public.pipeline_etapas e
  where f.id = new.funil::text
    and e.id = new.etapa_id
  for share of f, e;

  if not found
     or not v_funil_ativo
     or not v_etapa_ativa
     or v_etapa_funil <> new.funil::text then
    raise exception 'Destino inválido: o funil ou a etapa está desativado, ou a etapa não pertence ao funil.';
  end if;

  return new;
end;
$$;

create or replace function public.pipeline_validate_support_ticket_destination()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req_status text;
  v_funil_ativo boolean;
  v_etapa_ativa boolean;
  v_etapa_funil text;
begin
  if new.solicitacao_id is null or new.etapa_suporte_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.etapa_suporte_id is not distinct from old.etapa_suporte_id then
    return new;
  end if;

  -- Marcador técnico terminal: a solicitação é concluída primeiro pela RPC.
  select status into v_req_status
  from public.suporte_solicitacoes
  where id = new.solicitacao_id;
  if new.etapa_suporte_id = 's-concluido' and v_req_status = 'concluido' then
    return new;
  end if;

  select f.ativo, e.ativo, e.funil_id
    into v_funil_ativo, v_etapa_ativa, v_etapa_funil
  from public.pipeline_funis f
  cross join public.pipeline_etapas e
  where f.id = 'suporte'
    and e.id = new.etapa_suporte_id
  for share of f, e;

  if not found
     or not v_funil_ativo
     or not v_etapa_ativa
     or v_etapa_funil <> 'suporte' then
    raise exception 'Destino de Suporte inválido: o funil ou a etapa está desativado.';
  end if;

  return new;
end;
$$;

-- Solicitações sem card também ocupam o funil Suporte. O trigger impede a corrida
-- entre criar uma solicitação e desativar o funil no mesmo instante.
create or replace function public.pipeline_validate_support_request_enabled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ativo boolean;
begin
  select ativo into v_ativo
  from public.pipeline_funis
  where id = 'suporte'
  for share;

  if not found or not v_ativo then
    raise exception 'O funil Suporte está desativado em Configurações → Estrutura.';
  end if;
  return new;
end;
$$;

drop trigger if exists suporte_solicitacoes_validate_pipeline on public.suporte_solicitacoes;
create trigger suporte_solicitacoes_validate_pipeline
before insert on public.suporte_solicitacoes
for each row execute function public.pipeline_validate_support_request_enabled();

revoke all on function public.pipeline_validate_venda_destination() from public, anon, authenticated;
revoke all on function public.pipeline_validate_support_ticket_destination() from public, anon, authenticated;
revoke all on function public.pipeline_validate_support_request_enabled() from public, anon, authenticated;
