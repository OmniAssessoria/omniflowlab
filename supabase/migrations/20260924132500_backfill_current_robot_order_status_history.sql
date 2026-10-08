-- Recupera o status operacional atual de pedidos antigos que já tinham status_pedido
-- antes do início do histórico detalhado do Robô OMNI.
-- Não inventa valor anterior: apenas cria um evento legado quando ainda não existe
-- nenhum log de status_pedido para o número do pedido.

insert into public.venda_robo_logs (
  venda_id,
  venda_numero,
  created_at,
  robo_nome,
  origem,
  acao,
  campo,
  campo_label,
  valor_anterior,
  valor_novo,
  descricao,
  detalhes
)
select
  v.id,
  v.numero,
  coalesce(v.status_pedido_em, v.updated_at, v.created_at, now()),
  'Robô OMNI',
  'registro_legado_status_atual',
  'status_atual_recuperado',
  'status_pedido',
  'Status do pedido',
  null,
  v.status_pedido,
  'Status atual do pedido recuperado do registro existente. O sistema anterior não preservou o valor anterior nem o evento original campo a campo.',
  jsonb_build_object(
    'numero_pedido', v.numero,
    'operadora', v.operadora,
    'reconstrucao_historica', true,
    'status_robo', v.status_leitura_robo,
    'observacao_reconstrucao', 'Evento legado criado para tornar visível o status atual já existente antes do histórico detalhado do robô.'
  )
from public.vendas v
where v.deleted_at is null
  and coalesce(v.is_deleted,false)=false
  and nullif(btrim(v.status_pedido),'') is not null
  and not exists (
    select 1
    from public.venda_robo_logs l
    where l.venda_numero = v.numero
      and l.campo = 'status_pedido'
  );
