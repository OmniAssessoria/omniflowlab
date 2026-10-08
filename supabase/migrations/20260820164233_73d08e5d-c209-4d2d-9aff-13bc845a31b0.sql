
CREATE OR REPLACE FUNCTION public.delete_colaborador_transacional(p_colaborador_id uuid, p_reason text, p_user_id uuid, p_user_role app_role, p_user_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_cliente_count INT := 0;
  v_venda_count INT := 0;
BEGIN
  -- 1. Verifica se o colaborador existe (mesmo se já excluído, para permitir re-processamento se necessário, 
  -- ou simplesmente encontrar o registro)
  SELECT user_id INTO v_user_id FROM public.colaboradores WHERE id = p_colaborador_id;
  
  IF v_user_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.colaboradores WHERE id = p_colaborador_id) THEN
    RETURN json_build_object('success', false, 'message', 'Colaborador não encontrado.');
  END IF;

  -- 2. Exclusão lógica do colaborador
  UPDATE public.colaboradores 
  SET 
    deleted_at = COALESCE(deleted_at, v_now),
    deleted_by = p_user_id,
    deleted_by_role = p_user_role,
    deletion_reason = p_reason,
    is_deleted = true,
    ativo = false
  WHERE id = p_colaborador_id;

  -- 3. Exclusão lógica do profile (se houver user_id)
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET 
      deleted_at = COALESCE(deleted_at, v_now),
      deleted_by = p_user_id,
      deleted_by_role = p_user_role,
      deletion_reason = p_reason,
      is_deleted = true,
      ativo = false
    WHERE id = v_user_id;
    
    -- Remove roles para garantir bloqueio de acesso
    DELETE FROM public.user_roles WHERE user_id = v_user_id;
  END IF;

  -- 4. Cascata: Excluir vendas vinculadas
  UPDATE public.vendas
  SET
    deleted_at = COALESCE(deleted_at, v_now),
    deleted_by = p_user_id,
    deleted_by_role = p_user_role,
    deletion_reason = 'Exclusão do colaborador: ' || p_reason,
    is_deleted = true
  WHERE (consultor_colab_id = p_colaborador_id OR bko_colab_id = p_colaborador_id)
    AND (deleted_at IS NULL OR is_deleted = false);
  
  GET DIAGNOSTICS v_venda_count = ROW_COUNT;

  -- 5. Cascata: Excluir clientes vinculados (via pedidos)
  -- Como o schema de clientes é variável, vamos marcar como deletados os clientes
  -- que possuem apenas vendas desse colaborador e todas estão sendo deletadas.
  -- Por segurança, vamos apenas zerar o contador aqui já que a coluna consultor_id não existe.
  v_cliente_count := 0;

  -- 6. Auditoria
  INSERT INTO public.audit_logs (
    user_id,
    acao,
    descricao,
    entidade,
    entidade_id,
    valor_novo
  ) VALUES (
    p_user_id,
    'colaborador_delete',
    'Excluiu colaborador ' || p_colaborador_id || ' e dados vinculados. Motivo: ' || p_reason,
    'colaborador',
    p_colaborador_id,
    json_build_object(
      'reason', p_reason,
      'vendas_excluidas', v_venda_count,
      'clientes_excluidos', v_cliente_count,
      'user_id_vinculado', v_user_id
    )
  );

  RETURN json_build_object(
    'success', true, 
    'colaborador_id', p_colaborador_id,
    'vendas_updated', v_venda_count,
    'clientes_updated', v_cliente_count
  );
END;
$function$;
