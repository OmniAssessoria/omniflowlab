alter table public.venda_robo_logs
  add column if not exists observacao_bko text,
  add column if not exists observacao_bko_user_id uuid,
  add column if not exists observacao_bko_user_nome text,
  add column if not exists observacao_bko_user_role text,
  add column if not exists observacao_bko_em timestamptz;

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
  v_produto_target text;
  v_tipo_target text;
  v_linhas_ajustadas integer := 0;
begin
  if v_uid is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_uid, 'bko'::public.app_role)
    or public.has_role(v_uid, 'admin'::public.app_role)
  ) then
    raise exception '403: somente BKO pode trocar a operadora do pedido.';
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

  select o.status_id, o.nome, o.sla_horas, o.is_final
    into v_status_target
  from public.status_comercial_operadoras o
  join public.status_comercial_catalogo c on c.id = o.status_id and c.ativo = true
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

  select sc.*
    into v_sla_cfg
  from public.sla_config sc
  where sc.etapa_id = v_new_etapa
    and (sc.operadora = v_new_operadora::text or sc.operadora is null)
    and sc.ativo = true
  order by (sc.operadora = v_new_operadora::text) desc nulls last
  limit 1;

  select p.nome
    into v_produto_target
  from public.produtos_catalogo p
  where p.operadora = v_new_operadora::text
    and p.ativo = true
    and lower(btrim(p.nome)) = lower(btrim(coalesce(v_venda.produto,'')))
  limit 1;

  select t.nome
    into v_tipo_target
  from public.tipos_pedido_catalogo t
  where t.operadora = v_new_operadora::text
    and t.ativo = true
    and lower(btrim(t.nome)) = lower(btrim(coalesce(v_venda.tipo_pedido,'')))
  limit 1;

  update public.vendas
  set operadora = v_new_operadora,
      etapa_id = v_new_etapa,
      produto = case
        when nullif(btrim(coalesce(v_venda.produto,'')), '') is null then v_venda.produto
        when v_produto_target is not null then v_produto_target
        else null
      end,
      tipo_pedido = case
        when nullif(btrim(coalesce(v_venda.tipo_pedido,'')), '') is null then v_venda.tipo_pedido
        when v_tipo_target is not null then v_tipo_target
        else null
      end,
      status_pedido = null,
      status_pedido_obs = null,
      status_pedido_user_id = null,
      status_pedido_user_nome = null,
      status_pedido_em = null,
      status_comercial_id = null,
      status_comercial_nome = null,
      status_comercial_em = null,
      sla_horas_atual = null,
      sla_metade_em = null,
      sla_limite_em = null,
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
  set produto = case
        when nullif(btrim(coalesce(l.produto,'')), '') is null
          or lower(btrim(l.produto)) = lower('Não informado')
          or exists (
            select 1 from public.produtos_catalogo p
            where p.operadora = v_new_operadora::text
              and p.ativo = true
              and lower(btrim(p.nome)) = lower(btrim(l.produto))
          )
        then l.produto else 'Não informado'
      end,
      tipo_produto = case
        when nullif(btrim(coalesce(l.tipo_produto,'')), '') is null
          or lower(btrim(l.tipo_produto)) = lower('Não informado')
          or exists (
            select 1 from public.tipos_pedido_catalogo t
            where t.operadora = v_new_operadora::text
              and t.ativo = true
              and lower(btrim(t.nome)) = lower(btrim(l.tipo_produto))
          )
        then l.tipo_produto else 'Não informado'
      end,
      plano = case
        when nullif(btrim(coalesce(l.plano,'')), '') is null
          or lower(btrim(l.plano)) = lower('Não informado')
          or exists (
            select 1 from public.planos_catalogo p
            where p.operadora = v_new_operadora::text
              and p.ativo = true
              and lower(btrim(p.nome)) = lower(btrim(l.plano))
          )
        then l.plano else 'Não informado'
      end,
      possui_bonus = case
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

  if v_status_can_remap then
    insert into public.venda_status_comercial_historico(
      venda_id,
      status_id,
      status_nome_snapshot,
      observacao,
      user_id,
      user_nome,
      user_role
    ) values (
      p_venda_id,
      v_status_target.status_id,
      v_status_target.nome,
      'Status reaplicado automaticamente após correção de operadora.',
      v_uid,
      coalesce((select nome_completo from public.profiles where id=v_uid), 'Usuário'),
      case when public.has_role(v_uid,'admin'::public.app_role) then 'admin' else 'bko' end
    );
  end if;

  select coalesce(nullif(btrim(p.nome_completo),''), nullif(btrim(p.email),''), 'Usuário')
    into v_user_nome
  from public.profiles p
  where p.id = v_uid;

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
    'Operadora corrigida por BKO: ' || v_old_operadora::text || ' → ' || v_new_operadora::text
      || case when v_new_etapa is distinct from v_venda.etapa_id
              then '. Etapa ajustada: ' || v_venda.etapa_id || ' → ' || v_new_etapa
              else '' end
      || '. Status automático atual reiniciado para a nova operadora.'
      || case when v_status_can_remap
              then ' Status Comercial reaplicado com o SLA da nova operadora.'
              else ' Status Comercial anterior não foi reaplicado por incompatibilidade ou validação.' end,
    v_uid,
    coalesce(v_user_nome,'Usuário')
  );

  insert into public.audit_logs(
    user_id, acao, descricao, entidade, entidade_id, valor_anterior, valor_novo
  ) values (
    v_uid,
    'operadora_pedido_alterada',
    'Operadora do pedido ' || coalesce(v_venda.numero,p_venda_id::text) || ' alterada de '
      || v_old_operadora::text || ' para ' || v_new_operadora::text,
    'venda',
    p_venda_id::text,
    jsonb_build_object(
      'operadora', v_old_operadora::text,
      'etapa_id', v_venda.etapa_id,
      'status_comercial', v_venda.status_comercial_nome,
      'status_robo', v_venda.status_pedido
    ),
    jsonb_build_object(
      'operadora', v_new_operadora::text,
      'etapa_id', v_new_etapa,
      'status_comercial_reaplicado', v_status_can_remap,
      'linhas_reprocessadas', v_linhas_ajustadas
    )
  );

  return jsonb_build_object(
    'venda_id', p_venda_id,
    'operadora_anterior', v_old_operadora::text,
    'operadora_nova', v_new_operadora::text,
    'etapa_anterior', v_venda.etapa_id,
    'etapa_nova', v_new_etapa,
    'status_comercial_reaplicado', v_status_can_remap,
    'linhas_reprocessadas', v_linhas_ajustadas
  );
