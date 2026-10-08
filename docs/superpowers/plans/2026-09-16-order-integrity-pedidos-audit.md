# Order Integrity and Pedidos Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Garantir que ATIVADO 100% respeite as 7 datas obrigatórias, que totais da venda reflitam suas linhas e que a listagem de Pedidos mostre dados operacionais atuais com SLA em evidência.

**Architecture:** O banco será a fonte de verdade para totais derivados e para a validação final de ATIVADO 100%. O frontend fará preflight para UX imediata e a listagem de Pedidos deixará de renderizar os campos legados `status`/`status_pedido`. Alterações ficam isoladas nesta branch e a `main` só será atualizada após aprovação explícita.

**Tech Stack:** React + TypeScript + TanStack Router + Supabase/PostgreSQL + Bun + GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-order-integrity-pedidos-audit-design.md`

## Global Constraints
- GitHub + Supabase externo são fonte de verdade.
- Não editar código pelo Lovable.
- Não fazer merge na `main` sem aprovação explícita.
- Preservar histórico existente.
- Usar TDD: RED antes do GREEN.

---

### Task 1: Proteção de ATIVADO 100% no frontend

**Files:**
- Create: `src/lib/ativado-100.ts`
- Create: `src/lib/ativado-100.test.ts`
- Modify: `src/components/status-comercial-pedido.tsx`
- Modify: `.github/workflows/check-status-comercial-pedido.yml`

**Interfaces:**
- Produces: `getMissingAtivado100Dates(venda)` retornando rótulos das datas ausentes.
- Consumes: campos de datas de `vendas`.

- [ ] **Step 1: Write the failing test** para pedido com apenas Recebimento preenchido retornar as outras 6 datas.
- [ ] **Step 2: Run test to verify it fails** com helper inexistente.
- [ ] **Step 3: Implement minimal helper** com exatamente as 7 datas aprovadas.
- [ ] **Step 4: Integrate preflight** em `StatusComercialPedido`: ao selecionar `MV - ATIVADO 100%`, carregar datas atuais da venda e bloquear com mensagem se houver faltantes.
- [ ] **Step 5: Run test and build**.
- [ ] **Step 6: Commit**.

### Task 2: Recalcular venda e cliente a partir de linhas

**Files:**
- Create: `supabase/migrations/20260917024000_recalc_venda_totais_from_linhas.sql`
- Create: `scripts/check-venda-line-rollup.py`
- Modify: `.github/workflows/check-status-comercial-pedido.yml`

**Interfaces:**
- Produces: `public.recalc_venda_totais(uuid)` e trigger de `venda_linhas` que recalcula venda antes dos totais do cliente.
- Updates: `vendas.quantidade_linhas`, `vendas.valor`.

- [ ] **Step 1: Write failing contract** exigindo função de rollup, tratamento de INSERT/UPDATE/DELETE e backfill.
- [ ] **Step 2: Run contract to verify RED**.
- [ ] **Step 3: Implement migration** somando `valor_mensal` e contando linhas não canceladas; recalcular OLD e NEW `venda_id` quando necessário; recalcular cliente depois da venda.
- [ ] **Step 4: Apply migration to Supabase** depois de CI do código ficar verde.
- [ ] **Step 5: Validate `OMN-9015898`** deve passar de 0/R$0 para 1/R$500.
- [ ] **Step 6: Commit**.

### Task 3: Auditoria e limpeza da tabela Clientes / Pedidos

**Files:**
- Create: `scripts/check-pedidos-operational-table.py`
- Modify: `src/components/clientes-pedidos.tsx`
- Modify: `.github/workflows/check-status-comercial-pedido.yml`

**Interfaces:**
- Table first operational column: SLA.
- Remove visual columns sourced from legacy `status` and `status_pedido`.
- `Tipo`/`Produto` cannot be rendered from stale sale-level fields.

- [ ] **Step 1: Write failing contract** exigindo SLA antes de Pedido e ausência das colunas visuais legadas `Status`/`Resultado`.
- [ ] **Step 2: Verify RED**.
- [ ] **Step 3: Reorder/simplify headers and cells** com SLA primeiro, Status Comercial destacado e remoção de Status/Resultado.
- [ ] **Step 4: Remove stale sale-level Tipo/Produto from visual table**; manter filtros somente se tiverem fonte correta ou retirar até a auditoria completa.
- [ ] **Step 5: Keep CSV coherent** sem apresentar legado como estado operacional atual.
- [ ] **Step 6: Run contracts/tests/build**.
- [ ] **Step 7: Commit**.

### Task 4: Auditoria completa do upgrade operacional anterior

**Files:**
- Create: `docs/superpowers/plans/2026-09-16-operational-upgrade-audit.md`

**Interfaces:**
- Produces matrix with each approved requirement and evidence from code/database/UI path.

- [ ] **Step 1: Enumerate approved requirements** do PR #16 e ajustes #17/#18.
- [ ] **Step 2: Verify code path and database objects** de cada item.
- [ ] **Step 3: Classify**: funcional; presente mas não exposto; parcial; ausente.
- [ ] **Step 4: Record concrete gaps** com arquivo/tabela/função afetada.
- [ ] **Step 5: Do not merge**; present audit + branch state for user approval.
