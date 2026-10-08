# Acompanhamento da Gestão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a primeira versão completa da página `/acompanhamento` para Admin/Gestor, com metas, classificação de tipos, configuração independente de quadros e estrutura visual pronta, sem calcular vendas reais.

**Architecture:** O módulo terá persistência própria em tabelas `acompanhamento_*`, protegidas por RLS para Admin/Gestor. A UI será composta por uma rota fina e componentes focados; a camada de dados será centralizada em server functions e helpers puros, mantendo a leitura dos catálogos existentes (`tipos_pedido_catalogo`, `status_comercial_*`, `pipeline_etapas`, `venda_robo_logs`) separada de qualquer cálculo de venda. A primeira entrega usa dados reais apenas para configurações, consultores, tipos e status disponíveis; resultados comerciais permanecem em estado vazio.

**Tech Stack:** React 19, TypeScript, TanStack Start/Router, Supabase/PostgreSQL/RLS, Tailwind CSS, shadcn/Radix UI, Bun tests/contract scripts.

**Spec:** `docs/superpowers/specs/2026-09-26-acompanhamento-gestao-design.md`

## Global Constraints

- A rota é exclusiva de `admin` e `gestor`.
- Nenhum valor das planilhas de referência pode ser importado ou semeado.
- Nenhuma venda, receita, quantidade, cancelamento, resultado atual ou diferença pode ser calculado nesta entrega.
- Tipos de pedido novos permanecem “Não classificados” até vínculo explícito por Gestor/Admin.
- Cada quadro possui configuração independente.
- Consultores vêm do cadastro do sistema; metas individuais são manuais.
- Status manual, status do robô e etapa do pipeline são fontes configuráveis.
- Normalização de status não usa fuzzy matching.
- `AG TEMPO INPUT` permanece fora do cálculo/configuração inicial até validação posterior.
- Novas tabelas em `public` devem ter RLS habilitado e políticas baseadas em `user_roles`.
- Alterações persistidas registram usuário e timestamp.
- A UI deve continuar funcional mesmo com zero metas, zero vínculos e zero regras configuradas.

## Review Focus

- **Novo tipo criado pelo BKO sem vínculo:** deve aparecer como pendente para Admin/Gestor e nunca cair automaticamente em “Outros”. Coberto na Task 2.
- **Status manual e robô com caixa/acentos/prefixo técnico:** devem normalizar para a mesma chave somente pelas regras explícitas, sem aproximar nomes diferentes. Coberto na Task 2.
- **Mês com quinta semana operacional:** a UI deve renderizar Semana 5 sem quebrar a tabela. Coberto na Task 4.
- **Consultor inativo com histórico:** deve permanecer representável em metas existentes, mas não entrar na lista de novos alvos. Coberto na Task 4.
- **Acesso por URL de Consultor/BKO/Closer:** deve ser bloqueado por `ROUTE_ROLES` além de não aparecer no menu. Coberto na Task 5.

---

### Task 1: Persistência segura do Acompanhamento

**Files:**
- Create: `supabase/migrations/20260926103000_acompanhamento_gestao_base.sql`
- Create: `scripts/check-acompanhamento-schema.py`
- Modify: workflow de contratos existente que já executa scripts Python de integridade

**Interfaces:**
- Produces tables:
  - `acompanhamento_configuracoes`
  - `acompanhamento_grupos`
  - `acompanhamento_tipo_vinculos`
  - `acompanhamento_metas_mensais`
  - `acompanhamento_metas_semanais`
  - `acompanhamento_metas_consultores`
  - `acompanhamento_quadros`
  - `acompanhamento_quadro_regras`
- Produces SQL helper `public.is_acompanhamento_manager() returns boolean` as `security invoker` when possible, reading `user_roles`.
- Seeds only structural groups/quadros and textual pre-configurations from the spec; never monetary values or sales results.

- [ ] **Step 1: Write the failing schema contract**

Create `scripts/check-acompanhamento-schema.py` asserting the migration text contains:
- all eight tables;
- `enable row level security` for all eight;
- policies restricted to Admin/Gestor;
- FKs from tipo vínculo to `tipos_pedido_catalogo`;
- unique constraints from the spec;
- no literals matching the example monetary values from the spreadsheets;
- structural seeds for the four status cards and no seed for `AG TEMPO INPUT`.

- [ ] **Step 2: Run the contract and verify RED**

Run: `python scripts/check-acompanhamento-schema.py`  
Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the migration**

Create all tables, indexes, constraints, RLS policies and structural seed rows.

