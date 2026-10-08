GRANT UPDATE(
    data_recebimento, 
    data_preenchimento, 
    data_envio, 
    data_aceite, 
    data_input, 
    data_ativacao, 
    data_portabilidade, 
    data_entrega,
    status_pedido_user_id,
    status_pedido_user_nome,
    status_pedido_em
) ON public.vendas TO authenticated;

-- Ensure BKO can update these fields via RLS
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'vendas' AND policyname = 'BKO pode atualizar datas operacionais'
    ) THEN
        CREATE POLICY "BKO pode atualizar datas operacionais"
        ON public.vendas
        FOR UPDATE
        TO authenticated
        USING (public.has_role(auth.uid(), 'bko'))
        WITH CHECK (public.has_role(auth.uid(), 'bko'));
    END IF;
END $$;
