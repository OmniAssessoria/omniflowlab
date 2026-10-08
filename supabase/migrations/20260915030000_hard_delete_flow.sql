-- Exclusão definitiva de linhas, pedidos e clientes.
-- A entidade é removida fisicamente do banco; a auditoria fica em audit_logs.

create or replace function public.excluir_linha_venda(p_linha_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_linha public.venda_linhas%rowtype;
  v_venda public.vendas%rowtype;
  v_deleted_count integer := 0;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado';
  end if;

  select * into v_linha
  from public.venda_linhas
  where id = p_linha_id;

  if not found then
    raise exception 'Linha não encontrada ou já excluída.';
  end if;

  select * into v_venda
  from public.vendas
  where id = v_linha.venda_id;

  if not found then
    raise exception 'Pedido vinculado não encontrado.';
  end if;

  if not (
    public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'gestor'::public.app_role)
    or public.has_role(v_user_id, 'bko'::public.app_role)
    or (
      public.has_role(v_user_id, 'consultor'::public.app_role)
      and v_venda.consultor_id = v_user_id
      and v_venda.deleted_at is null
      and coalesce(v_venda.is_deleted, false) = false
      and lower(coalesce(v_venda.funil::text, '')) <> 'concluido'
      and lower(coalesce(v_venda.etapa_id, '')) not like '%conclu%'
    )
  ) then
    raise exception '403: sem permissão para excluir esta linha.';
  end if;

  select p.email into v_user_email
  from public.profiles p
  where p.id = v_user_id;

  insert into public.audit_logs (
    user_id, user_email, acao, descricao, entidade, entidade_id, valor_anterior, valor_novo
  ) values (
    v_user_id,
    v_user_email,
    'exclusao_definitiva',
    'Linha excluída definitivamente do pedido ' || coalesce(v_venda.numero, v_venda.id::text) || '.',
    'venda_linha',
    v_linha.id::text,
    to_jsonb(v_linha),
    null
  );

  delete from public.venda_linhas
  where id = p_linha_id;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count <> 1 then
    raise exception 'A linha não foi excluída. Nenhum registro removido.';
  end if;

  return jsonb_build_object(
    'success', true,
    'linha_id', p_linha_id,
    'venda_id', v_linha.venda_id,
    'deleted', v_deleted_count
  );
end;
$$;

create or replace function public.omni_excluir_venda_fisica(
  p_venda_id uuid,
  p_reason text,
  p_user_id uuid,
  p_user_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venda public.vendas%rowtype;
  v_solicitacao_ids uuid[] := array[]::uuid[];
  v_ticket_ids uuid[] := array[]::uuid[];
  v_deleted_count integer := 0;
begin
  select * into v_venda
  from public.vendas
  where id = p_venda_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Pedido não encontrado ou já excluído.');
  end if;

  select coalesce(array_agg(s.id), array[]::uuid[])
  into v_solicitacao_ids
  from public.suporte_solicitacoes s
  where s.venda_id = p_venda_id;

  select coalesce(array_agg(t.id), array[]::uuid[])
  into v_ticket_ids
  from public.tickets t
  where t.venda_id = p_venda_id
     or t.solicitacao_id = any(v_solicitacao_ids);

  insert into public.audit_logs (
    user_id, user_email, acao, descricao, entidade, entidade_id, valor_anterior, valor_novo
  ) values (
    p_user_id,
    p_user_email,
    'exclusao_definitiva',
    'Pedido excluído definitivamente. Motivo: ' || p_reason,
    'venda',
    p_venda_id::text,
    to_jsonb(v_venda),
    null
  );

  delete from public.notificacoes n
  where n.venda_id = p_venda_id
     or n.solicitacao_id = any(v_solicitacao_ids)
     or n.ticket_id = any(v_ticket_ids);

  delete from public.tickets
  where id = any(v_ticket_ids);

  delete from public.suporte_solicitacoes
  where venda_id = p_venda_id;

  delete from public.vendas
  where id = p_venda_id;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count <> 1 then
    raise exception 'O pedido não foi excluído. Nenhum registro removido.';
  end if;

  return jsonb_build_object(
    'success', true,
    'venda_id', p_venda_id,
    'deleted', v_deleted_count,
    'solicitacoes_deleted', cardinality(v_solicitacao_ids),
    'tickets_deleted', cardinality(v_ticket_ids)
  );
end;
$$;

create or replace function public.excluir_venda_definitiva(p_venda_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  ) then
    raise exception '403: somente Admin ou Gestor pode excluir pedidos definitivamente.';
  end if;

  if v_reason is null then
    raise exception 'Motivo da exclusão é obrigatório.';
  end if;

  select p.email into v_user_email
  from public.profiles p
  where p.id = v_user_id;

  return public.omni_excluir_venda_fisica(
    p_venda_id,
    v_reason,
    v_user_id,
    v_user_email
  );
end;
$$;

create or replace function public.excluir_cliente_definitivo(p_cliente_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_reason text := nullif(btrim(p_reason), '');
  v_cliente public.clientes%rowtype;
  v_venda_ids uuid[] := array[]::uuid[];
  v_venda_id uuid;
  v_cliente_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado';
  end if;

  if not (
    public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'gestor'::public.app_role)
  ) then
    raise exception '403: somente Admin ou Gestor pode excluir clientes definitivamente.';
  end if;

  if v_reason is null then
    raise exception 'Motivo da exclusão é obrigatório.';
  end if;

  select * into v_cliente
  from public.clientes
  where id = p_cliente_id
  for update;

  if not found then
    raise exception 'Cliente não encontrado ou já excluído.';
  end if;

  select p.email into v_user_email
  from public.profiles p
  where p.id = v_user_id;

  select coalesce(array_agg(v.id), array[]::uuid[])
  into v_venda_ids
  from public.vendas v
  where v.cliente_id = p_cliente_id;

  insert into public.audit_logs (
    user_id, user_email, acao, descricao, entidade, entidade_id, valor_anterior, valor_novo
  ) values (
    v_user_id,
    v_user_email,
    'exclusao_definitiva',
    'Cliente excluído definitivamente com ' || cardinality(v_venda_ids)::text || ' pedido(s). Motivo: ' || v_reason,
    'cliente',
    p_cliente_id::text,
    to_jsonb(v_cliente),
    null
  );

  foreach v_venda_id in array v_venda_ids
  loop
    perform public.omni_excluir_venda_fisica(
      v_venda_id,
      'Exclusão definitiva do cliente: ' || v_reason,
      v_user_id,
      v_user_email
    );
  end loop;

  delete from public.clientes
  where id = p_cliente_id;
  get diagnostics v_cliente_deleted = row_count;

  if v_cliente_deleted <> 1 then
    raise exception 'O cliente não foi excluído. Nenhum registro removido.';
  end if;

  return jsonb_build_object(
    'success', true,
    'cliente_id', p_cliente_id,
    'cliente_deleted', v_cliente_deleted,
    'vendas_deleted', cardinality(v_venda_ids)
  );
end;
$$;

-- A função interna só pode ser chamada pelas RPCs acima.
revoke all on function public.omni_excluir_venda_fisica(uuid, text, uuid, text) from public, anon, authenticated;

-- O fluxo antigo de exclusão lógica de cliente deixa de ser uma RPC pública.
revoke all on function public.delete_cliente_transacional(uuid, text, uuid, public.app_role, text) from public, anon, authenticated;

grant execute on function public.excluir_linha_venda(uuid) to authenticated;
grant execute on function public.excluir_venda_definitiva(uuid, text) to authenticated;
grant execute on function public.excluir_cliente_definitivo(uuid, text) to authenticated;
