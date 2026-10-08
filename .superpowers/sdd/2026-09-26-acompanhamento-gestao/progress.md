# SDD ledger — plan: docs/superpowers/plans/2026-09-26-acompanhamento-gestao.md

Base branch: main
Feature branch: feat/acompanhamento-gestao-20260926
Base commit: a5f70b4ee405a62ce99475c4cfff2df7c6cce13f

Pre-flight:
- Task 1 -> Task 2: Task 2 consumes the acompanhamento_* tables created by Task 1. Interface consistent.
- Task 2 -> Task 3: Task 3 consumes bootstrap/config mutation server functions from Task 2. Interface consistent.
- Task 2/3 -> Task 4: Task 4 consumes consultant/meta bootstrap and save functions. Interface consistent.
- Task 2/3/4 -> Task 5: Task 5 composes the data/config/target components. Interface consistent.
- Task 5 -> Task 6: Task 6 exposes and guards the route created by Task 5. Interface consistent.
- Ruling: because the connected GitHub environment has no writable local checkout/worktree, the remote feature branch is the isolated workspace. CI/PR checks will provide executable verification where possible. Cost if wrong: branch-only changes remain isolated and can be discarded without touching main.

Task 1: complete
- RED observed: Check Acompanhamento Gestão run 36246821092 failed before migration existed.
- GREEN schema contract: migration content passed all contract assertions in remote-source verification.
- Supabase migration applied successfully as acompanhamento_gestao_base.
- DB verification: 8/8 tables, 8/8 RLS, 8 quadros, 28 preconfigured status-source rules, zero monthly/weekly/consultant metas, zero type links.
- Advisors: no new security finding attributed to acompanhamento_* objects. New unused-index INFO entries are expected immediately after table creation; unrelated pre-existing advisor findings left unchanged.
- Ruling: GitHub Actions jobs are currently completing as failure without exposing steps/logs (all PR workflows affected), so executable CI cannot be used as the sole completion gate. Database verification + source contracts are used until Actions becomes observable. Cost if wrong: frontend build issues must be caught by later source review or CI when runners resume.

Task 2: complete
- RED: acompanhamento.test.ts and no-sales contract were committed before implementation; helper/data layer files were absent.
- Helper verification: Node 22 type-stripping execution passed normalization and 4/5-week assertions.
- No-sales source contract: PASS; acompanhamento.functions.ts does not query vendas/venda_linhas or aggregate sales values.
- RLS smoke: Gestor sees 8 acompanhamento_quadros; Consultor sees 0.
- Bootstrap/services implemented with server-side Admin/Gestor role check, active consultant discovery, historical consultant preservation, order-type catalog, manual statuses, robot-status discovery, pipeline stages, targets, groups and independent card rules.
- Ruling: phase-1 operational weeks are display/planning buckets 1-7, 8-14, 15-21, 22-28, 29-end. This is scaffolding only; the spec explicitly defers the final week rule until the manager validates it. Cost if wrong: labels/distribution helper changes later, without affecting sales history because phase 1 calculates no sales.

Task 3: complete
- Configuration UI source contract PASS after implementation.
- RLS write smoke as Gestor: temporary type link insert returned 1 and temporary card-rule insert returned 1; both transactions rolled back.
- Regression fix RED→GREEN: existing card rules were not copied into the controlled Dialog draft on open; contract failed before useEffect sync and passes after it.
- Regression fix RED→GREEN: temporary type selection was keyed only by tipo ID and could leak across contexts; contract failed before context+type key and passes after it.
- No fallback to Outros; unclassified types remain pending.

Task 4: complete
- Pure helper verification PASS with Node 22 type stripping: exact-cent weekly split, five-week support, manual weekly override preservation, inactive-historical consultant retention and inactive exclusion from new targets.
- RLS target-write smoke as Gestor: monthly, weekly and consultant target writes all returned 1 in a transaction; rollback verified all test rows remain zero in production.
- Ruling: initial automatic target suggestion maps monthly NP/Fixa → Novo/Importado and monthly Outros → Renovação because the approved flow requires an automatic starting split but the final commercial nomenclature is still pending manager validation. UI labels this as provisional/editable and no sales result uses it. Cost if wrong: only the suggested weekly target distribution changes later; explicit manual weekly values remain authoritative.

Task 5: complete
- Page source contract PASS: all approved sections and local Tudo/Claro/Vivo filter are present.
- Page contains no spreadsheet monetary examples and no AG TEMPO INPUT rule.
- Results remain neutral placeholders (“Aguardando configuração” / “Aguardando integração”); phase-1 server data layer source contract confirms no vendas/venda_linhas queries.
- Main page composes monthly target, Claro/Vivo process cards, total, residual, weekly targets/results, consultant tables and four operational status cards.
