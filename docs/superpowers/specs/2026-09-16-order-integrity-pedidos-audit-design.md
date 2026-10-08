# Integridade de Pedidos e Auditoria da Listagem

## Objetivo
Corrigir inconsistências observadas na validação real do OMNI Flow Lab e reduzir campos legados na listagem de Pedidos.

## Regras

### ATIVADO 100%
- `MV - ATIVADO 100%` exige, sem exceção, as 7 datas: `data_recebimento`, `data_preenchimento`, `data_aceite`, `data_input`, `data_ativacao`, `data_portabilidade`, `data_entrega`.
- O backend continua sendo a autoridade final e deve rejeitar a gravação quando qualquer data estiver ausente.
- A interface deve fazer preflight das datas para bloquear a ação antes da tentativa de insert e explicar quais datas faltam.
- Histórico é trilha de auditoria; o estado corrente da venda deve continuar sincronizado em `vendas.status_comercial_*`.

### Totais derivados das linhas
- `vendas.quantidade_linhas` e `vendas.valor` são resumos derivados de `venda_linhas`.
- Linha cancelada não entra nos totais.
- INSERT, UPDATE e DELETE de linha devem recalcular a venda no banco.
- Se uma linha mudar de `venda_id`, venda antiga e nova devem ser recalculadas.
- Depois do total da venda, os totais do cliente devem ser recalculados.
- A migration deve fazer backfill das vendas existentes.

### Clientes / Pedidos
- SLA deve ser a primeira informação operacional da tabela.
- Remover da visualização os campos legados `vendas.status` e `status_pedido` (`Status` / `Resultado`).
- `Tipo` e `Produto` não podem usar os campos legados da venda como fonte de verdade; pertencem às linhas.
- A tabela visual deve priorizar dados operacionais e reduzir rolagem horizontal.
- CSV pode manter informações detalhadas/históricas quando fizer sentido, mas deve identificar corretamente a origem atual dos dados.

## Auditoria posterior
Depois deste lote, comparar os requisitos do upgrade operacional anterior com o comportamento realmente visível no sistema, item por item, classificando cada requisito como: funcional, presente mas não exposto, parcialmente funcional ou ausente.
