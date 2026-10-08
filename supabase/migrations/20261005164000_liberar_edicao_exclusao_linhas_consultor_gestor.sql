-- Libera exclusão de linhas para Gestor e para o Consultor responsável,
-- inclusive quando o pedido já estiver concluído.
-- Não altera permissão de exclusão do pedido/cliente nem demais dados da venda.

create or replace function public.excluir_linha_venda(p_linha_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    )
  ) then
    raise exception '403: sem permissão para excluir esta linha.';
  end if;

  select p.email
    into v_user_email
  from public.profiles p
  where p.id = v_user_id;

  insert into public.audit_logs (
    user_id,
    user_email,
    acao,
    descricao,
    entidade,
    entidade_id,
    valor_anterior,
    valor_novo
  )
  values (
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
$function$;
