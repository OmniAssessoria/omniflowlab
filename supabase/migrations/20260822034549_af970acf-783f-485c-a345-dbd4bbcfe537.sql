-- Moving Vivo order to Processos BKO
UPDATE public.vendas SET funil = 'processos_bko', etapa_id = 'bko-pendente' WHERE id = '9499b4be-62dc-4c21-8c4f-e711d913e921';

-- Creating Ticket for Vivo order
INSERT INTO public.tickets (
    numero,
    venda_id,
    cliente_razao_social,
    cliente_cnpj,
    operadora,
    titulo,
    descricao,
    categoria,
    prioridade,
    status,
    criado_por
) VALUES (
    'CH-TESTE-001',
    '9499b4be-62dc-4c21-8c4f-e711d913e921',
    'Cliente Teste Vivo Fluxo LTDA',
    '22222222000122',
    'VIVO',
    'Problema operacional no Pedido Vivo Teste',
    'TESTE COMPLETO - Chamado criado para validar fluxo de suporte, BKO responsável, histórico e vínculo com pedido.',
    'Operacional',
    'Média',
    'aberto',
    'eae2dabe-6081-43d0-b388-37c0099d1598'
);

-- BKO assumes ticket
UPDATE public.tickets SET 
    atribuido_a = '886609d4-29ec-495e-9e69-17fe09af56c3',
    status = 'em_atendimento',
    updated_at = now()
WHERE numero = 'CH-TESTE-001';

-- BKO resolves ticket
UPDATE public.tickets SET 
    status = 'concluido',
    resolvido_em = now(),
    updated_at = now()
WHERE numero = 'CH-TESTE-001';

-- Finishing Vivo order
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
    etapa_id = 'a-assinado-vivo'
WHERE id = '9499b4be-62dc-4c21-8c4f-e711d913e921';