Seed `acompanhamento_quadros` with codes:
- `aguardando_aceite`
- `troca_carteira_caso`
- `confeccao_correcoes`
- `tratativas_pendencias`
- `contratos_gerados_semana`
- `contratos_assinados_semana`
- `meta_enviados_consultor`
- `meta_assinados_consultor`

Seed only the explicit status-name rules from the spec. Store them as `valor_original` + `valor_normalizado`; do not bind them to a sale.

- [ ] **Step 4: Run the contract**

Run: `python scripts/check-acompanhamento-schema.py`  
Expected: PASS.

- [ ] **Step 5: Apply schema in Supabase and verify**

Use Supabase MCP `execute_sql` for validation/iteration, then register the final migration once stable.

Verification query must confirm:
- 8 tables exist;
- RLS is enabled on all;
- 8 structural quadros exist;
- no monthly/weekly/consultant meta rows were created.

Expected: all counts exact and zero business-value rows.

- [ ] **Step 6: Run Supabase advisors**

Run security + performance advisors. Fix only findings introduced by this task; record unrelated pre-existing findings without modifying them.

- [ ] **Step 7: Commit**

Commit message: `feat: add management tracking data model`

---

### Task 2: Data layer, normalization and pending classification

**Files:**
- Create: `src/lib/acompanhamento.types.ts`
- Create: `src/lib/acompanhamento.ts`
- Create: `src/lib/acompanhamento.test.ts`
- Create: `src/lib/acompanhamento.functions.ts`

**Interfaces:**
- Produces `normalizeAcompanhamentoStatus(value: string): string`
- Produces `getMonthOperationalWeeks(year: number, month: number): Array<{ index: number; start: string; end: string }>`
- Produces server function `getAcompanhamentoBootstrap`
- Produces server functions:
  - `saveMetaMensal`
  - `saveMetaSemanal`
  - `saveMetaConsultor`
  - `saveTipoVinculo`
  - `deleteTipoVinculo`
  - `saveQuadroRules`
- Produces bootstrap fields:
  - current Admin/Gestor role;
  - active consultant candidates;
  - existing consultant-goal historical references;
  - active order types + classification status;
  - manual status options;
  - robot status values discovered from logs;
  - pipeline stages;
  - groups, metas, quadros and rules.

- [ ] **Step 1: Write failing helper tests**

In `src/lib/acompanhamento.test.ts`, assert:
- `normalizeAcompanhamentoStatus("  Aguardando   Aceite ")` equals `AGUARDANDO ACEITE`;
- accented/lowercase equivalent normalizes identically;
- `ROBÔ - AGUARDANDO ACEITE` and `ROBO: AGUARDANDO ACEITE` normalize to the same key;
- `AGUARDANDO ACEITE CLIENTE` remains different;
- month helper returns 4 or 5 rendered operational buckets as appropriate and never assumes exactly four.

- [ ] **Step 2: Run tests to verify RED**

Run: `bun test src/lib/acompanhamento.test.ts`  
Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement pure helpers and types**

Keep the normalization deterministic:
- Unicode NFD + remove diacritics;
- trim;
- uppercase;
- collapse whitespace;
- remove only prefixes `ROBÔ -`, `ROBO -`, `ROBÔ:`, `ROBO:`.

Do not add fuzzy matching.

- [ ] **Step 4: Run helper tests**

Run: `bun test src/lib/acompanhamento.test.ts`  
Expected: PASS.

- [ ] **Step 5: Implement authenticated server functions**

Every server function:
- requires Supabase auth middleware;
- loads `user_roles`;
- rejects users without `admin` or `gestor`;
- stamps `updated_by` / actor IDs server-side;
- never trusts a role sent by the client.

`getAcompanhamentoBootstrap` must NOT query `vendas`, `venda_linhas` or calculate financial results.

Robot statuses are discovered from distinct non-empty `venda_robo_logs.valor_novo` values where the log represents status changes; return original + normalized value + source.

- [ ] **Step 6: Add contract preventing sales calculations**

Add a static assertion in the existing contract or a new `scripts/check-acompanhamento-no-sales.py` that the phase-1 data layer does not query `vendas` or aggregate `valor`/quantidades.

Run: `python scripts/check-acompanhamento-no-sales.py`  
Expected: PASS only after server functions comply.

- [ ] **Step 7: Commit**

Commit message: `feat: add management tracking configuration services`

---

### Task 3: Configuration Center — types and card sources

