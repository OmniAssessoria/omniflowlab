-- Retroativo do Log dos Robôs.
-- O sistema anterior não guardava os valores anteriores de cada campo.
-- Para não inventar auditoria, registramos o estado encontrado após a execução histórica.

update public.venda_robo_logs l
set
  descricao = case
    when l.origem = 'registro_legado'
      then 'Execução histórica do Robô OMNI recuperada a partir do registro existente na venda.'
    else l.descricao
  end,
  detalhes = coalesce(l.detalhes, '{}'::jsonb) || jsonb_build_object(
    'reconstrucao_historica', true,
    'observacao_reconstrucao', 'O sistema antigo não preservava o valor anterior campo a campo. Este bloco mostra o estado encontrado após a execução do robô.',
    'snapshot_pos_execucao', jsonb_strip_nulls(jsonb_build_object(
      'Recebimento', to_char(v.data_recebimento, 'DD/MM/YYYY'),
      'Preenchimento', to_char(v.data_preenchimento, 'DD/MM/YYYY'),
      'Envio', to_char(v.data_envio, 'DD/MM/YYYY'),
      'Aceite', to_char(v.data_aceite, 'DD/MM/YYYY'),
      'Input', to_char(v.data_input, 'DD/MM/YYYY'),
      'Ativação', to_char(v.data_ativacao, 'DD/MM/YYYY'),
      'Portabilidade', to_char(v.data_portabilidade, 'DD/MM/YYYY'),
      'Entrega/Instalação', to_char(v.data_entrega, 'DD/MM/YYYY'),
      'Status do pedido', v.status_pedido,
      'Status de portabilidade', v.status_portabilidade,
      'Status de biometria', v.status_biometria,
      'Código de rastreio', v.cod_rastreio,
      'Nota fiscal', v.nota_fiscal
    ))
  )
from public.vendas v
where l.venda_id = v.id
  and l.origem = 'registro_legado';
