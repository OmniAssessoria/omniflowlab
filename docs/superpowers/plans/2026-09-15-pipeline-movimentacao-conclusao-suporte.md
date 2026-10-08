# Pipeline Movimentação, Conclusão e Prioridade de Suporte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to execute this plan task-by-task with review checkpoints.

## Goal
Substituir o drag-and-drop comercial por `Mover para` com confirmação e auditoria; criar o estado terminal comercial `Concluído` com reabertura segura; e adicionar prioridade `A tratar`/`Urgente` às solicitações de Suporte, preservando o fluxo independente do atendimento.

## Architecture
As regras críticas ficarão centralizadas em RPCs `SECURITY DEFINER` no Supabase, com validação explícita de perfil, acesso ao pedido, destino ativo/comercial e auditoria. O frontend apenas calcula destinos visíveis, coleta a intenção, mostra confirmações e chama as RPCs. `Concluído` será um estado de ciclo de vida em `vendas` (`concluido_em`/`concluido_por`), mantendo `funil` e `etapa_id` como último destino comercial; a prioridade de Suporte será própria de `suporte_solicitacoes` e nunca reutilizará `vendas.prioridade`.

## Tech Stack
React 19, TypeScript 5.8, TanStack Router/Start, Supabase/PostgreSQL/RLS/RPC, Tailwind 4, Radix UI, Sonner, Bun test/build e Python para contratos estáticos.

## Spec
`docs/superpowers/specs/2026-09-15-pipeline-movimentacao-conclusao-suporte-design.md`

## Global Constraints
- Comercial: Consultor move vendas às quais tem acesso entre funis/etapas comerciais ativos; Gestor, BKO e Admin têm o mesmo alcance de destino comercial. Movimento pode ir para frente ou para trás.
- Suporte nunca é destino de `Mover para` comercial.
- Apenas BKO/Admin concluem pedido comercial, e somente em `a-assinado` ou `a-assinado-vivo`.
- Consultor/Gestor/BKO/Admin podem reabrir pedido concluído se tiverem acesso; destino é sempre a primeira etapa ativa do primeiro funil comercial ativo.
- `Concluído` comercial não entra em `pipeline_etapas`, não pode ser renomeado/desativado e não conta como card ativo.
- BKO e Admin podem movimentar cards de Suporte. A criação inicial do card e os controles diretos de resolver/reabrir permanecem BKO; Admin pode concluir ao mover o card para a etapa final.
- BKO/Admin podem reclassificar prioridade de Suporte entre `a_tratar` e `urgente`.
- A prioridade de Suporte é uma tag independente das etapas `s-urgente` e `s-tratar`: classificar como Urgente/A tratar nunca movimenta o card. Card novo continua nascendo em `s-espera`; só BKO muda etapa.
- `Urgente` é vermelho com pulsação discreta; `A tratar` é laranja sem animação.
- Preservar o canal Realtime isolado `support-pipeline-structure-live`.
- Nunca aplicar migrações no Supabase antigo/Lovable. Produção é somente `jgruzxaibvjejkjjgxcu`.
- Não editar manualmente `src/routeTree.gen.ts`.

## File Map
- Create: `src/lib/pipeline-movement.ts`, `src/lib/pipeline-movement.test.ts`.
- Create: `src/components/move-venda-dialog.tsx`.
- Modify: `src/lib/omni-store.tsx`, `src/lib/mock-data.ts`, `src/integrations/supabase/types.ts`.
- Modify: `src/routes/_shell.pipeline.tsx`, `src/routes/_shell.vendas.$id.tsx`, `src/components/clientes-pedidos.tsx`.
- Create: `supabase/migrations/20260915190000_pipeline_movement_completion.sql`.
- Create: `supabase/migrations/20260915190500_support_request_priority.sql`.
- Create: `src/lib/support-priority.ts`, `src/lib/support-priority.test.ts`, `src/components/support-priority-ui.tsx`.
- Modify: `src/lib/support.functions.ts`, `src/components/support-pipeline.tsx`, `src/routes/_shell.suporte.central.tsx`, `src/routes/_shell.suporte.$id.tsx`, `src/routes/_shell.suporte.index.tsx`.
- Create: `scripts/check-pipeline-movement-completion-support-priority.py`.
- Modify: `.github/workflows/check-pipeline-structure.yml`.

