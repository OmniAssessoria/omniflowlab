# OMNI Flow Lab Operational Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as 22 mudanças aprovadas de Pipeline, pedidos, linhas, Status Comercial/SLA, suporte avulso e visualizações operacionais.

**Architecture:** Evoluir o modelo existente sem duplicar sistemas: catálogo único de Status Comercial ligado a operadoras/SLA, snapshots de SLA na venda para consulta rápida, históricos como fonte de auditoria, suporte avulso como extensão da infraestrutura atual e permissões críticas protegidas por banco/RPC/RLS. Frontend consome essas regras em componentes focados e preserva compatibilidade com dados existentes.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript, Supabase Postgres/Auth/Storage/RLS, Tailwind, Vitest-like source tests/CI existente.

**Spec:** `docs/superpowers/specs/2026-09-16-operational-upgrade-design.md`

## Global Constraints

- Supabase alvo: `jgruzxaibvjejkjjgxcu`.
- Não usar Lovable para desenvolvimento.
- Não implementar diretamente em `main`; usar `feat/operational-upgrade-2026-09-16`.
- Admin acompanha permissões operacionais do BKO salvo exceção explícita.
- Pedido concluído nunca volta ao Pipeline.
- Toda regra sensível deve ser validada no backend/banco, não apenas na UI.
- Preservar histórico e auditoria.

---

### Task 1: Base de dados para Status Comercial por operadora e SLA

**Files:**
- Create: `supabase/migrations/20260916_status_comercial_sla_operadora.sql`
- Modify: `src/integrations/supabase/types.ts` (gerado/atualizado após migração)
- Test: `src/lib/status-sla.test.ts`

**Interfaces:**
- Produces: `status_comercial_operadoras`, snapshots SLA em `vendas`, campos extras em `venda_status_comercial_historico`, função/RPC atômica de atualização de Status Comercial.

- [ ] Criar teste de contrato para cálculo verde/laranja/vermelho e Sem SLA.
- [ ] Criar migração com relação `status_id + operadora` única, colunas de SLA/histórico/snapshot e índices de filtros.
- [ ] Criar/ajustar RPC de atualização que valide papel BKO/Admin, operadora do pedido, status permitido e registre histórico + snapshot na mesma transação.
- [ ] Tratar `MV - ATIVADO 100%` na mesma transação, validando as sete datas obrigatórias e registrando `ativado_100_em/por`.
- [ ] Seed das referências do PDF: Claro e Vivo com seus SLAs, e status comuns aplicáveis a ambas sem SLA inicial quando não houver referência.
- [ ] Executar migração no Supabase correto e validar contagens: 89 status base, relações por operadora sem duplicação indevida.
- [ ] Atualizar tipos e executar testes.
- [ ] Commit.

### Task 2: Status Comercial UI + observação + Ativado 100%

**Files:**
- Modify: `src/components/status-comercial-pedido.tsx`
- Modify: `src/routes/_shell.vendas.$id.tsx`
- Create: `src/lib/status-sla.ts`
- Test: `src/lib/status-sla.test.ts`

**Interfaces:**
- Consumes: RPC/modelo da Task 1.
- Produces: seletor filtrado por operadora, observação por mudança, confirmação especial de ativação, selo Ativado 100%, cor SLA atual.

- [ ] Fazer catálogo carregar apenas status válidos para a operadora da venda.
- [ ] Adicionar campo livre de observação ao fluxo de alteração.
- [ ] Para Ativado 100%, abrir confirmação e mostrar pendências de datas retornadas pelo backend.
- [ ] Exibir selo verde pulsante próximo à Biometria quando ativado.
- [ ] Remover bloco visual `Status do Pedido`.
- [ ] Garantir que BKO/Admin possam alterar Status Comercial mesmo em venda concluída.
- [ ] Testar histórico, observação, Sem SLA e persistência.
- [ ] Commit.

### Task 3: Encerramento definitivo e permissões de pedido concluído

