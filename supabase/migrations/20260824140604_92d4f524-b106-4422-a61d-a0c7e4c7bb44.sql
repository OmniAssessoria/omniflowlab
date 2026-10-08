-- 1. Normaliza perfis antigos inválidos
UPDATE public.user_roles SET role = 'bko' WHERE role::text = 'suporte';

-- 2. Remove perfis duplicados, mantendo o principal
WITH ranked AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY CASE role
           WHEN 'admin' THEN 1 WHEN 'gestor' THEN 2 WHEN 'bko' THEN 3 WHEN 'consultor' THEN 4 ELSE 5 END) AS rn
  FROM public.user_roles
)
DELETE FROM public.user_roles ur
USING ranked r
WHERE ur.id = r.id AND r.rn > 1;

-- 3. Sincronização profile -> colaborador (inclui exclusão e reativação)
CREATE OR REPLACE FUNCTION public.sync_profile_to_colaborador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_role public.app_role;
BEGIN
    SELECT role INTO v_role FROM public.user_roles WHERE user_id = NEW.id ORDER BY (
      CASE
        WHEN role = 'admin' THEN 1
        WHEN role = 'gestor' THEN 2
        WHEN role = 'bko' THEN 3
        WHEN role = 'consultor' THEN 4
        ELSE 5
      END
    ) LIMIT 1;

    INSERT INTO public.colaboradores (
        user_id, nome_exibicao, nome_normalizado, ativo, is_deleted,
        deleted_at, deleted_by, deleted_by_role, deletion_reason, funcao, origem
    )
    VALUES (
        NEW.id, NEW.nome_completo, LOWER(NEW.nome_completo),
        COALESCE(NEW.ativo, true), COALESCE(NEW.is_deleted, false),
        NEW.deleted_at, NEW.deleted_by, NEW.deleted_by_role, NEW.deletion_reason,
        COALESCE(v_role::text, 'consultor'), 'sync'
    )
    ON CONFLICT (user_id) DO UPDATE SET
        nome_exibicao = EXCLUDED.nome_exibicao,
        nome_normalizado = EXCLUDED.nome_normalizado,
        ativo = EXCLUDED.ativo,
        is_deleted = EXCLUDED.is_deleted,
        deleted_at = EXCLUDED.deleted_at,
        deleted_by = EXCLUDED.deleted_by,
        deleted_by_role = EXCLUDED.deleted_by_role,
        deletion_reason = EXCLUDED.deletion_reason,
        funcao = COALESCE(EXCLUDED.funcao, colaboradores.funcao),
        updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- 4. Somente perfis válidos na criação automática
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF desired_role IN ('admin','gestor','consultor','bko') THEN
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
$function$;

-- 5. Reconcilia colaboradores existentes com o estado atual dos perfis
UPDATE public.colaboradores c
SET ativo = p.ativo, is_deleted = COALESCE(p.is_deleted, false),
    deleted_at = p.deleted_at, deletion_reason = p.deletion_reason,
    nome_exibicao = p.nome_completo, updated_at = NOW()
FROM public.profiles p
WHERE c.user_id = p.id
  AND (c.is_deleted IS DISTINCT FROM COALESCE(p.is_deleted, false) OR c.ativo IS DISTINCT FROM p.ativo);