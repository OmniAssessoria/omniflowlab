-- Create function to validate permissions for operational dates
CREATE OR REPLACE FUNCTION public.validate_operational_date_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_consultant BOOLEAN;
  v_is_bko BOOLEAN;
  v_is_admin BOOLEAN;
  v_is_gestor BOOLEAN;
BEGIN
  -- Check roles using the security definer function has_role
  v_is_admin := public.has_role(v_user_id, 'admin');
  v_is_gestor := public.has_role(v_user_id, 'gestor');
  v_is_bko := public.has_role(v_user_id, 'bko');
  v_is_consultant := public.has_role(v_user_id, 'user');

  -- Identify operational fields
  IF (OLD.data_recebimento IS DISTINCT FROM NEW.data_recebimento OR
      OLD.data_preenchimento IS DISTINCT FROM NEW.data_preenchimento OR
      OLD.data_envio IS DISTINCT FROM NEW.data_envio OR
      OLD.data_aceite IS DISTINCT FROM NEW.data_aceite OR
      OLD.data_input IS DISTINCT FROM NEW.data_input OR
      OLD.data_ativacao IS DISTINCT FROM NEW.data_ativacao OR
      OLD.data_portabilidade IS DISTINCT FROM NEW.data_portabilidade OR
      OLD.data_entrega IS DISTINCT FROM NEW.data_entrega) THEN
    
    -- Block if consultant (and not admin/gestor/bko)
    IF v_is_consultant AND NOT (v_is_admin OR v_is_gestor OR v_is_bko) THEN
      RAISE EXCEPTION 'Você não tem permissão para editar datas operacionais. Esses campos são preenchidos pelo BKO, Gestor autorizado ou Administrador.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to vendas table
DROP TRIGGER IF EXISTS trg_validate_operational_dates ON public.vendas;
CREATE TRIGGER trg_validate_operational_dates
  BEFORE UPDATE ON public.vendas
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_operational_date_permissions();
