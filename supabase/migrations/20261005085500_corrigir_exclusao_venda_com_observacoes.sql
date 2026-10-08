-- Corrige exclusão definitiva de pedidos/clientes com observações.
-- venda_observacoes possui trigger AFTER DELETE que registra a remoção em venda_historico.
-- Se as observações forem removidas por ON DELETE CASCADE junto com a venda,
-- o histórico tenta referenciar uma venda que já está sendo excluída e viola a FK.
-- Portanto removemos observações explicitamente enquanto a venda ainda existe,
-- e só depois limpamos venda_historico e a própria venda.

create or replace function public.omni_excluir_venda_fisica(
  p_venda_id uuid,
  p_reason text,
  p_user_id uuid,
  p_user_email text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    return jsonb_build_object('success',false,'message','Pedido não encontrado ou já excluído.');
  end if;

  select coalesce(array_agg(s.id),array[]::uuid[])
    into v_solicitacao_ids
  from public.suporte_solicitacoes s
  where s.venda_id = p_venda_id;

  select coalesce(array_agg(t.id),array[]::uuid[])
    into v_ticket_ids
  from public.tickets t
  where t.venda_id = p_venda_id
     or t.solicitacao_id = any(v_solicitacao_ids);

  insert into public.audit_logs(
    user_id,user_email,acao,descricao,entidade,entidade_id,valor_anterior,valor_novo
  ) values (
    p_user_id,p_user_email,'exclusao_definitiva',
    'Pedido excluído definitivamente. Motivo: ' || p_reason,
    'venda',p_venda_id::text,to_jsonb(v_venda),null
  );

  delete from public.notificacoes n
  where n.venda_id = p_venda_id
     or n.solicitacao_id = any(v_solicitacao_ids)
     or n.ticket_id = any(v_ticket_ids);

  delete from public.tickets where id = any(v_ticket_ids);
  delete from public.suporte_solicitacoes where venda_id = p_venda_id;

  delete from public.venda_linha_doadores
  where linha_id in (
    select id from public.venda_linhas where venda_id = p_venda_id
  );

  delete from public.venda_cedentes where venda_id = p_venda_id;
  delete from public.venda_linhas where venda_id = p_venda_id;

  delete from public.ia_adm_logs where venda_id = p_venda_id;

  -- Precisa ocorrer antes de venda_historico e antes de vendas:
  -- o trigger de observações registra a remoção no histórico.
  delete from public.venda_observacoes where venda_id = p_venda_id;

  delete from public.venda_historico where venda_id = p_venda_id;

  delete from public.vendas where id = p_venda_id;
  get diagnostics v_deleted_count = row_count;

  if v_deleted_count <> 1 then
    raise exception 'O pedido não foi excluído. Nenhum registro removido.';
  end if;

  return jsonb_build_object(
    'success',true,
    'venda_id',p_venda_id,
    'deleted',v_deleted_count,
    'solicitacoes_deleted',cardinality(v_solicitacao_ids),
    'tickets_deleted',cardinality(v_ticket_ids)
  );
end;
$function$;
