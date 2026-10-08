-- Prioridade própria para solicitações de Suporte.
-- Não reutiliza vendas.prioridade nem os IDs de etapa s-tratar/s-urgente.

alter table public.suporte_solicitacoes
  add column if not exists prioridade text;

update public.suporte_solicitacoes
set prioridade = 'a_tratar'
where prioridade is null or prioridade not in ('a_tratar', 'urgente');

alter table public.suporte_solicitacoes
  drop constraint if exists suporte_solicitacoes_prioridade_check;

alter table public.suporte_solicitacoes
  add constraint suporte_solicitacoes_prioridade_check
  check (prioridade in ('a_tratar', 'urgente'));

alter table public.suporte_solicitacoes
  alter column prioridade set not null;

-- Substitui a implementação anterior pela assinatura canônica com prioridade explícita.
-- A assinatura de dois argumentos é recriada no final como ponte temporária de rollout.
drop function if exists public.criar_solicitacao_suporte(uuid, text);

create or replace function public.criar_solicitacao_suporte(
  p_venda_id uuid,
  p_motivo text,
  p_prioridade text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_solicitacao_id uuid;
  v_nome text;
  v_role text;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado';
  end if;

  if not exists (
    select 1 from public.pipeline_funis where id = 'suporte' and ativo
  ) then
    raise exception 'O funil Suporte está desativado em Configurações → Estrutura.';
  end if;

  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Motivo/descrição é obrigatório.';
  end if;

  if p_prioridade not in ('a_tratar', 'urgente') then
    raise exception 'Prioridade de suporte inválida.';
  end if;

  select * into v_venda
  from public.vendas
  where id = p_venda_id
    and deleted_at is null
    and coalesce(is_deleted, false) = false;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if not (
    public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'gestor'::public.app_role)
    or (
      public.has_role(v_user_id, 'consultor'::public.app_role)
      and v_venda.consultor_id = v_user_id
    )
  ) then
    raise exception '403: sem permissão para solicitar suporte deste pedido.';
  end if;

  v_nome := public.suporte_nome_usuario(v_user_id);
  v_role := case
    when public.has_role(v_user_id, 'consultor'::public.app_role) then 'consultor'
    when public.has_role(v_user_id, 'admin'::public.app_role) then 'admin'
    else 'gestao'
  end;

  insert into public.suporte_solicitacoes (
    venda_id, criado_por, criado_por_nome, motivo, prioridade
  ) values (
    p_venda_id, v_user_id, v_nome, btrim(p_motivo), p_prioridade
  )
  returning id into v_solicitacao_id;

  perform public.suporte_registrar_evento(
    v_solicitacao_id,
    null,
    'solicitacao_criada',
    'Solicitação de suporte criada com prioridade ' ||
      case when p_prioridade = 'urgente' then 'Urgente' else 'A tratar' end || '.',
    v_user_id,
    v_role,
    jsonb_build_object('venda_id', p_venda_id, 'prioridade', p_prioridade)
  );

  return v_solicitacao_id;
end;
$$;

