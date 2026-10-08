# Fluxo de Solicitações e Cards de Suporte

## Objetivo
Separar definitivamente o pedido comercial do atendimento de suporte. Solicitar suporte nunca move, bloqueia ou altera o funil/etapa do pedido. A solicitação nasce vinculada ao pedido, com chat imediato, e somente um BKO pode transformar essa solicitação em um card do funil Suporte.

## Regras aprovadas
- O pedido permanece no funil e na etapa comercial em que estiver quando o consultor envia ao suporte.
- O consultor pode abrir várias solicitações simultâneas para o mesmo pedido.
- A solicitação aparece imediatamente em Meus Chamados como `Aguardando criação do atendimento`.
- O chat existe desde a criação da solicitação. Consultor e qualquer BKO podem ler e responder antes de existir card.
- Todos os BKOs enxergam todas as solicitações, cards e mensagens. Não existe propriedade exclusiva por BKO.
- Toda ação operacional registra usuário, perfil, data e hora. Mensagens exibem o autor.
- Somente BKO pode criar card, mover card no funil Suporte, concluir e reabrir.
- Ao criar o card, ele entra em `s-espera` (`Suportes em Espera`).
- A conversa da solicitação continua a mesma depois que o card é criado; não existe segundo chat.
- O BKO pode resolver uma solicitação ainda na triagem, sem criar card. O status fica `Concluído` e o chat continua aberto.
- Mensagem enviada em item concluído não reabre automaticamente. Ela apenas gera notificação.
- Quando um card concluído é reaberto, retorna para `s-espera`.
- Uma solicitação concluída sem card, quando reaberta, volta para `Aguardando criação do atendimento`.
- Mensagem de consultor notifica todos os BKOs no sininho.
- Mensagem de BKO notifica o consultor responsável/solicitante no sininho.
- O dashboard/área de suporte do BKO destaca a quantidade de solicitações aguardando criação.
- O detalhe do atendimento oferece acesso destacado ao pedido completo.
- Dados legados de tickets e da estrutura `venda_suporte_retorno` não serão apagados.

## Modelo de dados
### `suporte_solicitacoes`
Entidade que nasce no clique do consultor em Suporte.
Campos principais: `id`, `numero`, `venda_id`, `criado_por`, `criado_por_nome`, `motivo`, `status`, `ticket_id`, `card_criado_por`, `card_criado_em`, `concluido_por`, `concluido_em`, `created_at`, `updated_at`.

Status de solicitação:
- `aguardando_criacao`: sem card e ainda aberta.
- `em_atendimento`: existe card ativo no funil Suporte.
- `concluido`: resolvida, com ou sem card.

### `suporte_mensagens`
Chat único da solicitação durante todo o ciclo, antes e depois da criação do card. Campos: `solicitacao_id`, autor, nome, perfil, mensagem, anexos e data.

### `suporte_leituras`
Leitura por usuário/solicitação para sinalização de mensagens novas.

### `suporte_eventos`
Trilha de auditoria imutável: solicitação criada, card criado, movimentação, conclusão e reabertura.

### `tickets`
Mantém os tickets legados. Para o fluxo novo recebe `solicitacao_id` e `etapa_suporte_id`. O card novo não representa o pedido; representa exclusivamente o atendimento.

### `notificacoes`
Recebe `solicitacao_id` opcional para link direto. Triggers geram notificações de nova solicitação e mensagens.

## Operações atômicas
Funções PostgreSQL/RPC serão responsáveis por mudanças de estado sensíveis:
- `criar_solicitacao_suporte(venda_id, motivo)` cria a solicitação sem tocar em `vendas.funil` ou `vendas.etapa_id`.
- `criar_card_suporte(solicitacao_id)` exige BKO, cria ticket e inicia em `s-espera`.
- `mover_card_suporte(solicitacao_id, etapa_id)` exige BKO e aceita apenas etapas do funil Suporte.
- `resolver_solicitacao_suporte(solicitacao_id)` exige BKO; conclui com ou sem ticket.
- `reabrir_solicitacao_suporte(solicitacao_id)` exige BKO; card existente volta a `s-espera`, sem card volta a `aguardando_criacao`.

## Permissões
- Consultor: cria solicitação apenas para pedido próprio, vê as próprias solicitações, conversa, acompanha status.
- BKO: vê tudo, conversa, cria card, move, conclui e reabre.
- Admin/Gestor: mantêm visualização operacional existente, mas não movimentam cards de suporte.
- RLS e RPCs reforçam a regra no banco, não apenas na interface.

## Interface
### Pedido
O modal Suporte perde o seletor `Etapa no Suporte`. Mantém `Motivo / descrição`. Enviar cria a solicitação e registra no histórico do pedido, sem mover o pedido.

### Meus Chamados
Mostra solicitações aguardando criação, em atendimento e concluídas. O consultor entra no detalhe e conversa desde a criação.

### Central de Atendimentos
Mostra todas as solicitações para BKO. Itens em triagem exibem `Criar card de atendimento`. O BKO também pode resolver sem criar card.

### Funil Suporte
Passa a renderizar cards de `tickets` vinculados a `suporte_solicitacoes`, nunca registros de `vendas`. Drag-and-drop de card é permitido somente para BKO.

### Detalhe
Exibe status, etapa atual, motivo original, chat único, trilha de eventos e botão destacado `Ver pedido completo`. BKO recebe ações contextuais de criar card, concluir ou reabrir.

## Compatibilidade e legado
Tickets legados permanecem disponíveis pelas rotas existentes quando não houver `suporte_solicitacoes`. A tabela `venda_suporte_retorno` permanece intacta para auditoria/compatibilidade, mas deixa de orientar o fluxo novo.

## Critérios de aceite
1. Enviar para Suporte não altera `vendas.funil` nem `vendas.etapa_id`.
2. Solicitação aparece imediatamente para consultor e todos os BKOs.
3. Chat funciona antes da criação do card.
4. Criar card gera card em `s-espera` e preserva o chat.
5. Apenas BKO movimenta o card.
6. Resolver sem card é possível e mantém chat aberto.
7. Reabrir card concluído volta a `s-espera`.
8. Mensagem em concluído não reabre.
9. Notificações seguem consultor → todos os BKOs e BKO → consultor.
10. Build passa e o fluxo legado continua acessível.