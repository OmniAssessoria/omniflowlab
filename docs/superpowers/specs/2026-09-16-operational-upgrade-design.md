# OMNI Flow Lab — Evolução Operacional 2026-09-16

## Objetivo

Implementar, em GitHub + Supabase, o pacote aprovado de melhorias do fluxo comercial, Status Comercial/SLA, linhas, pedidos concluídos, suporte avulso e visualizações operacionais. Lovable não será usado para desenvolvimento.

## Regras gerais

- Projeto Supabase: `jgruzxaibvjejkjjgxcu`.
- Repositório: `pablomazinesantos-cpu/omniflowlab`.
- Admin possui acesso administrativo total salvo regra explicitamente mais restritiva.
- Toda regra de permissão crítica deve existir no backend/banco além da interface.
- Histórico/auditoria deve preservar autor, data/hora e contexto da mudança.
- Pedidos concluídos não retornam ao Pipeline.

## 1. Bônus por linha VIVO

Em `venda_linhas`, vendas VIVO terão `Possui bônus?` por linha. Se `Não`, nenhum bônus é armazenado. Se `Sim`, `10 GB` ou `20 GB` é obrigatório. Consultor, Gestor, BKO e Admin podem editar. CLARO não exibe nem utiliza esse campo. Ao trocar de Sim para Não, o bônus anterior é limpo.

## 2. Restrição de movimentação do Consultor em Processos BKO

Dentro do funil `processos_bko`, Consultor só poderá ter como destinos as etapas correspondentes a:
- Pendente Consultor
- Apoio Gestão
- Troca de Carteira | Abertura de Caso

Montar Pedido, Tratativa de Suporte, Tempo para Input, Enviado para Preenchimento e Aguardando Assinatura não aparecem e não podem ser acionadas via backend pelo Consultor. Se o pedido já estiver em etapa posterior, Consultor também não o movimenta de volta. Gestor, BKO e Admin preservam suas permissões atuais.

## 3. Biometria

Validar comportamento existente: Pendente amarelo, Cancelada vermelho, Concluída verde, atualização imediata e persistência após reload. Não alterar caso já esteja correto.

## 4. Reabertura de pedido

Remover integralmente a possibilidade de reabrir pedido concluído. Remover UI e caminho técnico/RPC correspondente. Concluir continua retirando o pedido do Pipeline ativo e preservando consulta/histórico.

## 5. Pedido concluído e edição

Pedido concluído sai do Pipeline e não pertence mais a um funil ativo.
- Consultor e Gestor: somente leitura.
- BKO e Admin: continuam podendo editar o pedido necessário ao trabalho operacional, inclusive Datas do Sistema e Ativado 100%.
- Não haverá botão especial de desbloqueio nem modal “Editar pedido fechado”.
- Não haverá reabertura no Pipeline.

## 6. Remoção de Status do Pedido

Remover o bloco separado `Status do Pedido` da ficha. Acompanhamento operacional passa para Status Comercial. Campos legados podem permanecer no banco durante rollout compatível, mas deixam de ser a fonte de verdade na UI.

## 7. Observação por atualização de Status Comercial

Toda alteração de Status Comercial feita por BKO/Admin poderá incluir observação livre. Cada mudança cria novo registro histórico sem sobrescrever anteriores, guardando status, observação, usuário, perfil, data/hora e dados de SLA aplicáveis.

## 8. Ativado 100%

`MV - ATIVADO 100%` é marco comercial/financeiro, não etapa de Pipeline. Ao selecionar, abrir confirmação específica. Após confirmação, exibir selo verde luminoso/pulsante `ATIVADO 100%` próximo à Biometria. Registrar data/hora de ativação como referência futura para vendas, comissões, financeiro e relatórios.

## 9. Independência entre Concluído e Ativado 100%

- `Concluído`: encerra somente o fluxo visual/operacional do Pipeline.
- `Ativado 100%`: efetiva a venda para fins comerciais/financeiros.

Um não dispara automaticamente o outro.

## 10. Datas obrigatórias para Ativado 100%

Antes da ativação, validar as Datas do Sistema:
- Recebimento
- Preenchimento
- Aceite
- Input
- Ativação
- Portabilidade
- Entrega/Instalação

Se faltar qualquer data, bloquear Ativado 100% e listar exatamente quais faltam. BKO e Admin podem preencher/alterar essas datas. Consultor/Gestor somente visualizam.

## 11. Admin

Admin acompanha as permissões operacionais do BKO e mantém acesso administrativo total, salvo exceção explicitamente definida.

## 12. Doadores por linha

Os seguintes Tipos de Produto exigem um ou mais doadores por linha:
- Portabilidade Cruzada PF/PJ
- Transferência de Titularidade PF/PJ Pós
- Transferência de Titularidade PF/PJ Pré
- Transferência de Titularidade PJ/PJ

Antes da implementação, conferir nomes/IDs exatos no catálogo atual. Cada doador exige: nome completo, e-mail completo, telefone e operadora. Uma linha pode ter vários doadores. Dados devem ser normalizados em tabela própria ligada a `venda_linhas`.

## 13. Novo Suporte sem venda vinculada

Adicionar `Novo Suporte` ao lado de `Nova Venda`. O chamado pode nascer sem venda. Campos obrigatórios: nome completo, CNPJ, e-mail, prioridade (`A tratar` ou `Urgente`) e destino inicial (`Suportes em Espera` ou `Pré-vendas`). O sistema cria identificação própria de atendimento.