create or replace function public.reclassificar_prioridade_suporte(
  p_solicitacao_id uuid,
  p_prioridade text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_req public.suporte_solicitacoes%rowtype;
  v_role text;
begin
  if v_user_id is null or not (
    public.has_role(v_user_id, 'bko'::public.app_role)
    or public.has_role(v_user_id, 'admin'::public.app_role)
  ) then
    raise exception '403: somente BKO ou Admin pode reclassificar prioridade de suporte.';
  end if;

  if p_prioridade not in ('a_tratar', 'urgente') then
    raise exception 'Prioridade de suporte inválida.';
  end if;

  select * into v_req
  from public.suporte_solicitacoes
  where id = p_solicitacao_id
  for update;

  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  if v_req.status = 'concluido' then
    raise exception 'Não é possível reclassificar uma solicitação concluída.';
  end if;

  if v_req.prioridade = p_prioridade then
    return;
  end if;

  update public.suporte_solicitacoes
  set prioridade = p_prioridade,
      updated_at = now()
  where id = v_req.id;

  v_role := case
    when public.has_role(v_user_id, 'admin'::public.app_role) then 'admin'
    else 'bko'
  end;

  perform public.suporte_registrar_evento(
    v_req.id,
    v_req.ticket_id,
    'prioridade_reclassificada',
    'Prioridade alterada de ' ||
      case when v_req.prioridade = 'urgente' then 'Urgente' else 'A tratar' end ||
      ' para ' ||
      case when p_prioridade = 'urgente' then 'Urgente' else 'A tratar' end || '.',
    v_user_id,
    v_role,
    jsonb_build_object(
      'prioridade_anterior', v_req.prioridade,
      'prioridade_nova', p_prioridade
    )
  );
end;
$$;

-- O card de suporte continua sendo criado pelo BKO. A movimentação passa a aceitar BKO e Admin.
create or replace function public.mover_card_suporte(
  p_solicitacao_id uuid,
  p_etapa_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_req public.suporte_solicitacoes%rowtype;
  v_etapa_nome text;
  v_role text;
begin
  if v_user_id is null or not (
    public.has_role(v_user_id, 'bko'::public.app_role)
    or public.has_role(v_user_id, 'admin'::public.app_role)
  ) then
    raise exception '403: somente BKO ou Admin pode movimentar cards de suporte.';
  end if;

  if not exists (
    select 1
    from public.pipeline_funis f
    join public.pipeline_etapas e on e.funil_id = f.id
    where f.id = 'suporte'
      and f.ativo
      and e.id = p_etapa_id
      and e.ativo
  ) then
    raise exception 'Etapa de suporte inválida ou desativada.';
  end if;

  select nome into v_etapa_nome
  from public.pipeline_etapas
  where id = p_etapa_id;

  select * into v_req
  from public.suporte_solicitacoes
  where id = p_solicitacao_id
  for update;

  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  if v_req.ticket_id is null then
    raise exception 'A solicitação ainda não possui card de atendimento.';
  end if;

  update public.tickets
  set etapa_suporte_id = p_etapa_id,
      status = case when p_etapa_id = 's-concluido' then 'resolvido' else 'em_atendimento' end,
      resolvido_em = case when p_etapa_id = 's-concluido' then now() else null end,
      updated_at = now()
  where id = v_req.ticket_id;

  update public.suporte_solicitacoes
  set status = case when p_etapa_id = 's-concluido' then 'concluido' else 'em_atendimento' end,
      concluido_por = case when p_etapa_id = 's-concluido' then v_user_id else null end,
      concluido_em = case when p_etapa_id = 's-concluido' then now() else null end
  where id = v_req.id;

  v_role := case
    when public.has_role(v_user_id, 'admin'::public.app_role) then 'admin'
    else 'bko'
  end;

  perform public.suporte_registrar_evento(
    v_req.id,
    v_req.ticket_id,
    case when p_etapa_id = 's-concluido' then 'concluido' else 'etapa_alterada' end,
    case
      when p_etapa_id = 's-concluido' then 'Atendimento concluído.'
      else 'Card movido para ' || v_etapa_nome || '.'
    end,
    v_user_id,
    v_role,
    jsonb_build_object('etapa_id', p_etapa_id, 'etapa_nome', v_etapa_nome)
  );
end;
$$;

revoke all on function public.criar_solicitacao_suporte(uuid, text, text) from public, anon;
revoke all on function public.reclassificar_prioridade_suporte(uuid, text) from public, anon;
revoke all on function public.mover_card_suporte(uuid, text) from public, anon;

grant execute on function public.criar_solicitacao_suporte(uuid, text, text) to authenticated;
grant execute on function public.reclassificar_prioridade_suporte(uuid, text) to authenticated;
grant execute on function public.mover_card_suporte(uuid, text) to authenticated;

-- Ponte temporária de rollout: mantém o frontend publicado anterior funcionando
-- até que a versão com prioridade explícita esteja efetivamente no ar.
create or replace function public.criar_solicitacao_suporte(
  p_venda_id uuid,
  p_motivo text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.criar_solicitacao_suporte(p_venda_id, p_motivo, 'a_tratar');
end;
$$;

revoke all on function public.criar_solicitacao_suporte(uuid, text) from public, anon;
grant execute on function public.criar_solicitacao_suporte(uuid, text) to authenticated;
