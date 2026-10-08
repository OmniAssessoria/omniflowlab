
CREATE OR REPLACE FUNCTION public.delete_colaborador_transacional(
  p_colaborador_id uuid, -- Pode ser o ID do colaborador OU o ID do perfil/usuário
  p_reason text, 
  p_user_id uuid, 
  p_user_role app_role, 
  p_user_name text
)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_colaborador_id UUID;
  v_user_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_cliente_count INT := 0;
  v_venda_count INT := 0;
  v_success BOOLEAN := FALSE;
  v_msg TEXT := 'Usuário excluído com sucesso.';
  v_is_last_admin BOOLEAN := FALSE;
  v_target_role app_role;
BEGIN
  -- 1. Identifica o perfil (user_id) e o colaborador (colaborador_id)
  -- Tenta encontrar como colaborador_id primeiro
  SELECT id, user_id INTO v_colaborador_id, v_user_id 
  FROM public.colaboradores 
  WHERE id = p_colaborador_id;
  
  IF v_colaborador_id IS NULL THEN
    -- Tenta encontrar como user_id
    SELECT id, user_id INTO v_colaborador_id, v_user_id 
    FROM public.colaboradores 
    WHERE user_id = p_colaborador_id;
    
    IF v_colaborador_id IS NULL THEN
        -- Se ainda não encontrou, talvez seja apenas um profile sem colaborador vinculado
        v_user_id := p_colaborador_id;
        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user_id) THEN
            RETURN json_build_object('success', false, 'message', 'Registro não encontrado (nem como colaborador nem como perfil).');
        END IF;
        v_msg := 'Usuário excluído com sucesso. Nenhum colaborador vinculado foi encontrado.';
    END IF;
  END IF;

  -- 2. Proteção do último Admin
  -- Verifica se o alvo é admin
  SELECT role INTO v_target_role FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin' LIMIT 1;
  
  IF v_target_role = 'admin' THEN
    SELECT (COUNT(*) = 1) INTO v_is_last_admin 
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin' 
      AND p.ativo = true 
      AND p.is_deleted = false;
      
    IF v_is_last_admin AND v_user_id = p_colaborador_id THEN
       -- Se for o mesmo ID, estamos tentando apagar o próprio ou o último admin
       RETURN json_build_object('success', false, 'message', 'Não é possível excluir o único Administrador ativo do sistema.');
    END IF;
  END IF;

  -- 3. Exclusão lógica do colaborador (se existir)
  IF v_colaborador_id IS NOT NULL THEN
      UPDATE public.colaboradores 
      SET 
        deleted_at = COALESCE(deleted_at, v_now),
        deleted_by = p_user_id,
        deleted_by_role = p_user_role,
        deletion_reason = p_reason,
        is_deleted = true,
        ativo = false
      WHERE id = v_colaborador_id;
      
      -- Cascata: Excluir vendas vinculadas ao colaborador
      UPDATE public.vendas
      SET
        deleted_at = COALESCE(deleted_at, v_now),
        deleted_by = p_user_id,
        deleted_by_role = p_user_role,
        deletion_reason = 'Exclusão do colaborador/usuário: ' || p_reason,
        is_deleted = true
      WHERE (consultor_colab_id = v_colaborador_id OR bko_colab_id = v_colaborador_id)
        AND (deleted_at IS NULL OR is_deleted = false);
      
      GET DIAGNOSTICS v_venda_count = ROW_COUNT;
  END IF;

  -- 4. Exclusão lógica do profile (se houver user_id)
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

  -- 5. Auditoria
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
    'Exclusão de usuário/colaborador ' || v_user_id || '. Motivo: ' || p_reason || ' (Origem: ' || v_msg || ')',
    'colaborador',
    COALESCE(v_colaborador_id, v_user_id),
    json_build_object(
      'reason', p_reason,
      'vendas_excluidas', v_venda_count,
      'user_id', v_user_id,
      'colab_id', v_colaborador_id,
      'msg', v_msg
    )
  );

  RETURN json_build_object(
    'success', true, 
    'message', v_msg,
    'colaborador_id', v_colaborador_id,
    'user_id', v_user_id,
    'vendas_updated', v_venda_count
  );
END;
$function$;