end;
$function$;

revoke all on function public.pipeline_trocar_operadora(uuid,text) from public;
grant execute on function public.pipeline_trocar_operadora(uuid,text) to authenticated;

create or replace function public.atualizar_observacao_status_robo(
  p_venda_id uuid,
  p_robo_log_id uuid,
  p_observacao text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_venda_numero text;
  v_log public.venda_robo_logs%rowtype;
  v_observacao text := nullif(btrim(coalesce(p_observacao,'')), '');
  v_nome text;
  v_role text;
begin
  if v_uid is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_uid, 'admin'::public.app_role)
    or public.has_role(v_uid, 'bko'::public.app_role)
  ) then
    raise exception '403: somente BKO ou Administrador podem registrar observação em status do robô.';
  end if;

  if v_observacao is null then
    raise exception 'Informe uma observação.';
  end if;

  select numero
    into v_venda_numero
  from public.vendas
  where id = p_venda_id
    and deleted_at is null
    and not coalesce(is_deleted,false);

  if v_venda_numero is null then
    raise exception 'Pedido não encontrado.';
  end if;

  select *
    into v_log
  from public.venda_robo_logs l
  where l.id = p_robo_log_id
    and (l.venda_id = p_venda_id or l.venda_numero = v_venda_numero)
    and l.campo in ('status_pedido','status_comercial_nome','status_portabilidade','status_biometria')
  for update;

  if not found then
    raise exception 'Status automático não encontrado para este pedido.';
  end if;

  select coalesce(nullif(btrim(p.nome_completo),''), nullif(btrim(p.email),''), 'Usuário')
    into v_nome
  from public.profiles p
  where p.id = v_uid;

  v_role := case
    when public.has_role(v_uid,'admin'::public.app_role) then 'admin'
    else 'bko'
  end;

  update public.venda_robo_logs
  set observacao_bko = v_observacao,
      observacao_bko_user_id = v_uid,
      observacao_bko_user_nome = coalesce(v_nome,'Usuário'),
      observacao_bko_user_role = v_role,
      observacao_bko_em = now()
  where id = p_robo_log_id;

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
    'observacao'::public.historico_tipo_enum,
    'observacao_status_robo',
    v_log.observacao_bko,
    v_observacao,
    'Observação do status automático "' || coalesce(v_log.valor_novo, v_log.campo_label, 'Status do robô') || '" atualizada.',
    v_uid,
    coalesce(v_nome,'Usuário')
  );

  return p_robo_log_id;
end;
$function$;

revoke all on function public.atualizar_observacao_status_robo(uuid,uuid,text) from public;
grant execute on function public.atualizar_observacao_status_robo(uuid,uuid,text) to authenticated;
