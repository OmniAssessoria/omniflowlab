create or replace function public.pipeline_finalizar_pedido_cancelado(p_venda_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_now timestamptz := now();
  v_user_nome text;
  v_status_atual text;
  v_origem_status text;
  v_funil_nome text;
  v_etapa_nome text;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not public.has_role(v_user_id, 'bko'::public.app_role) then
    raise exception '403: somente BKO pode finalizar pedido cancelado.';
  end if;

  select *
    into v_venda
  from public.vendas
  where id = p_venda_id
  for update;

  if not found
     or v_venda.deleted_at is not null
     or coalesce(v_venda.is_deleted, false) then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_venda.concluido_em is not null then
    raise exception 'Pedido já está finalizado.';
  end if;

  if nullif(btrim(v_venda.status_comercial_nome), '') is not null
     and nullif(btrim(v_venda.status_pedido), '') is not null then
    if coalesce(v_venda.status_pedido_em, '-infinity'::timestamptz)
       >= coalesce(v_venda.status_comercial_em, '-infinity'::timestamptz) then
      v_status_atual := v_venda.status_pedido;
      v_origem_status := 'Robô / status do pedido';
    else
      v_status_atual := v_venda.status_comercial_nome;
      v_origem_status := 'Status Comercial manual';
    end if;
  elsif nullif(btrim(v_venda.status_pedido), '') is not null then
    v_status_atual := v_venda.status_pedido;
    v_origem_status := 'Robô / status do pedido';
  else
    v_status_atual := v_venda.status_comercial_nome;
    v_origem_status := 'Status Comercial manual';
  end if;

  if upper(coalesce(v_status_atual, '')) not like '%CANCELAD%' then
    raise exception 'O status atual do pedido não está cancelado.';
  end if;

  select nome into v_funil_nome
  from public.pipeline_funis
  where id = v_venda.funil::text;

  select nome into v_etapa_nome
  from public.pipeline_etapas
  where id = v_venda.etapa_id;

  select coalesce(nome_completo, email, 'BKO')
    into v_user_nome
  from public.profiles
  where id = v_user_id;

  update public.vendas
  set concluido_em = v_now,
      concluido_por = v_user_id
  where id = p_venda_id;

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
    'concluido_em',
    null,
    v_now::text,
    'Pedido cancelado finalizado pelo BKO e removido do Pipeline ativo.'
      || E'\nStatus preservado: ' || coalesce(v_status_atual, 'Cancelado')
      || E'\nOrigem do status: ' || coalesce(v_origem_status, 'Não identificada')
      || E'\nOrigem no Pipe: ' || coalesce(v_funil_nome, v_venda.funil::text)
      || ' → ' || coalesce(v_etapa_nome, v_venda.etapa_id),
    v_user_id,
    coalesce(v_user_nome, 'BKO')
  );

  return v_now;
end;
$function$;

revoke all on function public.pipeline_finalizar_pedido_cancelado(uuid) from public;
grant execute on function public.pipeline_finalizar_pedido_cancelado(uuid) to authenticated;