**Files:**
- Create: `src/components/acompanhamento/acompanhamento-config-dialog.tsx`
- Create: `src/components/acompanhamento/tipo-classificacao-panel.tsx`
- Create: `src/components/acompanhamento/quadro-rule-editor.tsx`
- Create: `src/components/acompanhamento/config-summary.tsx`
- Create: `scripts/check-acompanhamento-config-ui.py`

**Interfaces:**
- Consumes `getAcompanhamentoBootstrap`, `saveTipoVinculo`, `deleteTipoVinculo`, `saveQuadroRules`.
- Produces reusable `QuadroConfigButton({ quadroCodigo })`.
- Produces `AcompanhamentoConfigDialog` for the top-level settings button.

- [ ] **Step 1: Write failing UI contract**

The script must assert:
- there is a visible “Não classificados” section;
- type classification shows operator, type name, context and selected group;
- no default-to-Outros behavior exists;
- each status card can open its own `QuadroConfigButton`;
- rule editor exposes source labels “Status manual”, “Status do robô”, “Etapa do pipeline”;
- the editor displays normalized-equivalence hints but does not auto-save fuzzy matches.

- [ ] **Step 2: Run contract to verify RED**

Run: `python scripts/check-acompanhamento-config-ui.py`  
Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement type-classification panel**

Show:
- pending count prominently;
- separate Claro/Vivo chips;
- context selector;
- group selector;
- “Classificar” and “Alterar vínculo” actions;
- audit text with last actor/date when present.

A type with no link remains visibly pending.

- [ ] **Step 4: Implement per-card rule editor**

Each card editor loads only its own rules and saves only its own `quadro_id`.

Status options display source badges. Equivalent normalized keys may be grouped visually, but selecting one does not silently select other sources unless the user explicitly selects both.

- [ ] **Step 5: Run UI contract**

Run: `python scripts/check-acompanhamento-config-ui.py`  
Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add tracking configuration center`

---

### Task 4: Targets and consultant weekly planning

**Files:**
- Create: `src/components/acompanhamento/meta-mensal-card.tsx`
- Create: `src/components/acompanhamento/meta-semanal-card.tsx`
- Create: `src/components/acompanhamento/consultor-weekly-table.tsx`
- Create: `src/components/acompanhamento/weekly-result-card.tsx`
- Create: `src/lib/acompanhamento-metas.ts`
- Create: `src/lib/acompanhamento-metas.test.ts`

**Interfaces:**
- Consumes meta save functions and bootstrap consultant list.
- Produces `suggestWeeklySplit(total: number, weekCount: number): number[]`.
- Produces tables for `enviados` and `assinados` with optional Week 5.

- [ ] **Step 1: Write failing target tests**

Assert:
- automatic suggestion divides a monthly target across all operational weeks;
- rounding preserves the monthly total exactly;
- 5-week input returns 5 values;
- manually edited weekly values are not overwritten when bootstrap reloads;
- inactive consultant IDs already present in stored goals remain renderable as historical rows;
- inactive consultants are excluded from the “Adicionar consultor” options.

- [ ] **Step 2: Run tests to verify RED**

Run: `bun test src/lib/acompanhamento-metas.test.ts`  
Expected: FAIL.

- [ ] **Step 3: Implement target helpers**

Keep them pure. Do not calculate achieved results.

- [ ] **Step 4: Implement monthly + weekly target cards**

Monthly:
- NP e Fixa
- Outros
- Total

Weekly:
- Novo / Importado
- Renovação
- Total
- auto-suggestion badge;
- manual-edit indicator.

- [ ] **Step 5: Implement consultant tables**

Render:
- Consultor
- Meta Semana
- Week columns from `getMonthOperationalWeeks`
- Resultado Ideal
- Resultado Atual
- Diferença
- Cancelados

For phase 1:
- Resultado Ideal can derive from the manually configured target;
- Resultado Atual, Diferença and Cancelados show neutral “Aguardando integração” rather than fabricated zeros.

Each table has its own configuration button.

- [ ] **Step 6: Run tests**

Run: `bun test src/lib/acompanhamento-metas.test.ts src/lib/acompanhamento.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: add monthly and weekly management targets`

---

### Task 5: Main Acompanhamento page and operational status cards

**Files:**
- Create: `src/routes/_shell.acompanhamento.tsx`
- Create: `src/components/acompanhamento/processo-operadora-card.tsx`
- Create: `src/components/acompanhamento/total-geral-card.tsx`
- Create: `src/components/acompanhamento/residual-card.tsx`
- Create: `src/components/acompanhamento/status-operational-card.tsx`
- Create: `scripts/check-acompanhamento-page.py`

**Interfaces:**
- Consumes all Task 2-4 components/services.
- Produces route `/acompanhamento`.
- No sales-result interface is produced in phase 1.

- [ ] **Step 1: Write failing page contract**

Assert page contains the sections:
- Meta mensal
- Vendas em Processo Claro
- Vendas em Processo Vivo
- Total Geral with local `Tudo | Claro | Vivo` filter
- Residual do Mês
- Meta da Semana
- Contratos Gerados Semana / Data de Recebimento
- Contratos Assinados Semana / Data de Aceite
- Enviados / Data de Recebimento
- Assinados / Data de Aceite
- the four operational status cards from the spec.

Assert page contains no spreadsheet values and does not import a sales calculation helper.

- [ ] **Step 2: Run contract to verify RED**

Run: `python scripts/check-acompanhamento-page.py`  
Expected: FAIL.

- [ ] **Step 3: Implement page header and configuration state**

Header:
- title;
- selected month/year;
- pending-classification badge;
- settings button;
- explanatory badge “Resultados aguardando configuração” while phase 1 has no calculation.

- [ ] **Step 4: Implement process, total and residual cards**

Process cards use the exact category structure from the spec but display empty result cells.

Total Geral filter changes only the empty-state context in phase 1; it must not query sales.

Residual displays configured targets and neutral placeholders for real achieved values.

- [ ] **Step 5: Implement weekly and operational status cards**

Each status card shows:
- Vivo row;
- Claro row;
- Total row;
- Portabilidade;
- Novo/Fixa;
- Outros;
- own Configure button;
- configured-source summary;
- no sale totals.

- [ ] **Step 6: Run page contract**

Run: `python scripts/check-acompanhamento-page.py`  
Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: add management tracking page`

