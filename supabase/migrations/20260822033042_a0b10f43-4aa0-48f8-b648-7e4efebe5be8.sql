DO $$
DECLARE
  v_cli uuid;
  v_venda uuid;
  v_cons uuid := 'eae2dabe-6081-43d0-b388-37c0099d1598'; -- consultorteste
  v_bko  uuid := '886609d4-29ec-495e-9e69-17fe09af56c3'; -- BKO Teste
  v_cons_colab uuid;
  v_bko_colab uuid;
  v_hoje date := current_date;
BEGIN
  SELECT id INTO v_cons_colab FROM public.colaboradores WHERE user_id = v_cons LIMIT 1;
  SELECT id INTO v_bko_colab  FROM public.colaboradores WHERE user_id = v_bko  LIMIT 1;

  DELETE FROM public.clientes WHERE cnpj_cpf = '99999999000199';

  INSERT INTO public.clientes (cnpj_cpf, razao_social, uf, ddd, contato, telefone, email, operadoras, observacao, consultor_id, created_by)
  VALUES ('99999999000199', 'Cliente Teste Fluxo Completo LTDA', 'SP', '16', 'João Teste', '16999990000',
          'teste.fluxo@omni.local', ARRAY['CLARO'],
          'TESTE DE FLUXO COMPLETO — Cliente criado automaticamente para teste de fluxo, performance e atualização de dashboards.',
          v_cons, v_cons)
  RETURNING id INTO v_cli;

  INSERT INTO public.vendas (
    numero, operadora, mes_ref, ano_ref, cliente_id, cliente_razao_social, cliente_cnpj,
    cliente_contato, cliente_telefone, cliente_email, cliente_uf, ddd,
    funil, etapa_id, status, tipo_pedido, produto, quantidade_linhas, valor,
    consultor_id, consultor_nome, consultor_colab_id, created_by, observacao, prioridade
  ) VALUES (
    'TESTE-FLUXO-001', 'CLARO', EXTRACT(MONTH FROM v_hoje)::smallint, EXTRACT(YEAR FROM v_hoje)::smallint,
    v_cli, 'Cliente Teste Fluxo Completo LTDA', '99999999000199',
    'João Teste', '16999990000', 'teste.fluxo@omni.local', 'SP', '16',
    'prospeccao', 'p-aguardando', 'Aguardando aceite', 'Novo', 'Banda Larga', 3, 900.00,
    v_cons, 'consultorteste', v_cons_colab, v_cons,
    'TESTE DE FLUXO COMPLETO — pedido criado automaticamente para auditoria.', 'media'
  ) RETURNING id INTO v_venda;

  -- Prospecção
  UPDATE public.vendas SET etapa_id = 'p-d1-lig' WHERE id = v_venda;
  UPDATE public.vendas SET etapa_id = 'p-proposta' WHERE id = v_venda;
  -- Follow Up
  UPDATE public.vendas SET funil = 'followup', etapa_id = 'f-proposta' WHERE id = v_venda;
  UPDATE public.vendas SET etapa_id = 'f-contrato' WHERE id = v_venda;
  -- Processos BKO + datas operacionais
  UPDATE public.vendas SET funil = 'processos_bko', etapa_id = 'bko-montar',
    bko_id = v_bko, bko_nome = 'BKO Teste', bko_colab_id = v_bko_colab WHERE id = v_venda;
  UPDATE public.vendas SET data_recebimento = v_hoje, data_preenchimento = v_hoje, data_envio = v_hoje,
    data_aceite = v_hoje, data_input = v_hoje, data_portabilidade = v_hoje + 1, data_entrega = v_hoje + 1
    WHERE id = v_venda;
  UPDATE public.vendas SET etapa_id = 'bko-assinatura' WHERE id = v_venda;
  -- Assinatura
  UPDATE public.vendas SET funil = 'assinatura', etapa_id = 'a-aguardando' WHERE id = v_venda;
  -- Finalização
  UPDATE public.vendas SET etapa_id = 'a-assinado', status_biometria = 'Concluído',
    status_pedido = 'ativado', status_pedido_obs = 'Ativado 100% (TESTE DE FLUXO COMPLETO)',
    status_pedido_user_id = v_bko, status_pedido_user_nome = 'BKO Teste', status_pedido_em = now(),
    data_ativacao = v_hoje, status = 'Ativado 100%'
    WHERE id = v_venda;

  PERFORM public.recalc_cliente_totais(v_cli);

  RAISE NOTICE 'cliente=% venda=%', v_cli, v_venda;
END $$;