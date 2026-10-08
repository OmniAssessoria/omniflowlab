
-- Garantir que as restrições de RLS e validações não bloqueiem a transição BKO
-- A validação por ID de funil + ID de etapa já é garantida pelo código, 
-- mas podemos adicionar uma trigger de validação para reforçar no banco se necessário.

-- Criar trigger de log automático para mudanças de funil/etapa (opcional mas recomendado)
CREATE OR REPLACE FUNCTION public.trg_log_movimentacao_venda()
RETURNS TRIGGER AS $$
DECLARE
    v_user_nome TEXT;
BEGIN
    IF (OLD.funil <> NEW.funil OR OLD.etapa_id <> NEW.etapa_id) THEN
        -- Tenta pegar o nome do usuário da transação (via profile)
        SELECT nome_completo INTO v_user_nome FROM public.profiles WHERE id = auth.uid();
        
        INSERT INTO public.venda_historico (
            venda_id,
            tipo,
            user_id,
            user_nome,
            descricao,
            valor_anterior,
            valor_novo
        ) VALUES (
            NEW.id,
            'etapa',
            auth.uid(),
            COALESCE(v_user_nome, 'Sistema'),
            format('Alteração de Funil/Etapa: %s (%s) -> %s (%s)', OLD.funil, OLD.etapa_id, NEW.funil, NEW.etapa_id),
            format('%s|%s', OLD.funil, OLD.etapa_id),
            format('%s|%s', NEW.funil, NEW.etapa_id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_vendas_movimentacao_log ON public.vendas;
CREATE TRIGGER trg_vendas_movimentacao_log
    AFTER UPDATE ON public.vendas
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_log_movimentacao_venda();