---

### Task 6: Navigation, route security, generated routes and final verification

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/lib/permissions.ts`
- Modify/generated: `src/routeTree.gen.ts`
- Create or modify: route-permission test/contract covering `/acompanhamento`

**Interfaces:**
- Consumes route from Task 5.
- Produces menu entry and route authorization limited to Admin/Gestor.

- [ ] **Step 1: Write failing permission test**

Assert:
- Admin can access `/acompanhamento`;
- Gestor can access;
- Consultor, BKO and Closer cannot;
- menu roles for “Acompanhamento” are exactly Admin/Gestor.

- [ ] **Step 2: Run test to verify RED**

Run the focused Bun test/contract for permissions.  
Expected: FAIL because route role is absent.

- [ ] **Step 3: Add navigation and permission entry**

Add `/acompanhamento` to `ROUTE_ROLES` and `NAV` with a management-oriented icon.

- [ ] **Step 4: Regenerate route tree through the normal build tool**

Run: `bun run build`  
Expected: exit 0 and `src/routeTree.gen.ts` includes `/acompanhamento`.

- [ ] **Step 5: Run complete focused verification**

Run:
- `bun test src/lib/acompanhamento.test.ts src/lib/acompanhamento-metas.test.ts <permission-test>`
- `python scripts/check-acompanhamento-schema.py`
- `python scripts/check-acompanhamento-no-sales.py`
- `python scripts/check-acompanhamento-config-ui.py`
- `python scripts/check-acompanhamento-page.py`
- `bun run build`

Expected: all pass, build exit 0.

- [ ] **Step 6: Database verification**

Query Supabase:
- no real sales result tables/rows generated by this feature;
- structural seeds exist;
- meta tables contain only values deliberately entered during tests (production should remain empty unless user entered values);
- RLS enabled;
- policies deny non-manager write access.

Run advisors again and compare with Task 1 baseline.

- [ ] **Step 7: Final review**

Review against the spec line by line, especially:
- no sales calculations;
- no spreadsheet values;
- no auto-classification;
- independent configurations;
- no `AG TEMPO INPUT` business rule;
- no access for unauthorized roles.

- [ ] **Step 8: Commit**

Commit message: `feat: expose management tracking to admin and manager`

## Completion Contract

The implementation is complete only when:
1. all Task 1-6 focused tests/contracts pass;
2. production build succeeds;
3. Supabase security verification is clean for newly introduced objects;
4. the page is navigable for Admin/Gestor only;
5. all visual sections from the spec are present;
6. no sale/revenue/result calculation exists in phase 1;
7. no reference spreadsheet monetary values exist in source or seed data;
8. unclassified order types are visible as a blocking management pending item;
9. each card stores its own configuration independently;
10. the final review reports any deferred minor issue explicitly.
