create or replace function public.pipeline_trocar_operadora(
  p_venda_id uuid,
  p_nova_operadora text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_old_operadora public.operadora_enum;
  v_new_operadora public.operadora_enum;
  v_new_etapa text;
  v_now timestamptz := now();
  v_user_nome text;
  v_status_target record;
  v_status_can_remap boolean := false;
  v_sla_cfg record;
  v_linhas_ajustadas integer := 0;
begin
  if v_uid is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_uid, 'bko'::public.app_role)
    or public.has_role(v_uid, 'admin'::public.app_role)
  ) then
    raise exception '403: somente BKO ou Administrador podem trocar a operadora do pedido.';
  end if;

  if upper(btrim(coalesce(p_nova_operadora,''))) not in ('CLARO','VIVO') then
    raise exception 'Operadora inválida.';
  end if;

  v_new_operadora := upper(btrim(p_nova_operadora))::public.operadora_enum;

  select *
    into v_venda
  from public.vendas
  where id = p_venda_id
    and deleted_at is null
    and not coalesce(is_deleted,false)
  for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  v_old_operadora := v_venda.operadora;

  if v_old_operadora = v_new_operadora then
    raise exception 'O pedido já pertence à operadora %.', v_new_operadora;
  end if;

  v_new_etapa := v_venda.etapa_id;
  if v_new_operadora = 'VIVO'::public.operadora_enum and v_venda.etapa_id = 'a-assinado' then
    v_new_etapa := 'a-assinado-vivo';
  elsif v_new_operadora = 'CLARO'::public.operadora_enum and v_venda.etapa_id = 'a-assinado-vivo' then
    v_new_etapa := 'a-assinado';
  end if;

  if v_venda.status_comercial_id is not null then
    select o.status_id, o.nome, o.sla_horas, o.is_final
      into v_status_target
    from public.status_comercial_operadoras o
    join public.status_comercial_catalogo c
      on c.id = o.status_id
     and c.ativo = true
    where o.status_id = v_venda.status_comercial_id
      and o.operadora = v_new_operadora
      and o.ativo = true
    limit 1;

    if found then
      v_status_can_remap := true;

      if coalesce(v_status_target.is_final,false) and (
        v_venda.data_recebimento is null
        or v_venda.data_preenchimento is null
        or v_venda.data_aceite is null
        or v_venda.data_input is null
        or v_venda.data_ativacao is null
      ) then
        v_status_can_remap := false;
      end if;
    end if;
  end if;

  select sc.*
    into v_sla_cfg
  from public.sla_config sc
  where sc.etapa_id = v_new_etapa
    and (sc.operadora = v_new_operadora::text or sc.operadora is null)
    and sc.ativo = true
  order by (sc.operadora = v_new_operadora::text) desc nulls last
  limit 1;

  select coalesce(nullif(btrim(p.nome_completo),''), nullif(btrim(p.email),''), 'Usuário')
    into v_user_nome
  from public.profiles p
  where p.id = v_uid;

  update public.vendas
  set operadora = v_new_operadora,
      etapa_id = v_new_etapa,
      produto = v_venda.produto,
      tipo_pedido = v_venda.tipo_pedido,
      status_pedido = v_venda.status_pedido,
      status_pedido_obs = v_venda.status_pedido_obs,
      status_pedido_user_id = v_venda.status_pedido_user_id,
      status_pedido_user_nome = v_venda.status_pedido_user_nome,
      status_pedido_em = v_venda.status_pedido_em,
      status_comercial_id = v_venda.status_comercial_id,
      status_comercial_nome = v_venda.status_comercial_nome,
      status_comercial_em = v_venda.status_comercial_em,
      sla_horas_atual = case
        when v_status_can_remap then v_status_target.sla_horas
        else null
      end,
      sla_metade_em = case
        when v_status_can_remap and coalesce(v_status_target.sla_horas,0) > 0
          then v_now + make_interval(hours => greatest(1, ceil(v_status_target.sla_horas::numeric / 2.0)::int))
        else null
      end,
      sla_limite_em = case
        when v_status_can_remap and coalesce(v_status_target.sla_horas,0) > 0
          then v_now + make_interval(hours => v_status_target.sla_horas)
        else null
      end,
      sla_due_at = case
        when v_sla_cfg.id is null then null
        else v_now + make_interval(hours => v_sla_cfg.prazo_horas)
      end,
      sla_alerta_at = case
        when v_sla_cfg.id is null then null
        else v_now + make_interval(hours => v_sla_cfg.alerta_horas)
      end,
      sla_status_calc = case when v_sla_cfg.id is null then null else 'ok' end
  where id = p_venda_id;

  update public.venda_linhas l
  set possui_bonus = case
        when v_new_operadora = 'CLARO'::public.operadora_enum then false
        else l.possui_bonus
      end,
      bonus_gb = case
        when v_new_operadora = 'CLARO'::public.operadora_enum then null
        else l.bonus_gb
      end,
      updated_at = v_now
  where l.venda_id = p_venda_id;

  get diagnostics v_linhas_ajustadas = row_count;

  insert into public.venda_historico(
    venda_id,
    tipo,
    campo,
    valor_anterior,
    valor_novo,
    descricao,
    user_id,
    user_nome
  ) values (
    p_venda_id,
    'campo'::public.historico_tipo_enum,
    'operadora',
    v_old_operadora::text,
    v_new_operadora::text,
    'Troca de operadora: ' || v_old_operadora::text || ' → ' || v_new_operadora::text
      || '. Realizada por ' || coalesce(v_user_nome,'Usuário') || '.'
      || case when v_new_etapa is distinct from v_venda.etapa_id
              then ' Etapa ajustada: ' || v_venda.etapa_id || ' → ' || v_new_etapa || '.'
              else '' end
      || ' Tipo do pedido preservado: ' || coalesce(nullif(v_venda.tipo_pedido,''),'Não informado') || '.'
      || ' Último status preservado: ' || coalesce(nullif(v_venda.status_pedido,''), nullif(v_venda.status_comercial_nome,''), 'Não informado') || '.'
      || case
           when v_venda.status_comercial_id is null then ''
           when v_status_can_remap then ' Status comercial compatível com a nova operadora; SLA recalculado.'
           else ' Status comercial preservado como referência; o SLA comercial ficou pendente de uma seleção válida para a nova operadora.'
         end,
    v_uid,
    coalesce(v_user_nome,'Usuário')
  );

  insert into public.audit_logs(
    user_id, acao, descricao, entidade, entidade_id, valor_anterior, valor_novo
  ) values (
    v_uid,
    'operadora_pedido_alterada',
    'Troca de operadora do pedido ' || coalesce(v_venda.numero,p_venda_id::text) || ': '
      || v_old_operadora::text || ' → ' || v_new_operadora::text
      || '. Tipo e último status preservados.',
    'venda',
    p_venda_id::text,
    jsonb_build_object(
      'operadora', v_old_operadora::text,
      'etapa_id', v_venda.etapa_id,
      'produto', v_venda.produto,
      'tipo_pedido', v_venda.tipo_pedido,
      'status_pedido', v_venda.status_pedido,
      'status_pedido_em', v_venda.status_pedido_em,
      'status_comercial_id', v_venda.status_comercial_id,
      'status_comercial_nome', v_venda.status_comercial_nome
    ),
    jsonb_build_object(
      'operadora', v_new_operadora::text,
      'etapa_id', v_new_etapa,
      'produto_preservado', v_venda.produto,
      'tipo_pedido_preservado', v_venda.tipo_pedido,
      'status_pedido_preservado', v_venda.status_pedido,
      'status_comercial_preservado', v_venda.status_comercial_nome,
      'status_comercial_compativel_nova_operadora', v_status_can_remap,
      'linhas_preservadas', v_linhas_ajustadas
    )
  );

  return jsonb_build_object(
    'venda_id', p_venda_id,
    'operadora_anterior', v_old_operadora::text,
    'operadora_nova', v_new_operadora::text,
    'etapa_anterior', v_venda.etapa_id,
    'etapa_nova', v_new_etapa,
    'tipo_pedido_preservado', v_venda.tipo_pedido,
    'status_pedido_preservado', v_venda.status_pedido,
    'status_comercial_preservado', v_venda.status_comercial_nome,
    'status_comercial_compativel', v_status_can_remap,
    'linhas_preservadas', v_linhas_ajustadas
  );
end;
$function$;

revoke all on function public.pipeline_trocar_operadora(uuid,text) from public;
grant execute on function public.pipeline_trocar_operadora(uuid,text) to authenticated;

create or replace function public.excluir_venda_definitiva(
  p_venda_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado';
  end if;

  if not (
    public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'gestor'::public.app_role)
    or public.has_role(v_user_id, 'bko'::public.app_role)
  ) then
    raise exception '403: somente Admin, Gestor ou BKO pode excluir pedidos definitivamente.';
  end if;

  if v_reason is null then
    raise exception 'Motivo da exclusão é obrigatório.';
  end if;

  select p.email
    into v_user_email
  from public.profiles p
  where p.id = v_user_id;

  return public.omni_excluir_venda_fisica(
    p_venda_id,
    v_reason,
    v_user_id,
    v_user_email
  );
end;
$function$;

revoke all on function public.excluir_venda_definitiva(uuid,text) from public;
grant execute on function public.excluir_venda_definitiva(uuid,text) to authenticated;
