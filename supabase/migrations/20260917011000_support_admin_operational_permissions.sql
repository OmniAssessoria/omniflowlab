create or replace function public.resolver_solicitacao_suporte(p_solicitacao_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_req public.suporte_solicitacoes%rowtype;
  v_actor_role text;
begin
  if v_user_id is null or not (
    public.has_role(v_user_id, 'bko'::public.app_role)
    or public.has_role(v_user_id, 'admin'::public.app_role)
  ) then
    raise exception '403: somente BKO ou Administrador pode concluir solicitações de suporte.';
  end if;

  v_actor_role := case
    when public.has_role(v_user_id, 'admin'::public.app_role) then 'admin'
    else 'bko'
  end;

  select * into v_req
  from public.suporte_solicitacoes
  where id = p_solicitacao_id
  for update;

  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  update public.suporte_solicitacoes
  set status = 'concluido',
      concluido_por = v_user_id,
      concluido_em = now()
  where id = v_req.id;

  if v_req.ticket_id is not null then
    update public.tickets
    set etapa_suporte_id = 's-concluido',
        status = 'resolvido',
        resolvido_em = now(),
        updated_at = now()
    where id = v_req.ticket_id;
  end if;

  perform public.suporte_registrar_evento(
    v_req.id,
    v_req.ticket_id,
    'concluido',
    case when v_req.ticket_id is null then 'Solicitação resolvida na triagem.' else 'Atendimento concluído.' end,
    v_user_id,
    v_actor_role,
    jsonb_build_object('resolvido_na_triagem', v_req.ticket_id is null)
  );
end;
$function$;

create or replace function public.reabrir_solicitacao_suporte(p_solicitacao_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_req public.suporte_solicitacoes%rowtype;
  v_etapa_id text;
  v_etapa_nome text;
  v_actor_role text;
begin
  if v_user_id is null or not (
    public.has_role(v_user_id, 'bko'::public.app_role)
    or public.has_role(v_user_id, 'admin'::public.app_role)
  ) then
    raise exception '403: somente BKO ou Administrador pode reabrir solicitações de suporte.';
  end if;

  v_actor_role := case
    when public.has_role(v_user_id, 'admin'::public.app_role) then 'admin'
    else 'bko'
  end;

  v_etapa_id := public.pipeline_resolve_first_stage('suporte');
  if v_etapa_id is null then
    raise exception 'O funil Suporte está desativado ou não possui etapa ativa.';
  end if;

  select nome into v_etapa_nome
  from public.pipeline_etapas
  where id = v_etapa_id;

  select * into v_req
  from public.suporte_solicitacoes
  where id = p_solicitacao_id
  for update;

  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  if v_req.ticket_id is not null then
    update public.suporte_solicitacoes
    set status = 'em_atendimento',
        concluido_por = null,
        concluido_em = null
    where id = v_req.id;

    update public.tickets
    set etapa_suporte_id = v_etapa_id,
        status = 'aberto',
        resolvido_em = null,
        updated_at = now()
    where id = v_req.ticket_id;
  else
    update public.suporte_solicitacoes
    set status = 'aguardando_criacao',
        concluido_por = null,
        concluido_em = null
    where id = v_req.id;
  end if;

  perform public.suporte_registrar_evento(
    v_req.id,
    v_req.ticket_id,
    'reaberto',
    case
      when v_req.ticket_id is null then 'Solicitação reaberta e aguardando criação do atendimento.'
      else 'Atendimento reaberto em ' || v_etapa_nome || '.'
    end,
    v_user_id,
    v_actor_role,
    jsonb_build_object(
      'etapa_id', case when v_req.ticket_id is null then null else v_etapa_id end,
      'etapa_nome', v_etapa_nome
    )
  );
end;
$function$;
