
-- Atualiza Eduardo Fonseca se estiver com algum problema de visibilidade ou acesso
UPDATE public.profiles 
SET ativo = true, 
    is_deleted = false, 
    deleted_at = null, 
    must_change_password = true,
    updated_at = NOW() 
WHERE email = 'eduardo.fonseca@omni.com.br';

-- Garante que ele tenha o role admin se não tiver
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role 
FROM public.profiles 
WHERE email = 'eduardo.fonseca@omni.com.br'
ON CONFLICT (user_id, role) DO NOTHING;

-- Garante o vínculo na tabela colaboradores
INSERT INTO public.colaboradores (user_id, nome_exibicao, nome_normalizado, ativo, is_deleted, funcao, origem)
SELECT id, nome_completo, LOWER(nome_completo), true, false, 'admin', 'fix'
FROM public.profiles
WHERE email = 'eduardo.fonseca@omni.com.br'
ON CONFLICT (user_id) DO UPDATE SET
    ativo = true,
    is_deleted = false,
    deleted_at = null,
    funcao = 'admin',
    updated_at = NOW();

-- Melhora o trigger de sincronia para garantir que a função seja o role, se não houver função definida
CREATE OR REPLACE FUNCTION public.sync_profile_to_colaborador()
RETURNS TRIGGER AS $$
DECLARE
    v_role public.app_role;
BEGIN
    -- Busca o role primário
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
        user_id, 
        nome_exibicao, 
        nome_normalizado, 
        ativo, 
        is_deleted,
        funcao,
        origem
    )
    VALUES (
        NEW.id, 
        NEW.nome_completo, 
        LOWER(NEW.nome_completo), 
        COALESCE(NEW.ativo, true), 
        COALESCE(NEW.is_deleted, false),
        COALESCE(v_role::text, 'consultor'),
        'sync'
    )
    ON CONFLICT (user_id) DO UPDATE SET
        nome_exibicao = EXCLUDED.nome_exibicao,
        nome_normalizado = EXCLUDED.nome_normalizado,
        ativo = EXCLUDED.ativo,
        is_deleted = EXCLUDED.is_deleted,
        funcao = COALESCE(colaboradores.funcao, EXCLUDED.funcao),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
