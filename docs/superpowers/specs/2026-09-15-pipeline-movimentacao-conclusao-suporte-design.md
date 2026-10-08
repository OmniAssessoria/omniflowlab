# Pipeline: movimentação, conclusão e prioridade de suporte

## Objetivo
Substituir o drag-and-drop comercial por movimentação explícita e confirmada, criar encerramento comercial em Concluído com reabertura controlada e adicionar prioridade visual às solicitações de suporte sem misturar o fluxo de suporte ao pedido comercial.

## Movimentação comercial
- Remover drag-and-drop dos cards comerciais.
- Cada card terá a ação `Mover para`.
- Consultor pode mover livremente para frente ou para trás apenas entre funis comerciais que ele enxerga.
- Gestor, BKO e Admin podem mover para qualquer funil comercial ativo e qualquer etapa ativa.
- Suporte nunca aparece como destino comercial.
- O destino atual não deve ser oferecido como mudança útil.
- Toda movimentação exige confirmação mostrando origem e destino.
- Toda movimentação registra usuário, perfil, data/hora, funil/etapa anterior e novo destino.
- Se o destino ficar inativo antes da confirmação, a operação deve ser bloqueada no banco.
- Remover os filtros locais `Todos os meses` e `Consultor` da tela do Pipeline.

## Conclusão comercial
- `Concluído` é um estado terminal especial, não uma etapa comum configurável.
- Apenas BKO e Admin podem concluir pedidos.
- Conclusão permitida somente a partir de `Contrato Assinado - Claro` ou `Contrato Assinado - Vivo`.
- A ação exige confirmação explícita.
- Pedido concluído sai dos cards ativos do Pipeline, mas permanece integralmente em Pedidos.
- O Pipeline exibe apenas o contador total de concluídos, sem coluna carregada de cards.
- Concluídos não contam como cards ativos.
- Histórico registra quem concluiu, perfil, data/hora e origem.

## Reabertura
- Consultor, Gestor, BKO e Admin podem reabrir um pedido concluído se tiverem acesso ao pedido.
- Reabertura exige confirmação.
- O usuário não escolhe destino.
- O sistema resolve automaticamente o primeiro funil comercial ativo e sua primeira etapa ativa.
- Se não houver destino comercial ativo, a reabertura é bloqueada.
- Histórico registra usuário, perfil, data/hora e destino de retorno.

## Suporte
- Suporte permanece fluxo separado do pedido comercial.
- Enviar para Suporte não move o pedido comercial.
- Ao solicitar suporte, motivo e prioridade são obrigatórios.
- Prioridades disponíveis: `A tratar` e `Urgente`.
- `A tratar`: destaque laranja.
- `Urgente`: vermelho com pulsação discreta.
- A prioridade pertence à solicitação de suporte, não à venda.
- A prioridade acompanha o atendimento após o BKO criar o card.
- BKO e Admin podem movimentar cards de Suporte; a criação inicial do card permanece exclusiva do BKO.
- BKO e Admin podem reclassificar `A tratar` <-> `Urgente`.
- Toda reclassificação registra autor, perfil, data/hora, valor anterior e novo valor.

## Arquitetura
Centralizar no banco/RPC as operações de mover, concluir, reabrir e reclassificar prioridade. O frontend apenas oferece ações permitidas e confirmações. As regras de autorização, destino ativo e auditoria devem ser validadas transacionalmente no banco.

## Critérios de segurança e consistência
- Nenhuma regra crítica deve existir apenas no frontend.
- Operações devem ser atômicas e auditáveis.
- Destinos comerciais usam apenas funis/etapas ativos.
- Suporte não pode virar fallback comercial.
- O fluxo de suporte existente deve continuar independente.
- Os testes devem cobrir perfis, destinos inativos, conclusão, reabertura, prioridade e regressão do suporte.