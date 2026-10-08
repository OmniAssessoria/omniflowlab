-- Cancelamento manual do atendimento/pedido por ADM ou BKO.
-- Não exclui o pedido. Mantém todos os dados e registra a ação no histórico.

create or replace function public.pipeline_cancelar_atendimento(
  p_venda_id uuid,
  p_motivo text
)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_now timestamptz := now();
  v_nome text;
  v_role text;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_funil_nome text;
  v_etapa_nome text;
  v_status_anterior text;
begin
  if v_uid is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_uid, 'admin'::public.app_role)
    or public.has_role(v_uid, 'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode cancelar o atendimento.';
  end if;

  if v_motivo is null then
    raise exception 'Informe o motivo do cancelamento.';
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

  if regexp_replace(
       translate(
         upper(btrim(coalesce(v_venda.status_pedido, ''))),
         'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
         'AAAAAEEEEIIIIOOOOOUUUUC'
       ),
       '[^A-Z0-9]+',
       '',
       'g'
     ) like '%CANCELAD%' then
    raise exception 'O atendimento já está cancelado.';
  end if;

  v_status_anterior := coalesce(
    nullif(btrim(v_venda.status_pedido), ''),
    nullif(btrim(v_venda.status_comercial_nome), ''),
    nullif(btrim(v_venda.status), ''),
    'Não informado'
  );

  select coalesce(nullif(btrim(p.nome_completo), ''), nullif(btrim(p.email), ''), 'Usuário')
    into v_nome
  from public.profiles p
  where p.id = v_uid;

  v_role := case
    when public.has_role(v_uid, 'admin'::public.app_role) then 'admin'
    else 'bko'
  end;

  select nome into v_funil_nome
  from public.pipeline_funis
  where id = v_venda.funil::text;

  select nome into v_etapa_nome
  from public.pipeline_etapas
  where id = v_venda.etapa_id;

  update public.vendas
  set status = 'CANCELADO',
      status_pedido = 'CANCELADO',
      status_pedido_obs = v_motivo,
      status_pedido_user_id = v_uid,
      status_pedido_user_nome = coalesce(v_nome, 'Usuário') || ' (' || upper(v_role) || ')',
      status_pedido_em = v_now
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
    'status'::public.historico_tipo_enum,
    'cancelar_atendimento',
    v_status_anterior,
    'CANCELADO',
    'Atendimento cancelado manualmente por ' || upper(v_role) || '.'
      || E'\nMotivo: ' || v_motivo
      || E'\nOrigem no Pipe: ' || coalesce(v_funil_nome, v_venda.funil::text)
      || ' → ' || coalesce(v_etapa_nome, v_venda.etapa_id),
    v_uid,
    coalesce(v_nome, 'Usuário')
  );

  return v_now;
end;
$function$;

revoke all on function public.pipeline_cancelar_atendimento(uuid, text) from public, anon;
grant execute on function public.pipeline_cancelar_atendimento(uuid, text) to authenticated;
