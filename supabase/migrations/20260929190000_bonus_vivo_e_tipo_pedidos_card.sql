-- Bônus VIVO somente nos Tipos de Pedido permitidos.
-- Corrige também o pedido OMN-1009181 removendo o tipo legado Renovação
-- da coluna múltipla de Tipos de Pedido.

update public.tipos_pedido_catalogo
set permite_bonus = (
  nome in ('Portado','Portabilidade PF/PJ','Portabilidade PJ/PJ')
)
where operadora='VIVO';

update public.vendas
set tipo_pedidos = array['Migração Plano']::text[],
    tipo_pedido = 'Migração Plano'
where numero='OMN-1009181'
  and operadora='VIVO';
