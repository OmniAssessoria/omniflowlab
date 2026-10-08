-- Moving Claro order to Follow Up
UPDATE public.vendas SET funil = 'followup', etapa_id = 'f-proposta' WHERE id = 'a206e00f-b390-4977-a1c3-171c5c240088';
INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
VALUES ('a206e00f-b390-4977-a1c3-171c5c240088', 'funil', 'funil', 'prospeccao', 'followup', 'Movido para Follow Up (Teste)', 'eae2dabe-6081-43d0-b388-37c0099d1598', 'Consultor Teste');

-- Moving Claro order to Processos BKO
UPDATE public.vendas SET funil = 'processos_bko', etapa_id = 'bko-pendente' WHERE id = 'a206e00f-b390-4977-a1c3-171c5c240088';
INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
VALUES ('a206e00f-b390-4977-a1c3-171c5c240088', 'funil', 'funil', 'followup', 'processos_bko', 'Movido para Processos BKO (Teste)', 'eae2dabe-6081-43d0-b388-37c0099d1598', 'Consultor Teste');

-- Filling BKO dates
UPDATE public.vendas SET 
    data_recebimento = '2026-08-22',
    data_preenchimento = '2026-08-22',
    data_envio = '2026-08-22',
    data_aceite = '2026-08-22',
    data_input = '2026-08-22',
    data_ativacao = '2026-08-22',
    data_portabilidade = '2026-08-23',
    data_entrega = '2026-08-23',
    status_biometria = 'concluido',
    status_pedido = 'ativado',
    funil = 'assinatura',
    etapa_id = 'a-assinado'
WHERE id = 'a206e00f-b390-4977-a1c3-171c5c240088';

INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
VALUES ('a206e00f-b390-4977-a1c3-171c5c240088', 'campo', 'status_pedido', '', 'ativado', 'Pedido ativado 100% (Teste)', '886609d4-29ec-495e-9e69-17fe09af56c3', 'BKO Teste');
