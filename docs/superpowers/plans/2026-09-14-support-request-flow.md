# Support Request Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar pedido comercial, solicitação de suporte e card de atendimento, mantendo o pedido no funil original e habilitando chat, notificações, triagem e funil de suporte independentes.

**Architecture:** Criar `suporte_solicitacoes` como entidade raiz do atendimento, com chat/auditoria próprios. Tickets novos passam a representar apenas o card do funil Suporte e apontam para a solicitação; operações de estado sensíveis usam RPCs PostgreSQL com verificação de perfil BKO.

**Tech Stack:** React 19, TanStack Router, Supabase/Postgres/RLS/Realtime, TypeScript, Node 22 test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-09-14-support-request-flow-design.md`

## Global Constraints
- Enviar para suporte nunca altera `vendas.funil` ou `vendas.etapa_id`.
- Múltiplas solicitações simultâneas por pedido são permitidas.
- Chat permanece o mesmo antes e depois da criação do card.
- Somente BKO cria/move/conclui/reabre card de suporte.
- Todos os BKOs veem tudo e toda ação é auditada.
- Mensagens em itens concluídos não reabrem automaticamente.
- Estruturas legadas não são apagadas.

---

### Task 1: Regras de domínio testáveis

**Files:**
- Create: `src/lib/support-flow.ts`
- Create: `src/lib/support-flow.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `supportStatusLabel(status, hasTicket)`, `reopenTarget(hasTicket)`, `canMoveSupportCard(role)`, `isSupportStage(stageId)`.

- [ ] **Step 1: Write failing tests** para garantir que somente BKO movimenta, reabertura com card volta a `s-espera`, reabertura sem card volta a `aguardando_criacao`, e os labels de status sejam estáveis.
- [ ] **Step 2: Run** `node --experimental-strip-types --test src/lib/support-flow.test.ts` e confirmar falha por módulo/funções ausentes.
- [ ] **Step 3: Implement minimal helpers** em `support-flow.ts`.
- [ ] **Step 4: Run** o mesmo comando e confirmar PASS.

### Task 2: Banco e segurança

**Files:**
- Create: `supabase/migrations/20260914_support_request_flow.sql`

**Interfaces:**
- Produces tabelas `suporte_solicitacoes`, `suporte_mensagens`, `suporte_leituras`, `suporte_eventos`.
- Produces colunas `tickets.solicitacao_id`, `tickets.etapa_suporte_id`, `notificacoes.solicitacao_id`.
- Produces RPCs `criar_solicitacao_suporte`, `criar_card_suporte`, `mover_card_suporte`, `resolver_solicitacao_suporte`, `reabrir_solicitacao_suporte`.

- [ ] **Step 1: Write RED schema assertions** em SQL de verificação para confirmar que as novas tabelas/RPCs ainda não existem.
- [ ] **Step 2: Run RED query** no Supabase e confirmar ausência.
- [ ] **Step 3: Apply migration** com tabelas, constraints, índices, RLS, triggers de `updated_at`, auditoria e notificações.
- [ ] **Step 4: Run GREEN schema assertions** confirmando tabelas, colunas, funções e políticas.
- [ ] **Step 5: Confirm invariant** com query de definição da RPC: `criar_solicitacao_suporte` não contém UPDATE em `vendas`.

### Task 3: Camada de acesso ao fluxo novo

**Files:**
- Create: `src/lib/support.functions.ts`

**Interfaces:**
- Produces: `createSupportRequest`, `getSupportCases`, `getSupportCaseDetail`, `createSupportCard`, `resolveSupportCase`, `reopenSupportCase`, `moveSupportCard`, `markSupportRead`.

- [ ] **Step 1: Extend domain tests** para normalização de casos e estados.
- [ ] **Step 2: Confirm RED**.
- [ ] **Step 3: Implement data access** usando Supabase e RPCs; preservar fallback legado em `tickets.functions.ts`.
- [ ] **Step 4: Run tests**.

### Task 4: Pedido cria solicitação sem mover venda

