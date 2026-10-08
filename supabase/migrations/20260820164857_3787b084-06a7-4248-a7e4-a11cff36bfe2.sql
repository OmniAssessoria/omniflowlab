
-- Ajuste fino na função de deleção para garantir que ela aceite tanto UUID de colaborador quanto de profile
-- E que retorne a mensagem amigável solicitada.

CREATE OR REPLACE FUNCTION public.delete_colaborador_transacional(
  p_colaborador_id uuid, 
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
  v_venda_count INT := 0;
  v_msg TEXT;
  v_is_last_admin BOOLEAN := FALSE;
  v_target_role app_role;
BEGIN
  -- 1. Identifica o perfil e o colaborador
  SELECT id, user_id INTO v_colaborador_id, v_user_id 
  FROM public.colaboradores 
  WHERE id = p_colaborador_id OR user_id = p_colaborador_id
  LIMIT 1;
  
  -- Se não achou na tabela de colaboradores, tenta na de profiles
  IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM public.profiles WHERE id = p_colaborador_id;
      IF v_user_id IS NULL THEN
          RETURN json_build_object('success', false, 'message', 'Usuário não encontrado.');
      END IF;
      v_msg := 'Usuário excluído com sucesso. Nenhum colaborador vinculado foi encontrado.';
  ELSE
      v_msg := 'Usuário e colaborador vinculados excluídos com sucesso.';
  END IF;

  -- 2. Proteção do último Admin
  SELECT role INTO v_target_role FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin' LIMIT 1;
  
  IF v_target_role = 'admin' THEN
    SELECT (COUNT(*) <= 1) INTO v_is_last_admin 
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin' 
      AND p.ativo = true 
      AND p.is_deleted = false;
      
    IF v_is_last_admin THEN
       RETURN json_build_object('success', false, 'message', 'Não é possível excluir o único Administrador ativo do sistema.');
    END IF;
  END IF;

  -- 3. Exclusão lógica
  IF v_colaborador_id IS NOT NULL THEN
      UPDATE public.colaboradores 
      SET deleted_at = v_now, deleted_by = p_user_id, deleted_by_role = p_user_role, 
          deletion_reason = p_reason, is_deleted = true, ativo = false
      WHERE id = v_colaborador_id;
      
      UPDATE public.vendas
      SET deleted_at = v_now, deleted_by = p_user_id, deleted_by_role = p_user_role,
          deletion_reason = 'Exclusão cascata: ' || p_reason, is_deleted = true
      WHERE (consultor_colab_id = v_colaborador_id OR bko_colab_id = v_colaborador_id)
        AND is_deleted = false;
      
      GET DIAGNOSTICS v_venda_count = ROW_COUNT;
  END IF;

  UPDATE public.profiles
  SET deleted_at = v_now, deleted_by = p_user_id, deleted_by_role = p_user_role,
      deletion_reason = p_reason, is_deleted = true, ativo = false
  WHERE id = v_user_id;
  
  DELETE FROM public.user_roles WHERE user_id = v_user_id;

  -- 4. Auditoria
  INSERT INTO public.audit_logs (user_id, acao, descricao, entidade, entidade_id, valor_novo)
  VALUES (p_user_id, 'user_delete', v_msg || ' Motivo: ' || p_reason, 'profile', v_user_id, 
          json_build_object('reason', p_reason, 'vendas_excluidas', v_venda_count, 'colab_id', v_colaborador_id));

  RETURN json_build_object('success', true, 'message', v_msg, 'vendas_updated', v_venda_count);
END;
$function$;