### Task 1: Domain helpers with TDD
- [ ] Create `src/lib/pipeline-movement.test.ts` first. Cover: only active `participa_fluxo_comercial` funnels are eligible; Support excluded; current stage excluded; consultant/gestor/BKO/admin are movement roles; only BKO/admin can conclude; only signed Claro/Vivo stages can conclude; consultant/gestor/BKO/admin can reopen completed orders.
- [ ] Run `bun test src/lib/pipeline-movement.test.ts` and verify RED because helper module does not exist.
- [ ] Implement `src/lib/pipeline-movement.ts` with pure UI/domain helpers, never as the security boundary. Export `COMMERCIAL_COMPLETION_SOURCE_STAGE_IDS`, `availableCommercialDestinations(...)`, `canConcludeCommercialOrder(...)`, `canReopenCommercialOrder(...)`. `availableCommercialDestinations` receives the visible funnel ids, dynamic funnels/stages and current destination; it intersects visibility with active commercial funnels and active stages.
- [ ] Re-run `bun test src/lib/pipeline-movement.test.ts` and verify GREEN.
- [ ] Commit: `test: define pipeline movement and completion contract`.

### Task 2: Commercial movement/completion database API
- [ ] Create `scripts/check-pipeline-movement-completion-support-priority.py` with assertions limited to the commercial database contract introduced in this task.
- [ ] Create `supabase/migrations/20260915190000_pipeline_movement_completion.sql`.
- [ ] Add nullable `vendas.concluido_em timestamptz` and `vendas.concluido_por uuid references auth.users(id) on delete set null`, plus an index useful for active/completed filtering.
- [ ] Update `pipeline_active_sale_count(...)` to require `concluido_em is null`, so concluded sales do not block funnel/stage deactivation while their last commercial funil/etapa remain preserved.
- [ ] Add `pipeline_move_venda(p_venda_id uuid, p_etapa_id text)` returning the resolved destination (`funil_id`, `etapa_id`, `funil_nome`, `etapa_nome`). Lock the sale row; reject deleted/cancelled/rejected/concluded records; require one of consultant/gestor/BKO/admin; for consultant require ownership of the sale unless the user also has a broader allowed role; resolve target by joining `pipeline_funis` + `pipeline_etapas` with `ativo=true` and `participa_fluxo_comercial=true`; coordinate locking with the existing concurrency trigger; reject same destination; update `funil` as `funil_enum`, `etapa_id`, `dias_na_etapa=0`; insert a complete `venda_historico` event with actor/profile and old/new funnel/stage.
- [ ] Add `pipeline_concluir_venda(p_venda_id uuid)` returning `concluido_em`. Require BKO/Admin; lock sale; require not already concluded and current stage in `('a-assinado','a-assinado-vivo')`; set completion fields without changing funil/etapa; write history.
- [ ] Add `pipeline_reabrir_venda(p_venda_id uuid)` returning the resolved destination (`funil_id`, `etapa_id`, `funil_nome`, `etapa_nome`). Require consultant/gestor/BKO/admin plus order access; require currently concluded; resolve `pipeline_resolve_initial_destination()`; update funil/etapa, clear completion fields, reset stage age; rely on destination trigger/locks for concurrent structure safety; write history.
- [ ] Harden all three RPCs with `SECURITY DEFINER`, `set search_path=public`, explicit `revoke all` and `grant execute to authenticated`.
- [ ] Update `src/integrations/supabase/types.ts` for new `vendas` columns and RPC signatures. Update `src/lib/mock-data.ts`/`Venda` with `concluidoEm?: string`, `concluidoPor?: string`; do not add `concluido` to `FunilId`.
- [ ] Make the Python contract assert that completion is lifecycle state rather than a `pipeline_etapas` seed, that `pipeline_active_sale_count` ignores completed orders, and that `pipeline_move_venda` only accepts `participa_fluxo_comercial=true` destinations.
- [ ] Run `python scripts/check-pipeline-movement-completion-support-priority.py` and `bun test src/lib/pipeline-movement.test.ts`; both must be GREEN.
- [ ] Commit: `feat: centralize commercial movement and completion rpc`.