**Files:**
- Modify: `src/routes/_shell.vendas.$id.tsx`
- Modify: `src/routes/_shell.pipeline.tsx`

**Interfaces:**
- Consumes: `createSupportRequest`.

- [ ] **Step 1: Add a static source assertion** que falha se `confirmarSuporte` contiver `moveVenda(` ou se o modal contiver `Etapa no Suporte`.
- [ ] **Step 2: Confirm RED** na versão atual.
- [ ] **Step 3: Replace support submit** por criação de solicitação + histórico do pedido; remover seletor de etapa.
- [ ] **Step 4: Remove stage suggestion from PipelineCard**; o botão apenas abre o modal de suporte.
- [ ] **Step 5: Re-run source assertion** e build.

### Task 5: Meus Chamados, Central e detalhe com chat único

**Files:**
- Modify: `src/routes/_shell.suporte.index.tsx`
- Modify: `src/routes/_shell.suporte.central.tsx`
- Modify: `src/routes/_shell.suporte.$id.tsx`

**Interfaces:**
- Consumes: `getSupportCases`, `getSupportCaseDetail`, `createSupportCard`, `resolveSupportCase`, `reopenSupportCase`, `markSupportRead`.

- [ ] **Step 1: Add source assertions** para textos `Aguardando criação do atendimento`, `Criar card de atendimento`, `Ver pedido completo`, `Reabrir`.
- [ ] **Step 2: Confirm RED**.
- [ ] **Step 3: Update consultant list** para mostrar solicitação imediatamente e abrir o detalhe/chat.
- [ ] **Step 4: Update BKO Central** para listar todos os casos e trocar `Assumir` por `Criar card de atendimento`.
- [ ] **Step 5: Update detail** para chat em `suporte_mensagens`, ações contextuais BKO, auditoria e acesso destacado ao pedido.
- [ ] **Step 6: Re-run assertions**.

### Task 6: Funil Suporte usa cards, não pedidos

**Files:**
- Create: `src/components/support-pipeline.tsx`
- Modify: `src/routes/_shell.pipeline.tsx`

**Interfaces:**
- Consumes: `getSupportCases`, `moveSupportCard`.

- [ ] **Step 1: Add source assertion** de que a aba `suporte` renderiza `SupportPipeline`.
- [ ] **Step 2: Confirm RED**.
- [ ] **Step 3: Implement SupportPipeline** com as etapas `s-*`, cards vinculados a solicitações e drag somente para BKO.
- [ ] **Step 4: Wire pipeline tab** sem alterar os outros funis.
- [ ] **Step 5: Re-run assertion**.

### Task 7: Notificações e destaque BKO

**Files:**
- Modify: `src/lib/notifications.tsx`
- Modify: `src/components/app-shell.tsx`
- Modify: `src/routes/_shell.suporte.index.tsx`

**Interfaces:**
- Database triggers create notification rows; UI consumes them via existing bell.

- [ ] **Step 1: Add source assertion** para Realtime em `notificacoes` e novos tipos de ícone.
- [ ] **Step 2: Confirm RED**.
- [ ] **Step 3: Subscribe bell to Realtime** e adicionar ícones/tipos de suporte.
- [ ] **Step 4: Add BKO waiting counter** na área de suporte/app shell.
- [ ] **Step 5: Re-run assertions**.

### Task 8: Verificação e integração

**Files:**
- Temporary: `.github/workflows/support-request-flow.yml`
- Temporary: `scripts/patch-support-request-flow.py` if needed for large-file edits.

- [ ] **Step 1: Run** `node --experimental-strip-types --test src/lib/support-flow.test.ts`.
- [ ] **Step 2: Run** `npm install --package-lock=false --no-audit --no-fund`.
- [ ] **Step 3: Run** `npm run build`.
- [ ] **Step 4: Verify database invariants**: request creation leaves venda unchanged; card starts at `s-espera`; only BKO RPC guards exist; notification triggers target all BKOs/consultant.
- [ ] **Step 5: Remove temporary automation files**.
- [ ] **Step 6: Open PR, inspect diff, merge only after checks pass**.