**Files:**
- Modify: `src/components/venda-lifecycle-actions.tsx`
- Modify: `src/lib/pipeline-movement.ts`
- Modify: `src/lib/omni-store.tsx` ou arquivo equivalente do RPC de lifecycle
- Create/Modify migration de RPC/RLS correspondente
- Test: `src/lib/pipeline-movement.test.ts`

**Interfaces:**
- Produces: conclusão sem reabertura e edição pós-conclusão somente BKO/Admin.

- [ ] Remover `canReopenCommercialOrder`, botão e fluxo de reabertura.
- [ ] Revogar/remover RPC backend de reabertura comercial.
- [ ] Ajustar permissão de edição: concluído = leitura para Consultor/Gestor, edição para BKO/Admin.
- [ ] Ajustar Datas do Sistema para edição apenas BKO/Admin em qualquer estado.
- [ ] Preservar consulta do pedido concluído em Clientes/Pedidos.
- [ ] Testar que conclusão não é revertível.
- [ ] Commit.

### Task 4: Movimentação do Consultor em Processos BKO

**Files:**
- Modify: `src/lib/pipeline-movement.ts`
- Modify: `src/components/move-venda-dialog.tsx`
- Modify migration/RPC de movimentação comercial
- Test: `src/lib/pipeline-movement.test.ts`

**Interfaces:**
- Produces: destinos restritos por papel e etapa/funil.

- [ ] Mapear IDs reais das etapas Pendente Consultor, Apoio Gestão e Troca de Carteira | Abertura de Caso.
- [ ] Filtrar UI do Consultor para somente esses destinos em Processos BKO.
- [ ] Bloquear backend para etapas posteriores e bloquear movimentação de volta quando o pedido já está além da faixa permitida.
- [ ] Confirmar Gestor/BKO/Admin sem regressão.
- [ ] Testar matriz de papéis/destinos.
- [ ] Commit.

### Task 5: Bônus VIVO e doadores por linha

**Files:**
- Create: `supabase/migrations/20260916_venda_linhas_bonus_doadores.sql`
- Modify: `src/routes/_shell.vendas.$id.tsx`
- Modify: componentes auxiliares de linha se extraídos
- Test: `src/lib/venda-linhas-rules.test.ts`

**Interfaces:**
- Produces: `possui_bonus`, `bonus_gb`, `venda_linha_doadores` e validações.

- [ ] Conferir nomes/IDs exatos dos quatro Tipos de Produto no catálogo atual.
- [ ] Migrar campos de bônus e tabela normalizada de doadores com FK/cascade adequado.
- [ ] Implementar bônus apenas para VIVO; Sim exige 10/20 GB, Não limpa valor.
- [ ] Implementar seção expansível de doadores por linha para os quatro tipos gatilho.
- [ ] Exigir nome, e-mail, telefone e operadora por doador; permitir múltiplos.
- [ ] Garantir edição por Consultor/Gestor/BKO/Admin conforme regra da linha e estado do pedido.
- [ ] Testar CLARO sem bônus e múltiplos doadores.
- [ ] Commit.

### Task 6: Suporte avulso e assumir atendimento

**Files:**
- Create: `supabase/migrations/20260916_suporte_avulso.sql`
- Modify: `src/lib/support.functions.ts`
- Modify: Pipeline/header onde existe `Nova Venda`
- Modify: `src/routes/_shell.suporte.*` e `src/components/support-pipeline.tsx`
- Test: `src/lib/support-flow.test.ts`

**Interfaces:**
- Produces: suporte com `venda_id` opcional, dados próprios do cliente, destino inicial, responsável principal não-exclusivo.

- [ ] Tornar `suporte_solicitacoes.venda_id` opcional e adicionar dados do cliente/etapa inicial/responsável.
- [ ] Criar RPC para `Novo Suporte` com campos obrigatórios e prioridade A tratar/Urgente.
- [ ] Adicionar botão `Novo Suporte` ao lado de `Nova Venda` e modal de criação.
- [ ] Permitir nascimento em Suportes em Espera ou Pré-vendas.
- [ ] Implementar `Assumir atendimento` sem retirar acesso dos demais BKOs.
- [ ] Adaptar hidratação/listagem para chamados sem venda.
- [ ] Testar suporte com e sem venda.
- [ ] Commit.