### Task 3: Store API and commercial `Mover para` UI
- [ ] Refactor `src/lib/omni-store.tsx`: map completion columns in `DbVendaRow`/`dbToVenda`; filter `vendasPipeline` with `!v.concluidoEm`; keep completed rows in base `vendas`; replace direct-update `moveVenda` internals with `rpc('pipeline_move_venda', ...)`; add `concluirVenda(id)` and `reabrirVenda(id)` methods that call the new RPCs, consume returned data and reload state.
- [ ] Create `src/components/move-venda-dialog.tsx`. Props include sale id/current funnel/current stage, role, dynamic funnels/stages, visible commercial funnel ids and `onMoved`. Show grouped active commercial destinations, never Support/current stage. `Continuar` opens an `AlertDialog` displaying `Origem: <funil> → <etapa>` and `Destino: <funil> → <etapa>`; only confirmation calls `moveVenda`.
- [ ] Modify `src/routes/_shell.pipeline.tsx`: remove `dragId`, `onDrop`, commercial `draggable`, `onDragOver`, `onDrop`, grip/cursor-grab and “arraste cards aqui”; empty commercial columns say `sem cards`.
- [ ] Remove `MesFiltroModo`, `mesModo`, `matchMes`, `consultorFiltro`, `filtroOpen`, consultant popover and “Todos os meses” selector completely, not merely visually. Pipeline remains continuous/all-months, still filtered by global operator environment; global month/year header controls remain untouched.
- [ ] Add `Mover para` to every commercial card using the reusable dialog.
- [ ] Preserve the existing semantic shortcuts `Virar Venda` and `Enviar para Assinatura`, but route both through the same `pipeline_move_venda` RPC and a confirmation that shows the resolved origin/destination; they may not bypass the new database rule.
- [ ] On Assinatura only, append a non-draggable terminal summary panel after active stages: `Concluído` + total count for accessible completed orders in the selected operator environment. Do not render completed cards in that panel.
- [ ] For BKO/Admin on signed Claro/Vivo cards, add `Concluir pedido`; confirmation must state that the card sairá do Pipeline ativo e continuará em Pedidos. Call `concluirVenda` only after confirmation.
- [ ] Extend the Python contract: commercial pipeline route has no drag API/local month-consultant filters; `MoveVendaDialog` is present; `support-pipeline.tsx` may retain drag and must still use BKO-only movement.
- [ ] Run `python scripts/check-pipeline-movement-completion-support-priority.py`, `bun test src/lib/pipeline-movement.test.ts src/lib/pipeline-structure.test.ts` and `bun run build`.
- [ ] Commit: `feat: replace commercial drag with confirmed move action`.

### Task 4: Pedido detail, reopen and Clientes/Pedidos consistency
- [ ] Modify `src/routes/_shell.vendas.$id.tsx` to use explicit `venda.concluidoEm` instead of string heuristics such as stage/funnel containing `conclu`.
- [ ] Add the same `Mover para` action on order detail for non-completed commercial orders. Remove generic edit-form ability to persist `funil`/`etapa_id`; show current funnel/stage read-only there so every movement goes through `Mover para` + confirmation + RPC.
- [ ] Show `Concluir pedido` only for BKO/Admin when current stage is signed and sale is not completed. Show `Reabrir pedido` for consultant/gestor/BKO/admin when completed. Reopen dialog explains that destination is automatic; call `reabrirVenda` and show the destination returned by the RPC after success.
- [ ] Modify `src/components/clientes-pedidos.tsx`: include `concluido_em` in pedido/client-sale queries; keep completed orders listed; render a clear `Concluído` badge while preserving last funil/etapa; change client `Situação` filters and status aggregation from legacy `etapa_id='concluido'` logic to `concluido_em is [not] null`, while cancelled/rejected orders continue governed by their own result state.
- [ ] Ensure Pedidos CSV includes `Concluído em` without dropping historical funil/etapa fields.
- [ ] Extend the Python contract to reject commercial lifecycle checks based on `funil='concluido'` or `etapa_id='concluido'`, and to require `concluido_em` in Clientes/Pedidos.
- [ ] Run `python scripts/check-pipeline-movement-completion-support-priority.py`, `bun test src/lib/pipeline-movement.test.ts src/lib/pipeline-structure.test.ts src/lib/deletion-source.test.ts`, `python scripts/check-status-comercial-pedido.py` and `bun run build`.
- [ ] Commit: `feat: add commercial reopen and completed order visibility`.

