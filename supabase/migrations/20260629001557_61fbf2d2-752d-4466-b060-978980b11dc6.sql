
-- ============== ENUM de perfis ==============
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'consultor', 'bko', 'suporte');

-- ============== Tabela profiles ==============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefone TEXT,
  operadora_default TEXT CHECK (operadora_default IN ('CLARO','VIVO')),
  avatar_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============== Tabela user_roles ==============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============== Função has_role (SECURITY DEFINER, evita recursão) ==============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ============== Função updated_at ==============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============== Policies: profiles ==============
CREATE POLICY "Usuários veem o próprio perfil"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins veem todos os perfis"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestores veem todos os perfis"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Usuário atualiza próprio perfil"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin atualiza qualquer perfil"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin cria perfis"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============== Policies: user_roles ==============
CREATE POLICY "Usuário vê os próprios roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admin vê todos os roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin gerencia roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============== Trigger: criar perfil no signup + primeiro usuário vira admin ==============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, email, nome_completo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome_completo', split_part(NEW.email, '@', 1))
  );

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first_user;

  IF is_first_user THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'consultor');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
