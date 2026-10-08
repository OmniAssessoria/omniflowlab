
-- 1. Cria colaboradores para quem não tem
INSERT INTO public.colaboradores (user_id, nome_exibicao, nome_normalizado, funcao, ativo, origem)
SELECT 
    p.id as user_id, 
    p.nome_completo as nome_exibicao, 
    lower(regexp_replace(p.nome_completo, '[^a-zA-Z0-9]', '', 'g')) as nome_normalizado,
    COALESCE(ur.role::text, 'consultor') as funcao,
    p.ativo,
    'sync_fix' as origem
FROM public.profiles p
LEFT JOIN public.colaboradores c ON c.user_id = p.id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE c.id IS NULL 
  AND p.is_deleted = false;

-- 2. Trigger para manter sincronizado ao inserir/atualizar profiles ou roles
CREATE OR REPLACE FUNCTION public.sync_profile_to_colaborador()
RETURNS TRIGGER AS $$
DECLARE
    v_role public.app_role;
    v_norm TEXT;
BEGIN
    -- Só cria/atualiza se não estiver deletado
    IF NEW.is_deleted = true THEN
        UPDATE public.colaboradores SET is_deleted = true, deleted_at = NEW.deleted_at, ativo = false WHERE user_id = NEW.id;
        RETURN NEW;
    END IF;

    -- Pega a role principal
    SELECT role INTO v_role FROM public.user_roles WHERE user_id = NEW.id LIMIT 1;
    
    -- Se não tem role ainda (pode estar sendo criado agora), assume consultor se for um profile operacional
    IF v_role IS NULL THEN
        v_role := 'consultor';
    END IF;

    v_norm := lower(regexp_replace(NEW.nome_completo, '[^a-zA-Z0-9]', '', 'g'));

    INSERT INTO public.colaboradores (user_id, nome_exibicao, nome_normalizado, funcao, ativo, origem)
    VALUES (NEW.id, NEW.nome_completo, v_norm, v_role::text, NEW.ativo, 'trigger_sync')
    ON CONFLICT (user_id) DO UPDATE 
    SET 
        nome_exibicao = EXCLUDED.nome_exibicao,
        nome_normalizado = EXCLUDED.nome_normalizado,
        funcao = EXCLUDED.funcao,
        ativo = EXCLUDED.ativo,
        is_deleted = false,
        deleted_at = NULL;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_profile_to_colab ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_colab
AFTER INSERT OR UPDATE OF nome_completo, ativo, is_deleted ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_colaborador();

-- 3. Trigger em user_roles para atualizar a função no colaborador quando a role mudar
CREATE OR REPLACE FUNCTION public.sync_role_to_colaborador()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.colaboradores 
    SET funcao = NEW.role::text 
    WHERE user_id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_role_to_colab ON public.user_roles;
CREATE TRIGGER trg_sync_role_to_colab
AFTER INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_colaborador();