### Task 5: Support priority domain and database API
- [ ] Create `src/lib/support-priority.test.ts` first with tests for exactly `a_tratar|urgente`, labels, tone metadata, BKO/Admin reclassification permission and explicit independence from Support stage ids.
- [ ] Run `bun test src/lib/support-priority.test.ts` and verify RED because `src/lib/support-priority.ts` does not exist.
- [ ] Implement `src/lib/support-priority.ts` exporting `SupportPriority`, `SUPPORT_PRIORITY_OPTIONS`, label/tone helpers and `canReclassifySupportPriority(role)`. Re-run test GREEN.
- [ ] Create `supabase/migrations/20260915190500_support_request_priority.sql`: add `suporte_solicitacoes.prioridade_atendimento text`; backfill existing rows to `a_tratar`; add CHECK for `('a_tratar','urgente')`; set NOT NULL.
- [ ] Drop the old two-argument `criar_solicitacao_suporte(uuid,text)` overload and recreate it as `criar_solicitacao_suporte(uuid,text,text)` requiring valid priority. Preserve its current authorization and the invariant that it never updates `vendas`. Include initial priority in `suporte_eventos` data/description.
- [ ] Add `reclassificar_prioridade_suporte(p_solicitacao_id uuid, p_prioridade text)`: authenticated BKO/Admin only, lock request, validate value/change, update only `prioridade`, write `prioridade_reclassificada` event with old/new value and actor. It must not update `tickets.etapa_suporte_id`, `vendas.funil` or `vendas.etapa_id`.
- [ ] Keep `criar_card_suporte` creating the card in `s-espera`; keep `mover_card_suporte`, resolve/reopen role semantics unchanged. `prioridade` is the source of truth for the new tag; do not derive it from commercial `vendas.prioridade` or from stage ids `s-urgente`/`s-tratar`.
- [ ] Update `src/integrations/supabase/types.ts` for the new column/RPC signatures.
- [ ] Extend the Python contract with the two-value priority constraint, no-auto-movement rule and BKO-only support movement/resolve invariant.
- [ ] Run `python scripts/check-pipeline-movement-completion-support-priority.py`, `bun test src/lib/support-priority.test.ts src/lib/support-flow.test.ts src/lib/support-source.test.ts`.
- [ ] Commit: `feat: add independent support request priority`.

### Task 6: Support priority frontend, visual urgency and reclassification
- [ ] Update `src/lib/support.functions.ts`: import/export `SupportPriority`; add `prioridade` to `SupportCase`; change `createSupportRequest(vendaId,motivo,prioridade)`; add `reclassifySupportPriority(solicitacaoId, prioridade)`.
- [ ] Create `src/components/support-priority-ui.tsx` with `SupportPriorityBadge` and selection UI backed by the pure `src/lib/support-priority.ts` definitions. `A tratar` uses orange styling; `Urgente` uses destructive red + subtle pulse and a readable text/icon cue.
- [ ] In `src/routes/_shell.vendas.$id.tsx` support modal, make priority an explicit required selection with two visual choices. Do not silently default. Reset it after successful request and include chosen priority in the support creation history/toast context.
- [ ] Add `SupportPriorityBadge` to waiting rows in `src/routes/_shell.suporte.central.tsx`, cards in `src/components/support-pipeline.tsx`, recent cases in `src/routes/_shell.suporte.index.tsx`, and header/detail in `src/routes/_shell.suporte.$id.tsx`.
- [ ] Add a compact reclassification control in Central and Support detail for BKO/Admin only. Criação do card e controles diretos de resolver/reabrir permanecem BKO; movimentação do card usa a regra canônica BKO/Admin.
- [ ] Preserve `usePipelineStructure('support-pipeline-structure-live')` and use `canMoveSupportCard(primaryRole)` so only BKO/Admin can drag Support cards.
- [ ] Reclassification changes only the tag. Even if tag becomes `urgente`, card remains in its current Support stage until BKO/Admin moves it manually.
- [ ] Confirm existing Realtime subscriptions to `suporte_solicitacoes` refresh priority everywhere without introducing duplicate channel names.
- [ ] Extend static contract to require the priority badge on Central/Pipeline/Home/Detail, allow Admin on support movement, and keep card creation/direct resolve/reopen BKO-only.
- [ ] Run `python scripts/check-pipeline-movement-completion-support-priority.py`, `bun test src/lib/support-priority.test.ts src/lib/support-flow.test.ts src/lib/support-source.test.ts` and `bun run build`.
- [ ] Commit: `feat: surface and manage support urgency`.