## 14. Assumir atendimento

BKO poderá `Assumir atendimento`, definindo responsável principal, sem bloquear outros BKOs. Todos os BKOs continuam podendo visualizar e atuar.

## 15. Conversa, informações e arquivos do Suporte

Consultor, BKO e Admin podem conversar. Criar área separada de `Informações do atendimento` em histórico contínuo com autor/data/hora. Criar documentos do atendimento com upload privado de até 100 MB por arquivo, seguindo tipos suportados pelos documentos de pedido (PDF, Word e imagens). Documentos pertencem ao atendimento, independente de existir venda.

## 16. Catálogo de Status Comercial por operadora

Manter catálogo único dos 89 status atuais. Criar relação Status x Operadora.
- Pedido CLARO: mostra status aplicáveis à CLARO + comuns.
- Pedido VIVO: mostra status aplicáveis à VIVO + comuns.
- Status pode ser CLARO, VIVO ou ambas.

O material administrativo aprovado traz 44 referências Claro, 11 referências Vivo e 43 sem referência nas duas tabelas. Há sobreposição entre Claro/Vivo, portanto não duplicar o catálogo base.

## 17. SLA por Status + Operadora

SLA pertence à combinação `status comercial + operadora`, pois o mesmo status pode ter prazos diferentes por operadora. Exemplos confirmados:
- AUDITORIA: CLARO 24h; VIVO 72h.
- FB - PENDÊNCIA SISTÊMICA: CLARO 48h; VIVO 120h.

Status pode existir sem SLA.

## 18. Configurações > SLA

Substituir o modelo atual por funil/etapa por uma administração orientada a Status Comercial. Exibir todos os 89 status e permitir filtrar/organizar por CLARO, VIVO e Ambas. Para cada operadora aplicável, permitir definir SLA em horas ou Sem SLA. O Admin configura a estrutura. Dados atuais do material de SLA devem ser carregados como seed/migração.

## 19. Semáforo de SLA

Ao selecionar um Status Comercial com SLA:
- 0% até antes de 50% do prazo: verde.
- a partir de 50% até 100%: laranja.
- acima de 100%: vermelho.
- Sem SLA: neutro.

Cada troca de status encerra o ciclo anterior e inicia um novo. Voltar ao mesmo status no futuro cria novo ciclo. Histórico permanece intacto.

Para consulta rápida, a venda mantém snapshot do Status Comercial/SLA atual, enquanto o histórico é a fonte de auditoria.

## 20. SLA no card do Pipeline

Mostrar indicador circular de SLA no card do pedido: verde, laranja ou vermelho. Sem SLA usa estado neutro/ausência de alerta. O indicador sempre representa o Status Comercial atual.

## 21. Barras de Clientes / Pedidos

Atualizar as linhas/cards de `Meus Clientes / Meus Pedidos` e `Clientes / Pedidos` para incorporar as informações principais atuais do pedido, especialmente Operadora, Status Comercial, situação/cor do SLA e demais dados relevantes já existentes, preservando visual compacto.

## 22. Filtro de SLA em Pedidos

Para BKO e Admin, adicionar filtro visual por SLA na aba de pedidos:
- Verde
- Laranja
- Vermelho
- Sem SLA

O filtro deve funcionar junto dos demais filtros já existentes. Ex.: VIVO + Vermelho.

## Modelo de dados proposto

### Status/SLA
- `status_comercial_catalogo`: catálogo único existente.
- Nova `status_comercial_operadoras`: `status_id`, `operadora`, `sla_horas`, `ativo`.
- `venda_status_comercial_historico`: adicionar `observacao`, `operadora_snapshot`, `sla_horas_snapshot`, `sla_inicio_em`, `sla_metade_em`, `sla_limite_em`.
- `vendas`: adicionar snapshot atual (`status_comercial_id`, `status_comercial_nome`, `status_comercial_em`, `sla_horas_atual`, `sla_metade_em`, `sla_limite_em`) e marco `ativado_100_em` / `ativado_100_por`.

### Linhas
- `venda_linhas`: `possui_bonus`, `bonus_gb`.
- Nova `venda_linha_doadores`: `linha_id`, `nome_completo`, `email`, `telefone`, `operadora`, auditoria básica.

### Suporte
- Adaptar `suporte_solicitacoes` para `venda_id` opcional e adicionar dados próprios do cliente, etapa inicial e responsável assumido.
- Nova `suporte_informacoes` para histórico textual separado de conversa.
- Nova `suporte_documentos` + bucket privado/estrutura equivalente aos documentos do pedido.
- Mensagens atuais permanecem como conversa.

## Segurança e auditoria

- RLS/RPC devem validar papéis para movimentação, status, datas, suporte e documentos.
- Remover reabertura comercial do backend.
- Mudança de Status Comercial deve ser transacional: validar operadora, registrar histórico, atualizar snapshot da venda e tratar Ativado 100%.
- Alteração de status sem SLA não cria prazo artificial.
- Edição de pedido concluído é permitida a BKO/Admin sem reintroduzir o card no Pipeline.

## Critérios de aceite

O pacote só é considerado concluído quando as regras acima estiverem implementadas no banco e frontend, os testes automatizados relevantes passarem, build/lint passarem, RLS/permissões forem revisadas e o fluxo final for validado sem regressão do suporte existente, documentos do pedido, biometria e Pipeline.