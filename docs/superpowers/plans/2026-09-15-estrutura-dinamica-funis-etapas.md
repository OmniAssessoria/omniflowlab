# Estrutura Dinâmica de Funis e Etapas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar os cinco funis e suas etapas configuráveis no Supabase, permitindo ativação/desativação e renomeação de etapas por Admin/BKO, com bloqueios de integridade e roteamento sempre para destinos ativos válidos.

**Architecture:** O Supabase passa a ser a fonte de verdade para nome, ordem e estado ativo/inativo de funis e etapas. O frontend terá uma camada única de estrutura (`pipeline-structure`) para leitura e resolução de destinos. Escritas administrativas ocorrerão por RPCs `SECURITY DEFINER` protegidas, auditadas e sem permissão direta de UPDATE nas tabelas. Triggers no banco impedirão vendas e cards de Suporte em destinos inativos. IDs técnicos atuais permanecem imutáveis.

**Tech Stack:** React 19, TanStack Start/Router, TypeScript 5.8, Supabase/PostgreSQL, shadcn/ui, node:test/Bun, Vite, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-15-estrutura-dinamica-funis-etapas-design.md`

## Regras fixas da entrega

- Funis técnicos: `prospeccao`, `followup`, `processos_bko`, `assinatura`, `suporte`.
- Não criar, excluir, reordenar ou trocar IDs de funis/etapas nesta entrega.
- Nome dos funis não será editável; nome das etapas será editável.
- Somente `admin` e `bko` alteram estrutura.
- Funil ativo exige pelo menos uma etapa ativa.
- Desativar funil/etapa ou renomear etapa é bloqueado enquanto houver ocupação ativa naquele escopo.
- Em funis comerciais, ocupação ativa segue a regra do Pipeline: venda não excluída e não finalizada por `cancelado`/`reprovado`.
- Em Suporte, o bloqueio considera **tanto registros legados de venda ainda marcados como `funil = suporte` quanto solicitações/tickets de Suporte não concluídos**. Para o funil inteiro, solicitações aguardando criação de card também contam. Para uma etapa, contam cards/tickets ativos naquela `etapa_suporte_id`.
- Sequência comercial automática: `prospeccao → followup → processos_bko → assinatura`.
- `suporte` é administrável igual aos demais, mas nunca é fallback de criação/avanço comercial.
- Nova venda entra no primeiro funil comercial ativo e na primeira etapa ativa desse funil.
- Avanços automáticos pulam funis/etapas inativos.
- Histórico e IDs técnicos nunca são reescritos por renomeação.
- Funções `SECURITY DEFINER` desta entrega devem ter `EXECUTE` revogado de `PUBLIC`/`anon` e concedido apenas a `authenticated` quando apropriado.
- O repositório é conectado ao Lovable: não rebasear, amend, force-push ou reescrever commits já publicados.

## Arquivos previstos

**Criar**
- `supabase/migrations/20260915170000_pipeline_structure_dynamic.sql`
- `src/lib/pipeline-structure.ts`
- `src/lib/pipeline-structure.test.ts`
- `src/hooks/use-pipeline-structure.ts`
- `scripts/check-pipeline-structure.py`
- `.github/workflows/check-pipeline-structure.yml`

**Modificar**
- `src/integrations/supabase/types.ts`
- `src/routes/_shell.config.tsx`
- `src/routes/_shell.pipeline.tsx`
- `src/lib/omni-store.tsx`
- `src/lib/mock-data.ts`
- `src/components/support-pipeline.tsx`
- `src/lib/support-flow.ts`
- `src/lib/support-flow.test.ts`
- `src/lib/support.functions.ts`
- `src/routes/_shell.vendas.$id.tsx`
- `src/lib/support-source.test.ts`
- `src/components/auditoria-panel.tsx`

---

### Task 1: Definir e testar as regras puras de estrutura

**Files:** `src/lib/pipeline-structure.ts`, `src/lib/pipeline-structure.test.ts`

- [ ] **1.1 Escrever primeiro os testes que falham** para:
  - primeira entrada comercial ignorar Prospecção/Follow Up inativos;
  - primeira etapa inativa ser pulada;
  - Suporte nunca ser fallback comercial;
  - próximo funil comercial pular funis inativos;
  - destino ser válido somente quando funil e etapa estão ativos e vinculados entre si.

Exemplo mínimo:

```ts
test('nova venda cai no primeiro destino comercial ativo', () => {
  assert.deepEqual(firstActiveCommercialDestination(funis, etapas), {
    funilId: 'processos_bko',
    etapaId: 'bko-apoio',
  });
});
```

- [ ] **1.2 Rodar `bun test src/lib/pipeline-structure.test.ts`** e confirmar FAIL por implementação ausente.

- [ ] **1.3 Implementar**:
  - `PipelineFunilId`
  - `PipelineFunil`
  - `PipelineEtapa`
  - `PipelineDestination`
  - `activeFunnels`
  - `activeStagesFor`
  - `firstActiveCommercialDestination`
  - `nextActiveCommercialDestination`
  - `isDestinationActive`
  - helper para primeira etapa ativa de um funil nominal (`firstActiveDestinationForFunnel`) para ações com destino explícito.

- [ ] **1.4 Rodar testes novamente** e exigir PASS.

- [ ] **1.5 Commit:** `test: define regras da estrutura dinâmica do pipeline`.

---

### Task 2: Criar catálogos, segurança, auditoria e integridade no Supabase

**Files:** `supabase/migrations/20260915170000_pipeline_structure_dynamic.sql`, `src/integrations/supabase/types.ts`

- [ ] **2.1 Criar `pipeline_funis` e `pipeline_etapas`** e semear exatamente os 5 funis e 53 etapas atuais de `src/lib/mock-data.ts`, preservando IDs, nomes iniciais, cores e ordem. `participa_fluxo_comercial=false` somente para `suporte`.

Schema base:

```sql
create table public.pipeline_funis (
  id text primary key,
  nome text not null,
  ordem integer not null unique,
  ativo boolean not null default true,
  participa_fluxo_comercial boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pipeline_etapas (
  id text primary key,
  funil_id text not null references public.pipeline_funis(id) on delete restrict,
  nome text not null check (char_length(btrim(nome)) > 0),
  cor text not null,
  ordem integer not null unique,
  ativo boolean not null default true,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **2.2 Habilitar RLS** com SELECT para `authenticated`, sem políticas diretas de INSERT/UPDATE/DELETE. Estrutura só muda por RPC.

- [ ] **2.3 Criar helper de autorização** usado pelas RPCs, aceitando apenas Admin/BKO. Todas as funções `SECURITY DEFINER` devem usar `set search_path = public`, ter `revoke all on function ... from public, anon` e `grant execute ... to authenticated`.

- [ ] **2.4 Criar helpers transacionais de ocupação.**
  - Comercial: contar vendas não excluídas e não `cancelado/reprovado`.
  - Suporte/funil: somar vendas legadas ativas com `vendas.funil='suporte'` + solicitações `status <> 'concluido'`.
  - Suporte/etapa: somar vendas legadas ativas naquela etapa, se existirem, + solicitações não concluídas ligadas a tickets naquela `etapa_suporte_id`.

- [ ] **2.5 Criar RPCs administrativas**:
  - `pipeline_set_funil_ativo(p_funil_id, p_ativo)`
  - `pipeline_set_etapa_ativo(p_etapa_id, p_ativo)`
  - `pipeline_rename_etapa(p_etapa_id, p_nome)`

Regras dentro das RPCs:
  - lock da linha estrutural (`FOR UPDATE`);
  - bloqueio com quantidade quando ocupação > 0;
  - bloquear desligamento da última etapa ativa de funil ativo;
  - bloquear reativação de funil sem etapa ativa;
  - nunca alterar ID técnico;
  - registrar em `audit_logs` com `entidade`, `entidade_id`, `valor_anterior`, `valor_novo`, usuário e descrição.

Ações de auditoria:
`pipeline_funil_ativacao`, `pipeline_funil_desativacao`, `pipeline_etapa_ativacao`, `pipeline_etapa_desativacao`, `pipeline_etapa_renomeacao`.

- [ ] **2.6 Criar resolutores SQL**:
  - `pipeline_resolve_initial_destination()`
  - `pipeline_resolve_next_destination(p_current_funil_id text)`
  - `pipeline_resolve_funnel_destination(p_funil_id text)` para ações que têm destino nominal e não devem ser confundidas com “próximo funil”.

Os resolutores comerciais devem usar somente funis `ativo=true AND participa_fluxo_comercial=true`.

- [ ] **2.7 Criar guard de destino para `vendas`.** Trigger `BEFORE INSERT OR UPDATE OF funil, etapa_id` rejeita funil/etapa inativo ou vínculo inconsistente. Não rodar em UPDATE de campos alheios, para permitir manutenção de históricos finalizados que ficaram em etapa posteriormente inativada.

- [ ] **2.8 Criar guard de destino para tickets de Suporte** (`solicitacao_id is not null`) exigindo funil Suporte ativo e `etapa_suporte_id` ativa.

- [ ] **2.9 Substituir implementações dos RPCs de Suporte** que hoje assumem `s-espera`:
  - `criar_solicitacao_suporte`: bloquear se Suporte inativo;
  - `criar_card_suporte`: usar primeira etapa ativa de Suporte;
  - `mover_card_suporte`: rejeitar etapa inativa;
  - `reabrir_solicitacao_suporte`: usar primeira etapa ativa de Suporte quando precisar recolocar card.
  - O pedido comercial nunca é movido para `funil='suporte'`.

- [ ] **2.10 Aplicar a migração no Supabase externo** e validar em transações com rollback:
  - contagens: 5 funis, 53 etapas, 4 comerciais;
  - Admin altera estrutura vazia;
  - BKO altera estrutura vazia;
  - Consultor recebe 403;
  - `anon`/PUBLIC não executa RPC protegida;
  - funil/etapa ocupados são bloqueados;
  - ocupação legada em `vendas.funil='suporte'` bloqueia Suporte;
  - solicitação/card ativo bloqueia Suporte;
  - última etapa ativa não pode ser desligada;
  - resolutor inicial pula Prospecção/Follow Up inativos;
  - Support nunca aparece nos resolutores comerciais.

- [ ] **2.11 Atualizar `src/integrations/supabase/types.ts`** com tabelas e RPCs sem introduzir novo `as any` para essa estrutura.

- [ ] **2.12 Commit:** `feat: adiciona estrutura dinâmica de funis e etapas`.

---

### Task 3: Criar um hook único de leitura/realtime

**File:** `src/hooks/use-pipeline-structure.ts`

- [ ] **3.1 Implementar `usePipelineStructure()`** carregando funis/etapas por `ordem`.
- [ ] **3.2 Assinar Realtime** para `pipeline_funis` e `pipeline_etapas` com debounce de refresh.
- [ ] **3.3 Expor** `funis`, `etapas`, `loading`, `error`, `refresh`, `setFunilAtivo`, `setEtapaAtiva`, `renameEtapa`, `initialDestination`, `supportEnabled` e helpers de nome/destino.
- [ ] **3.4 Wrappers de mutação** chamam RPC e preservam a mensagem exata do banco, inclusive a quantidade de itens bloqueadores.
- [ ] **3.5 Rodar `bun test src/lib/pipeline-structure.test.ts` e `bun run build`.**
- [ ] **3.6 Commit:** `feat: centraliza leitura da estrutura do pipeline`.

---

### Task 4: Tornar Configurações → Estrutura administrável

**File:** `src/routes/_shell.config.tsx`

- [ ] **4.1 Substituir `FUNIS/ETAPAS` como fonte da tela** por `usePipelineStructure()`. Mostrar sempre os cinco funis, inclusive inativos.
- [ ] **4.2 Em cada funil mostrar** nome, total de etapas, total ativas e estado. Verde=ativo; vermelho/esmaecido=inativo.
- [ ] **4.3 Em cada etapa mostrar** nome, estado, indicador verde/vermelho, Switch e ação “Editar nome”.
- [ ] **4.4 Controles editáveis somente para Admin/BKO.** Demais perfis apenas visualizam.
- [ ] **4.5 Implementar diálogo de renomeação** e tratamento de bloqueios. Não oferecer botão “forçar/continuar”.
- [ ] **4.6 Rodar build.**
- [ ] **4.7 Commit:** `feat: permite administrar funis e etapas`.

---

### Task 5: Criar novas vendas no primeiro destino comercial ativo

**Files:** `src/routes/_shell.pipeline.tsx`, `scripts/check-pipeline-structure.py`

- [ ] **5.1 Criar primeiro um contrato que falha** exigindo que `NovaVendaDialog` não contenha mais `funil: "prospeccao"` junto de `etapa_id: "p-aguardando"` como destino fixo.
- [ ] **5.2 Antes do INSERT chamar `pipeline_resolve_initial_destination`.** Se não houver destino, bloquear criação com mensagem clara para corrigir Configurações → Estrutura.
- [ ] **5.3 Inserir venda com `funil_id/etapa_id` retornados** e usar nome dinâmico na confirmação.
- [ ] **5.4 Rodar contrato e build.**
- [ ] **5.5 Commit:** `feat: cria vendas no primeiro destino ativo`.

---

### Task 6: Aplicar estrutura dinâmica ao Pipeline e movimentações comerciais

**Files:** `src/routes/_shell.pipeline.tsx`, `src/lib/omni-store.tsx`, `src/lib/mock-data.ts`

- [ ] **6.1 Renderizar somente funis ativos no Pipeline** e somente etapas ativas como colunas. Se o funil selecionado for desligado por Realtime, selecionar o primeiro funil ativo disponível.
- [ ] **6.2 Suporte só aparece como aba quando ativo.** Sua contagem continua vindo do fluxo próprio de Suporte.
- [ ] **6.3 Refatorar `moveVenda`** para não derivar destino de `ETAPAS` legado. Movimento manual exige `isDestinationActive` antes do update otimista e do banco.
- [ ] **6.4 Substituir automações hardcoded** (`f-contrato → bko-pendente`, `bko-assinatura → a-aguardando`) por resolutores ativos coerentes com a intenção da ação.
  - Ações de **avanço sequencial** usam `pipeline_resolve_next_destination`.
  - Ações de **destino nominal explícito** usam `pipeline_resolve_funnel_destination` para o funil nomeado; não devem ser silenciosamente reinterpretadas como “próximo funil”. Se o destino nominal estiver inativo, bloquear com mensagem clara.
- [ ] **6.5 Atualizar “Virar Venda”** para avanço sequencial a partir de Prospecção, pulando Follow Up se estiver inativo.
- [ ] **6.6 Revisar ações de Assinatura** para preservar a intenção atual do botão/automação e impedir que um rótulo “Assinatura” leve a outro funil por engano.
- [ ] **6.7 Histórico de movimentação** deve resolver nomes atuais pelo catálogo dinâmico, preservando IDs e snapshots antigos já gravados.
- [ ] **6.8 Manter `FUNIS`, `ETAPAS`, `FunilId` e `normalizarEtapa` apenas como compatibilidade/legado**, com comentário explícito de que não controlam disponibilidade nem nomes principais.
- [ ] **6.9 Rodar testes e build.**
- [ ] **6.10 Commit:** `feat: aplica estrutura ativa ao pipeline comercial`.

---

### Task 7: Aplicar a estrutura dinâmica ao detalhe do pedido e ao Suporte

**Files:** `src/routes/_shell.vendas.$id.tsx`, `src/components/support-pipeline.tsx`, `src/lib/support-flow.ts`, `src/lib/support-flow.test.ts`, `src/lib/support.functions.ts`, `src/lib/support-source.test.ts`

- [ ] **7.1 No detalhe do pedido, substituir `getEtapa/FUNIS.find` do cabeçalho** por nomes vindos do catálogo dinâmico. Assim renomear uma etapa reflete também em `FUNIL → ETAPA` abaixo do cliente.
- [ ] **7.2 No formulário de edição do pedido, destinos de funil/etapa devem listar somente estrutura ativa e coerente.** Não permitir salvar manualmente destino inativo; banco continua sendo a última barreira.
- [ ] **7.3 Em `SupportPipeline`, remover `ETAPAS` como fonte** e usar etapas ativas do funil `suporte`. Toasts também usam nomes dinâmicos.
- [ ] **7.4 Tornar `reopenTarget` destino-aware**, recebendo a primeira etapa ativa de Suporte em vez de forçar `s-espera`. Testar com uma alternativa, como `s-tratar`.
- [ ] **7.5 Bloquear “Enviar para Suporte” quando Suporte estiver inativo**, mostrando: `O funil Suporte está desativado em Configurações → Estrutura.`
- [ ] **7.6 Preservar a independência do Suporte:** solicitar Suporte não move o pedido comercial. Atualizar `support-source.test.ts` para garantir que SupportPipeline usa estrutura dinâmica e que o pedido permanece no funil comercial atual.
- [ ] **7.7 Rodar testes de Suporte e build.**
- [ ] **7.8 Commit:** `feat: aplica estrutura ativa ao detalhe e suporte`.

---

### Task 8: Auditoria visual, contrato e CI

**Files:** `src/components/auditoria-panel.tsx`, `scripts/check-pipeline-structure.py`, `.github/workflows/check-pipeline-structure.yml`

- [ ] **8.1 Adicionar estilos/labels de auditoria** para as cinco ações `pipeline_*`, usando o `audit_logs` existente.
- [ ] **8.2 Completar contrato estático** validando:
  - 5 funis e 53 etapas seedadas;
  - checks Admin/BKO;
  - revogação de EXECUTE de `PUBLIC/anon` nas RPCs privilegiadas;
  - resolver comercial exclui Suporte;
  - Nova Venda não hardcoda Prospecção/Aguardando Início;
  - Pipeline e detalhe usam estrutura dinâmica;
  - SupportPipeline usa estrutura dinâmica;
  - guards de destino existem;
  - RPCs de ativação/desativação/renomeação existem.
- [ ] **8.3 Criar workflow `Check Pipeline Structure`** para branch de feature, PR e `main`: Python contract → `bun install --frozen-lockfile` → testes focados → `bun run build`.
- [ ] **8.4 Rodar localmente os mesmos comandos.**
- [ ] **8.5 Commit:** `ci: valida estrutura dinâmica do pipeline`.

---

### Task 9: Verificação funcional completa e integração

- [ ] **9.1 Banco/perfis:** confirmar Admin e BKO alteram estrutura vazia; Gestor/Consultor/anon não conseguem escrever.
- [ ] **9.2 Bloqueios comerciais:** criar transação de teste com venda ativa e provar bloqueio de desativar funil, desativar etapa e renomear etapa; rollback.
- [ ] **9.3 Bloqueios Suporte:** testar separadamente venda legada em `funil='suporte'`, solicitação aguardando card e ticket ativo; todos devem bloquear o escopo adequado; rollback.
- [ ] **9.4 Matriz de entrada:**

| Estrutura ativa | Destino esperado |
| --- | --- |
| todos comerciais ativos | Prospecção → Aguardando Início |
| Prospecção inativa | Follow Up → primeira etapa ativa |
| Prospecção + Follow Up inativos | Processos BKO → primeira etapa ativa |
| primeira etapa BKO inativa | Processos BKO → próxima etapa ativa |
| 4 comerciais inativos | criação bloqueada |
| somente Suporte ativo | criação bloqueada |

- [ ] **9.5 Transições:** confirmar “Virar Venda” pula Follow Up inativo e chega ao primeiro destino ativo seguinte; confirmar ações nominais não são redirecionadas silenciosamente para outro funil.
- [ ] **9.6 UI:** Admin/BKO veem controles; Gestor/Consultor não. Verde/vermelho e mensagens de bloqueio corretas. Renomeação reflete Configurações, Pipeline e cabeçalho do pedido.
- [ ] **9.7 Suporte:** funil some do Pipeline quando inativo; solicitação é bloqueada; reativação restaura o fluxo sem perder histórico; card/reabertura usa primeira etapa ativa.
- [ ] **9.8 Rodar verificação automatizada final:**

```bash
python scripts/check-pipeline-structure.py
bun test src/lib/pipeline-structure.test.ts src/lib/support-flow.test.ts src/lib/support-source.test.ts src/lib/observacoes-permissions.test.ts src/lib/deletion-source.test.ts
bun run build
```

- [ ] **9.9 Abrir PR:** `Implementa estrutura dinâmica de funis e etapas`. Não integrar enquanto CI novo e workflows existentes não estiverem verdes.
- [ ] **9.10 Integrar sem reescrever histórico**, revalidar a `main`, confirmar sincronização do mesmo SHA no Lovable e só então disparar publicação.

## Self-review do plano

- **Cobertura da spec:** permissões, bloqueios, entrada automática, transições, Suporte, auditoria, UI e segurança estão mapeados para tarefas e testes.
- **Placeholders:** não há `TBD`, `TODO` ou requisito deixado em aberto.
- **Consistência de tipos:** IDs técnicos permanecem `text` no banco e union/string no frontend; nomes são apenas apresentação; `vendas.funil/etapa_id` e `tickets.etapa_suporte_id` continuam compatíveis com IDs existentes.
- **Correções incorporadas na revisão:** RPCs privilegiadas com EXECUTE restrito; ocupação de Suporte inclui fluxo novo e legado; detalhe do pedido usa nomes dinâmicos; avanço sequencial foi separado de ações com destino nominal explícito.