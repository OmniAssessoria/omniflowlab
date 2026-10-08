DROP INDEX IF EXISTS public.colaboradores_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS colaboradores_user_id_uniq
  ON public.colaboradores (user_id);

UPDATE public.profiles
SET ativo = true, is_deleted = false, deleted_at = NULL, deleted_by = NULL,
    deleted_by_role = NULL, deletion_reason = NULL, must_change_password = false
WHERE lower(email) = 'pablomazinesantos@gmail.com';

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role FROM public.profiles p
WHERE lower(p.email) = 'pablomazinesantos@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.colaboradores
SET ativo = true, is_deleted = false, deleted_at = NULL, deleted_by = NULL,
    deleted_by_role = NULL, deletion_reason = NULL
WHERE user_id IN (SELECT id FROM public.profiles WHERE lower(email) = 'pablomazinesantos@gmail.com');

CREATE OR REPLACE FUNCTION public.protect_super_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin(NEW.id) THEN
    IF (NEW.ativo = false AND OLD.ativo = true)
       OR (NEW.is_deleted = true AND COALESCE(OLD.is_deleted,false) = false)
       OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
      RAISE EXCEPTION 'Este é o Administrador principal do sistema e não pode ser excluído.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin' AND public.is_super_admin(OLD.user_id) THEN
    RAISE EXCEPTION 'Este é o Administrador principal do sistema e não pode ser excluído.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_role ON public.user_roles;
CREATE TRIGGER trg_protect_super_admin_role
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();

CREATE OR REPLACE FUNCTION public.delete_colaborador_transacional(
  p_colaborador_id uuid, p_reason text, p_user_id uuid, p_user_role app_role, p_user_name text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colaborador_id UUID;
  v_user_id UUID;
  v_now TIMESTAMPTZ := NOW();
  v_venda_count INT := 0;
  v_msg TEXT;
  v_is_last_admin BOOLEAN := FALSE;
  v_target_role app_role;
BEGIN
  SELECT id, user_id INTO v_colaborador_id, v_user_id
  FROM public.colaboradores
  WHERE id = p_colaborador_id OR user_id = p_colaborador_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM public.profiles WHERE id = p_colaborador_id;
      IF v_user_id IS NULL THEN
          RETURN json_build_object('success', false, 'message', 'Usuário não encontrado.');
      END IF;
      v_msg := 'Usuário excluído com sucesso. Nenhum colaborador vinculado foi encontrado.';
  ELSE
      v_msg := 'Usuário e colaborador vinculados excluídos com sucesso.';
  END IF;

  IF public.is_super_admin(v_user_id) THEN
    RETURN json_build_object('success', false, 'message', 'Este é o Administrador principal do sistema e não pode ser excluído.');
  END IF;

  SELECT role INTO v_target_role FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin' LIMIT 1;

  IF v_target_role = 'admin' THEN
    SELECT (COUNT(*) <= 1) INTO v_is_last_admin
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'admin' AND p.ativo = true AND p.is_deleted = false;

    IF v_is_last_admin THEN
       RETURN json_build_object('success', false, 'message', 'Não é possível excluir o único Administrador ativo do sistema.');
    END IF;
  END IF;

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

  INSERT INTO public.audit_logs (user_id, acao, descricao, entidade, entidade_id, valor_novo)
  VALUES (p_user_id, 'user_delete', v_msg || ' Motivo: ' || p_reason, 'profile', v_user_id,
          json_build_object('reason', p_reason, 'vendas_excluidas', v_venda_count, 'colab_id', v_colaborador_id));

  RETURN json_build_object('success', true, 'message', v_msg, 'vendas_updated', v_venda_count);
END;
$$;

INSERT INTO public.audit_logs (user_id, user_email, acao, descricao, entidade, entidade_id, valor_novo)
SELECT p.id, p.email, 'admin_restore',
  'Administrador principal restaurado. Motivo: perfil administrativo não estava acessando o sistema.',
  'profile', p.id::text,
  jsonb_build_object('ativo', true, 'is_deleted', false, 'role', 'admin')
FROM public.profiles p WHERE lower(p.email) = 'pablomazinesantos@gmail.com';