### Task 7: CI, database validation, PR and deployment
- [ ] Update `.github/workflows/check-pipeline-structure.yml` to run `python scripts/check-pipeline-movement-completion-support-priority.py` and include both new Bun tests in the existing pipeline/support test step. Keep all existing shared contracts.
- [ ] Run branch verification: `python scripts/check-pipeline-structure.py`; `python scripts/check-pipeline-movement-completion-support-priority.py`; `python scripts/check-status-comercial-pedido.py`; `python scripts/check-observacao-tags.py`; `python scripts/check-catalogos-linhas-venda.py`; `bun test src/lib/pipeline-structure.test.ts src/lib/pipeline-movement.test.ts src/lib/support-flow.test.ts src/lib/support-source.test.ts src/lib/support-priority.test.ts src/lib/observacoes-permissions.test.ts src/lib/deletion-source.test.ts`; `bun run build`.
- [ ] Review diff specifically for accidental `routeTree.gen.ts` changes, Support permission expansion, old Supabase project references, commercial direct updates of `funil`/`etapa_id` in user-facing edit/movement paths, and any coupling of priority tag to `s-urgente`/`s-tratar`.
- [ ] Apply both migrations only to external production Supabase `jgruzxaibvjejkjjgxcu` after branch verification is green.
- [ ] Validate transactionally where possible: consultant moves own order but not another consultant's; gestor/BKO/admin commercial movement allowed; consultant/gestor denied commercial conclude; BKO/admin conclude only from signed stages; consultant/gestor/BKO/admin reopen; no active commercial destination blocks reopen; concluded excluded from active-sale occupancy; support request requires priority; BKO/Admin reclassify; consultant/gestor denied reclassify; reclassification does not change Support stage; only BKO moves/resolves Support.
- [ ] Verify priority backfill does not alter any `vendas.prioridade`, move commercial orders, or move existing Support tickets.
- [ ] Open PR from `feat/pipeline-mover-concluir-prioridade-suporte` to `main`; wait for all CI checks GREEN and review the PR diff before merge.
- [ ] Merge with squash only after verification. Observe main CI GREEN.
- [ ] Sync/deploy the existing Lovable project only after main is GREEN; do not create another project and do not use the old Lovable Supabase as production.
- [ ] Production smoke test: commercial card has no drag; `Mover para` confirms origin/destination; signed card can be concluded by BKO/Admin and disappears while counter increments; completed order remains in Clientes/Pedidos and can be reopened to first active commercial destination; support request requires priority; urgent tag is red/pulsing; changing priority does not move stage; Admin can reclassify priority but cannot move/resolve Support; BKO can do both.

## Definition of Done
All approved role rules are enforced in PostgreSQL and mirrored in UI; every commercial move/conclude/reopen and support-priority reclassification is audited; concluded commercial orders remain in Pedidos but never in active Pipeline; Support remains independent and BKO-only for movement/conclusion; priority tags remain independent of Support stages; all contracts/tests/build/CI pass; production DB and published app are on the same behavior.