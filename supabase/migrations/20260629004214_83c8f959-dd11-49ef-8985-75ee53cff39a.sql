
-- 1. Profiles: novos campos
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permissoes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id AND lower(email) = 'pablomazinesantos@gmail.com'
  );
$$;

-- 3. Audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  acao TEXT NOT NULL,
  descricao TEXT,
  entidade TEXT,
  entidade_id TEXT,
  valor_anterior JSONB,
  valor_novo JSONB,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_acao_idx ON public.audit_logs(acao);

GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_select_admin_gestor ON public.audit_logs;
CREATE POLICY audit_select_admin_gestor ON public.audit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

DROP POLICY IF EXISTS audit_insert_self ON public.audit_logs;
CREATE POLICY audit_insert_self ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 4. user_roles policies — bloqueia tocar super admin se ator não for super admin
DROP POLICY IF EXISTS "Admin can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_insert ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_update ON public.user_roles;
DROP POLICY IF EXISTS user_roles_admin_delete ON public.user_roles;

CREATE POLICY user_roles_admin_insert ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND (NOT public.is_super_admin(user_id) OR public.is_super_admin(auth.uid()))
);
CREATE POLICY user_roles_admin_update ON public.user_roles FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND (NOT public.is_super_admin(user_id) OR public.is_super_admin(auth.uid()))
);
CREATE POLICY user_roles_admin_delete ON public.user_roles FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND (NOT public.is_super_admin(user_id) OR public.is_super_admin(auth.uid()))
);

-- 5. Profiles: proteger super admin de desativação por terceiros via trigger
CREATE OR REPLACE FUNCTION public.protect_super_admin_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin(NEW.id)
     AND NOT public.is_super_admin(COALESCE(auth.uid(), NEW.id))
     AND NEW.ativo IS DISTINCT FROM OLD.ativo
     AND NEW.ativo = false THEN
    RAISE EXCEPTION 'Não é possível desativar o administrador principal';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin ON public.profiles;
CREATE TRIGGER trg_protect_super_admin
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_profile();

-- 6. handle_new_user: respeitar role passada nos metadados
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
  desired_role TEXT;
  must_change BOOLEAN;
BEGIN
  desired_role := COALESCE(NEW.raw_user_meta_data->>'role', '');
  must_change := COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, false);

  INSERT INTO public.profiles (id, email, nome_completo, must_change_password)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', split_part(NEW.email, '@', 1)),
    must_change
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;

  IF desired_role IN ('admin','gestor','consultor','bko','suporte') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, desired_role::app_role)
    ON CONFLICT DO NOTHING;
  ELSIF is_first_user OR lower(NEW.email) = 'pablomazinesantos@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'consultor')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