### Task 7: Informações e documentos do Suporte

**Files:**
- Create: `supabase/migrations/20260916_suporte_informacoes_documentos.sql`
- Modify: `src/lib/support.functions.ts`
- Modify: `src/routes/_shell.suporte.$id.tsx`
- Reuse/adapt: padrão de `src/components/documentos-pedido.tsx`

**Interfaces:**
- Produces: `suporte_informacoes`, `suporte_documentos`, bucket/policies privadas até 100 MB.

- [ ] Criar histórico de informações separado de mensagens.
- [ ] Criar documentos privados por atendimento com título/metadados/auditoria e limite de 100 MB.
- [ ] Permitir Consultor/BKO/Admin inserir informações e arquivos conforme acesso ao chamado.
- [ ] Preservar conversa atual como canal separado.
- [ ] Implementar preview/download autenticado seguindo o padrão Blob já corrigido nos pedidos.
- [ ] Testar autorização e exclusão/consulta.
- [ ] Commit.

### Task 8: Configurações > SLA

**Files:**
- Modify: `src/routes/_shell.config.tsx`
- Create: componentes auxiliares de SLA se necessário
- Test: fonte/contrato de configuração

**Interfaces:**
- Consumes: `status_comercial_operadoras`.
- Produces: administração dos 89 status por Claro/Vivo/Ambas e SLA em horas/Sem SLA.

- [ ] Substituir painel por funil/etapa por painel Status Comercial + Operadora.
- [ ] Exibir filtros/abas Claro, Vivo, Ambas e busca por status.
- [ ] Permitir SLA vazio (Sem SLA) e alteração de aplicabilidade por operadora.
- [ ] Restringir edição administrativa conforme regra aprovada.
- [ ] Validar os seeds contra as contagens do material.
- [ ] Commit.

### Task 9: Indicadores SLA no Pipeline e em Clientes/Pedidos

**Files:**
- Modify: `src/components/commercial-pipeline.tsx` e/ou `CommercialCard`
- Modify: `src/components/clientes-pedidos.tsx`
- Modify/Create: `src/lib/status-sla.ts`
- Test: `src/lib/status-sla.test.ts`

**Interfaces:**
- Produces: bolinha SLA no card, barra de pedido atualizada e filtro por cor.

- [ ] Usar snapshot atual para determinar verde/laranja/vermelho/sem SLA em tempo real.
- [ ] Exibir bolinha no card do Pipeline.
- [ ] Atualizar linha de Meus Pedidos/Clientes-Pedidos com Operadora, Status Comercial e SLA.
- [ ] Adicionar filtro BKO/Admin: Verde, Laranja, Vermelho, Sem SLA.
- [ ] Combinar com filtros já existentes sem quebrar paginação/exportação.
- [ ] Testar casos de 49%, 50%, 100%, >100% e Sem SLA.
- [ ] Commit.

### Task 10: Biometria e regressões integradas

**Files:**
- Modify somente se necessário após teste.
- Test: componentes/helpers afetados.

**Interfaces:**
- Produces: validação de regressão do pacote.

- [ ] Confirmar Pendente amarelo, Cancelada vermelho, Concluída verde e persistência.
- [ ] Confirmar documentos de pedido continuam funcionando.
- [ ] Confirmar suporte vinculado à venda continua funcionando após suporte avulso.
- [ ] Confirmar pedido concluído não volta ao Pipeline e BKO/Admin ainda alteram datas/Ativado 100%.
- [ ] Confirmar filtros e histórico SLA.
- [ ] Rodar lint, build e testes existentes/novos.
- [ ] Rodar advisors de segurança/performance do Supabase após DDL/RLS.
- [ ] Corrigir regressões encontradas e commit.

### Task 11: Revisão, PR e integração

**Files:**
- Review all changed files.

- [ ] Comparar branch com `main` e revisar diff completo.
- [ ] Verificar CI e corrigir falhas.
- [ ] Abrir PR com resumo das 22 mudanças, migrações e testes.
- [ ] Fazer revisão técnica final.
- [ ] Merge somente após verificações verdes.
