CREATE OR REPLACE FUNCTION public.log_venda_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  tracked TEXT[][] := ARRAY[
    ['etapa_id','Etapa'],
    ['funil','Funil'],
    ['valor','Receita'],
    ['quantidade_linhas','Quantidade de linhas'],
    ['status','Status'],
    ['tipo_pedido','Tipo de pedido'],
    ['produto','Produto'],
    ['consultor_id','Consultor'],
    ['consultor_colab_id','Consultor (colaborador)'],
    ['bko_id','BKO'],
    ['bko_colab_id','BKO (colaborador)'],
    ['data_recebimento','Data de recebimento'],
    ['data_preenchimento','Data de preenchimento'],
    ['data_envio','Data de envio'],
    ['data_aceite','Data de aceite'],
    ['data_input','Data de input'],
    ['data_ativacao','Data de ativação'],
    ['proxima_acao','Próxima ação'],
    ['proxima_acao_data','Data da próxima ação'],
    ['observacao','Observação'],
    ['sla_status','SLA'],
    ['prioridade','Prioridade'],
    ['tem_erro','Erro'],
    ['tem_biometria','Biometria'],
    ['cliente_razao_social','Razão social'],
    ['cliente_cnpj','CNPJ'],
    ['cliente_contato','Contato do cliente'],
    ['cliente_telefone','Telefone do cliente'],
    ['cliente_email','E-mail do cliente'],
    ['cliente_uf','UF do cliente'],
    ['ddd','DDD'],
    ['status_portabilidade','Status de portabilidade'],
    ['data_portabilidade','Data de portabilidade'],
    ['status_biometria','Status de biometria'],
    ['viabilidade_fixa','Viabilidade fixa'],
    ['nota_fiscal','Nota fiscal'],
    ['cod_rastreio','Cód. rastreio'],
    ['serie','Série'],
    ['equipamentos','Equipamentos'],
    ['data_entrega','Data de entrega'],
    ['cotacao','Cotação'],
    ['numero_pedido','Número do pedido']
  ];
  campo TEXT;
  label TEXT;
  old_val TEXT;
  new_val TEXT;
  old_row JSONB;
  new_row JSONB;
  i INT;
BEGIN
  -- Definir search_path explicitamente para evitar vulnerabilidades e resolver o nome do profile
  SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = v_user;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.venda_historico (venda_id, tipo, descricao, user_id, user_nome)
    VALUES (
      NEW.id,
      'criacao'::public.historico_tipo_enum,
      'Venda criada (' || COALESCE(NEW.operadora::text, 'N/A') || ' · ' || COALESCE(NEW.cliente_razao_social, 'N/A') || ')',
      v_user,
      COALESCE(v_nome, 'Sistema')
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    old_row := to_jsonb(OLD);
    new_row := to_jsonb(NEW);

    FOR i IN 1 .. array_length(tracked, 1) LOOP
      campo := tracked[i][1];
      label := tracked[i][2];
      old_val := old_row ->> campo;
      new_val := new_row ->> campo;

      IF old_val IS DISTINCT FROM new_val THEN
        INSERT INTO public.venda_historico
          (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
        VALUES (
          NEW.id,
          (CASE campo
            WHEN 'etapa_id' THEN 'etapa'
            WHEN 'funil' THEN 'funil'
            WHEN 'valor' THEN 'valor'
            WHEN 'consultor_id' THEN 'consultor'
            WHEN 'consultor_colab_id' THEN 'consultor'
            WHEN 'bko_id' THEN 'bko'
            WHEN 'bko_colab_id' THEN 'bko'
            ELSE 'campo'
          END)::public.historico_tipo_enum,
          campo,
          COALESCE(old_val, '—'),
          COALESCE(new_val, '—'),
          label || ': ' || COALESCE(old_val, '—') || ' → ' || COALESCE(new_val, '—'),
          v_user,
          COALESCE(v_nome, 'Sistema')
        );
      END IF;
    END LOOP;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
