-- Create RPC for transactional client/venda deletion
CREATE OR REPLACE FUNCTION public.delete_cliente_transacional(
    p_cliente_id UUID,
    p_reason TEXT,
    p_user_id UUID,
    p_user_role public.app_role,
    p_user_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := NOW();
    v_cliente_count INT;
    v_vendas_count INT;
    v_vendas_updated INT;
    v_venda_ids UUID[];
    v_reason_cascata TEXT;
BEGIN
    -- 1. Check if client exists and is not already deleted
    SELECT count(*) INTO v_cliente_count
    FROM public.clientes
    WHERE id = p_cliente_id AND deleted_at IS NULL;

    IF v_cliente_count = 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Cliente não encontrado ou já excluído.'
        );
    END IF;

    -- 2. Identify active linked orders
    SELECT array_agg(id), count(*) INTO v_venda_ids, v_vendas_count
    FROM public.vendas
    WHERE cliente_id = p_cliente_id AND deleted_at IS NULL;

    v_vendas_count := COALESCE(v_vendas_count, 0);
    v_reason_cascata := 'Pedido excluído automaticamente pela exclusão do cliente: ' || p_reason;

    -- 3. Logical delete client
    UPDATE public.clientes
    SET 
        deleted_at = v_now,
        deleted_by = p_user_id,
        deleted_by_role = p_user_role,
        deletion_reason = p_reason,
        is_deleted = true
    WHERE id = p_cliente_id;

    -- 4. Logical delete linked orders (if any)
    IF v_vendas_count > 0 THEN
        UPDATE public.vendas
        SET 
            deleted_at = v_now,
            deleted_by = p_user_id,
            deleted_by_role = p_user_role,
            deletion_reason = v_reason_cascata,
            is_deleted = true
        WHERE id = ANY(v_venda_ids);

        GET DIAGNOSTICS v_vendas_updated = ROW_COUNT;

        -- Logical delete linked tickets
        UPDATE public.tickets
        SET 
            deleted_at = v_now,
            deleted_by = p_user_id
        WHERE venda_id = ANY(v_venda_ids);

        -- Add history to all linked orders
        INSERT INTO public.venda_historico (venda_id, tipo, user_id, user_nome, descricao)
        SELECT 
            v_id, 
            'observacao', 
            p_user_id, 
            p_user_name, 
            'Pedido excluído automaticamente pela exclusão do cliente.' || chr(10) || 
            'Usuário: ' || p_user_name || chr(10) || 
            'Perfil: ' || p_user_role || chr(10) || 
            'Motivo Cliente: ' || p_reason || chr(10) || 
            'Data/hora: ' || v_now::text
        FROM unnest(v_venda_ids) AS v_id;
    ELSE
        v_vendas_updated := 0;
    END IF;

    -- 5. Validation
    IF v_vendas_updated != v_vendas_count THEN
        RAISE EXCEPTION 'Erro na exclusão em cascata: % de % pedidos atualizados.', v_vendas_updated, v_vendas_count;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'cliente_id', p_cliente_id,
        'cliente_updated', 1,
        'vendas_found', v_vendas_count,
        'vendas_updated', v_vendas_updated
    );
END;
$$;
