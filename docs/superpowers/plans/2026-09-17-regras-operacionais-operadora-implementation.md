# Regras Operacionais por Operadora Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as quatro regras aprovadas: um único doador por linha com indicador visual, biometria exclusiva da CLARO, Tipo de Produto isolado por operadora com renomeação propagada apenas no mesmo escopo, e acesso do Consultor ao funil Assinatura sem ampliar sua faixa no Processos BKO.

**Architecture:** As regras críticas serão duplicadas de forma intencional em duas camadas: helpers/testes de frontend para orientar e filtrar a interface, e migrations/funções do Supabase para garantir integridade mesmo em chamadas diretas. Cada regra será implementada e validada isoladamente antes do checkpoint integrado final. O código existente de bônus, Nota e Histórico será preservado, exceto pela remoção explícita da biometria em Nota/PDF VIVO.

**Tech Stack:** React 19, TypeScript, TanStack Router/Start, Bun test, Supabase/PostgreSQL, Tailwind/shadcn, jsPDF.

**Spec:** `docs/superpowers/specs/2026-09-17-regras-operacionais-operadora-design.md`

## Global Constraints

- Cada `venda_linhas` pode possuir zero ou um doador.
- VIVO usa `tem_biometria = false` e `status_biometria = null`; biometria é exclusiva da CLARO.
- CLARO e VIVO têm catálogos independentes de Tipo de Produto.
- Renomeação de Tipo de Produto propaga somente para linhas da mesma operadora.
- Exclusão de Tipo de Produto preserva o texto histórico das linhas existentes.
- Consultor continua limitado a `bko-pendente`, `bko-apoio` e `bko-troca` dentro de Processos BKO.
- Consultor pode entrar em Assinatura apenas pela primeira etapa ativa compatível com a operadora e, depois, circular apenas entre etapas ativas de Assinatura.
- Consultor continua sem permissão adicional para concluir pedidos.
- VIVO nunca pode receber destino `a-biometria`.
- Não alterar as regras de bônus VIVO, Histórico unificado ou Nota do Pedido além da remoção de biometria para VIVO.

---

### Task 1: Tornar o doador único por linha e exibir o indicador visual

**Files:**
- Create: `src/lib/linha-doador.ts`
- Create: `src/lib/linha-doador.test.ts`
- Modify: `src/components/linha-operational-extras.tsx`
- Create: `supabase/migrations/20260917193000_single_donor_per_line.sql`

**Interfaces:**
- Produces: `doadorLinhaLabel(doador: { nome_completo?: string | null } | null | undefined): string | null`
- Produces: `hasDoador(doador: unknown): boolean`
- Database invariant: unique `venda_linha_doadores(linha_id)`.

- [ ] **Step 1: Write the failing helper test**

```ts
import { describe, expect, test } from "bun:test";
import { doadorLinhaLabel, hasDoador } from "./linha-doador";

describe("linha com doador único", () => {
  test("sem doador não mostra indicador", () => {
    expect(hasDoador(null)).toBe(false);
    expect(doadorLinhaLabel(null)).toBeNull();
  });

  test("com doador mostra um único indicador", () => {
    const doador = { nome_completo: "Maria Silva" };
    expect(hasDoador(doador)).toBe(true);
    expect(doadorLinhaLabel(doador)).toBe("Doador");
  });
});
```

- [ ] **Step 2: Run the failing test**

```bash
bun test src/lib/linha-doador.test.ts
```

Expected: FAIL because `src/lib/linha-doador.ts` does not exist.

- [ ] **Step 3: Add the minimal helper implementation**

```ts
export function hasDoador(doador: unknown): boolean {
  return Boolean(doador);
}

export function doadorLinhaLabel(
  doador: { nome_completo?: string | null } | null | undefined,
): string | null {
  return doador ? "Doador" : null;
}
```

- [ ] **Step 4: Run the helper test again**

```bash
bun test src/lib/linha-doador.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Add the database invariant migration**

Create `supabase/migrations/20260917193000_single_donor_per_line.sql`:

```sql
do $$
begin
  if exists (
    select 1
    from public.venda_linha_doadores
    group by linha_id
    having count(*) > 1
  ) then
    raise exception 'Existem linhas com mais de um doador; resolva duplicidades antes de aplicar a regra.';
  end if;
end;
$$;

create unique index if not exists uq_venda_linha_doadores_linha_id
  on public.venda_linha_doadores(linha_id);
```

Apply this migration through Supabase migration tooling, not raw DDL execution.

- [ ] **Step 6: Refactor `LinhaOperationalExtras` from array to single record**

Change state from:

```ts
const [doadores, setDoadores] = useState<Doador[]>([]);
```

to:

```ts
const [doador, setDoador] = useState<Doador | null>(null);
const [editingDoador, setEditingDoador] = useState(false);
```

Replace the loader with:

```ts
const loadDoador = useCallback(async () => {
  if (!aceitaDoador) {
    setDoador(null);
    return;
  }
  const { data, error } = await (supabase as any)
    .from("venda_linha_doadores")
    .select("id, linha_id, nome_completo, email, telefone, operadora")
    .eq("linha_id", linhaId)
    .maybeSingle();
  if (error) {
    toast.error("Não foi possível carregar o doador", { description: error.message });
    return;
  }
  setDoador((data ?? null) as Doador | null);
}, [linhaId, aceitaDoador]);
```

Load on mount and on dialog open:

```ts
useEffect(() => { void loadDoador(); }, [loadDoador]);
useEffect(() => { if (open) void loadDoador(); }, [open, loadDoador]);
```

- [ ] **Step 7: Make add/edit/remove mutually exclusive**

For insert, reject locally if a donor already exists:

```ts
if (doador) {
  toast.error("Esta linha já possui um doador.");
  return;
}
```

For edit, populate the form with the existing donor before entering edit mode:

```ts
function iniciarEdicaoDoador() {
  if (!doador) return;
  setNome(doador.nome_completo);
  setEmail(doador.email);
  setTelefone(doador.telefone);
  setOpDoador(doador.operadora);
  setEditingDoador(true);
}
```

Save edit by updating the existing row:

```ts
const { error } = await (supabase as any)
  .from("venda_linha_doadores")
  .update({
    nome_completo: nome.trim(),
    email: email.trim().toLowerCase(),
    telefone: telefone.trim(),
    operadora: opDoador.trim(),
  })
  .eq("id", doador.id);
```

After successful edit:

```ts
setEditingDoador(false);
setNome("");
setEmail("");
setTelefone("");
setOpDoador("");
await loadDoador();
```

After remove:

```ts
setDoador(null);
setEditingDoador(false);
setNome("");
setEmail("");
setTelefone("");
setOpDoador("");
```

The modal must render exactly one of these branches:

```tsx
{doador && !editingDoador ? (
  <div className="rounded-lg border border-border bg-muted/15 p-3">
    <div className="text-sm font-semibold">{doador.nome_completo}</div>
    <div className="text-xs text-muted-foreground break-all">
      {doador.email} · {doador.telefone}
    </div>
    <Badge variant="outline" className="mt-1 text-[9px]">{doador.operadora}</Badge>
    {canEdit && (
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={iniciarEdicaoDoador}>Editar</Button>
        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => void excluirDoador(doador.id)}>Remover</Button>
      </div>
    )}
  </div>
) : canEdit ? (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border pt-4">
    <div className="space-y-1.5 sm:col-span-2"><Label>Nome completo</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
    <div className="space-y-1.5"><Label>E-mail</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
    <div className="space-y-1.5"><Label>Telefone</Label><Input value={telefone} onChange={e => setTelefone(e.target.value)} /></div>
    <div className="space-y-1.5"><Label>Operadora</Label><Input value={opDoador} onChange={e => setOpDoador(e.target.value)} maxLength={80} /></div>
    <div className="flex items-end">
      <Button type="button" className="w-full" onClick={() => void (editingDoador ? salvarEdicaoDoador() : adicionarDoador())}>
        {editingDoador ? "Salvar doador" : "Adicionar doador"}
      </Button>
    </div>
  </div>
) : null}
```

- [ ] **Step 8: Render the donor indicator beside bonus**

Replace the current bonus-only portal with:

```tsx
{tipoProdutoCell && (bonusLabel || doador) && createPortal(
  <div className="mt-1 flex flex-wrap gap-1">
    {bonusLabel && (
      <Badge
        variant="outline"
        className="gap-1 border-[var(--vivo)]/40 bg-[var(--vivo)]/10 text-[10px] font-semibold text-[var(--vivo)]"
      >
        <Gift className="size-3" /> {bonusLabel}
      </Badge>
    )}
    {doador && (
      <Badge
        variant="outline"
        className="gap-1 border-[var(--omni)]/45 bg-[var(--omni)]/10 text-[10px] font-semibold text-[var(--omni)]"
      >
        <Users className="size-3" /> Doador
      </Badge>
    )}
  </div>,
  tipoProdutoCell,
)}
```

- [ ] **Step 9: Verify database and UI contract**

```bash
bun test src/lib/linha-doador.test.ts
bun run build
```

Supabase check:

```sql
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'venda_linha_doadores'
  and indexname = 'uq_venda_linha_doadores_linha_id';
```

Expected: one UNIQUE index on `linha_id`.

- [ ] **Step 10: Commit Task 1**

```bash
git add src/lib/linha-doador.ts src/lib/linha-doador.test.ts src/components/linha-operational-extras.tsx supabase/migrations/20260917193000_single_donor_per_line.sql
git commit -m "feat: enforce single donor per line"
```

---

### Task 2: Remover biometria da VIVO em UI, Nota, PDF, banco e destinos

**Files:**
- Create: `src/lib/biometria-operadora.ts`
- Create: `src/lib/biometria-operadora.test.ts`
- Modify: `src/components/pedido-header-meta.tsx`
- Modify: `src/components/commercial-pipeline.tsx`
- Modify: `src/routes/_shell.vendas.$id.tsx`
- Modify: `src/lib/pedido-nota-live.ts`
- Modify: `src/lib/pdf-nota-live.ts`
- Modify: `src/lib/pipeline-movement.ts`
- Modify: `src/lib/pipeline-movement.test.ts`
- Create: `supabase/migrations/20260917194000_vivo_without_biometrics.sql`

**Interfaces:**
- Produces: `supportsBiometria(operadora: string | null | undefined): boolean`
- Produces: `isStageAllowedForOperadora(etapaId: string, operadora: string | null | undefined): boolean`
- `availableCommercialDestinations` gains `operadora?: string | null`.

- [ ] **Step 1: Write failing operator-rule tests**

```ts
import { describe, expect, test } from "bun:test";
import { isStageAllowedForOperadora, supportsBiometria } from "./biometria-operadora";

describe("biometria por operadora", () => {
  test("CLARO aceita biometria", () => {
    expect(supportsBiometria("CLARO")).toBe(true);
    expect(isStageAllowedForOperadora("a-biometria", "CLARO")).toBe(true);
  });

  test("VIVO não aceita biometria", () => {
    expect(supportsBiometria("VIVO")).toBe(false);
    expect(isStageAllowedForOperadora("a-biometria", "VIVO")).toBe(false);
    expect(isStageAllowedForOperadora("a-d1", "VIVO")).toBe(true);
  });
});
```

- [ ] **Step 2: Run failing test**

```bash
bun test src/lib/biometria-operadora.test.ts
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement operator rules**

```ts
export function supportsBiometria(operadora: string | null | undefined): boolean {
  return String(operadora ?? "").toUpperCase() === "CLARO";
}

export function isStageAllowedForOperadora(
  etapaId: string,
  operadora: string | null | undefined,
): boolean {
  return supportsBiometria(operadora) || etapaId !== "a-biometria";
}
```

- [ ] **Step 4: Pass the helper test**

```bash
bun test src/lib/biometria-operadora.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Hide biometric UI for VIVO**

In `src/components/pedido-header-meta.tsx`, add:

```ts
import { supportsBiometria } from "@/lib/biometria-operadora";
```

Replace:

```ts
const isClaro = String(operadora).toUpperCase() === "CLARO";
```

with:

```ts
const isClaro = supportsBiometria(operadora);
```

Then place the opening condition `{isClaro && (` immediately before the existing `<Popover ...>` that renders biometrics, and close it with `)}` immediately after that Popover's `</Popover>`. Do not wrap the operator badge or the `ATIVADO 100%` badge.

In `src/routes/_shell.vendas.$id.tsx` replace:

```ts
const podeEditarBiometriaStatus = isAdmin || isBKO;
```

with:

```ts
const podeEditarBiometriaStatus = (isAdmin || isBKO) && venda?.operadora === "CLARO";
```

In `src/components/commercial-pipeline.tsx` replace:

```tsx
{venda.statusBiometria && <Fingerprint className={cn("size-3", venda.statusBiometria === "concluido" ? "text-success" : venda.statusBiometria === "cancelado" ? "text-destructive" : "text-warning")} />}
```

with:

```tsx
{venda.operadora === "CLARO" && venda.statusBiometria && (
  <Fingerprint
    className={cn(
      "size-3",
      venda.statusBiometria === "concluido"
        ? "text-success"
        : venda.statusBiometria === "cancelado"
          ? "text-destructive"
          : "text-warning",
    )}
  />
)}
```

- [ ] **Step 6: Remove VIVO biometrics from canonical Note model and PDF**

In `PedidoNotaLive`, change:

```ts
biometria: string;
```

to:

```ts
biometria: string | null;
```

When building the model, replace:

```ts
biometria: humanize(venda.status_biometria),
```

with:

```ts
biometria: String(venda.operadora).toUpperCase() === "CLARO"
  ? humanize(venda.status_biometria)
  : null,
```

At the start of `formatPedidoNotaText`, after `ref`, add:

```ts
const biometriaLine = model.operacao.biometria
  ? `Biometria: ${model.operacao.biometria}\n`
  : "";
```

Replace the fixed text:

```text
Biometria: ${model.operacao.biometria}
Portabilidade: ${model.operacao.portabilidade}
```

with:

```text
${biometriaLine}Portabilidade: ${model.operacao.portabilidade}
```

In `src/lib/pdf-nota-live.ts`, replace the entire `operationLines` declaration with:

```ts
const operationLines = [
  `Status do pedido: ${model.statusPedido}${model.statusPedidoObs ? ` · ${model.statusPedidoObs}` : ""}`,
  `SLA: ${model.operacao.sla} · Prioridade: ${model.operacao.prioridade}`,
  ...(model.operacao.biometria ? [`Biometria: ${model.operacao.biometria}`] : []),
  `Portabilidade: ${model.operacao.portabilidade}`,
  `Próxima ação: ${model.operacao.proximaAcao} · ${formatPedidoDate(model.operacao.proximaAcaoData)}`,
  `Nota fiscal: ${model.operacao.notaFiscal} · Rastreio: ${model.operacao.codigoRastreio}`,
  `Equipamentos: ${model.operacao.equipamentos}`,
  `Viabilidade fixa: ${model.operacao.viabilidadeFixa} · Cotação: ${model.operacao.cotacao}`,
];
```

- [ ] **Step 7: Add VIVO biometric database guard and cleanup**

Create `supabase/migrations/20260917194000_vivo_without_biometrics.sql`:

```sql
create or replace function public.guard_venda_biometria_operadora()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.operadora = 'VIVO'::public.operadora_enum then
    new.tem_biometria := false;
    new.status_biometria := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_venda_biometria_operadora on public.vendas;
create trigger trg_guard_venda_biometria_operadora
before insert or update of operadora, tem_biometria, status_biometria
on public.vendas
for each row execute function public.guard_venda_biometria_operadora();

update public.vendas
set tem_biometria = false,
    status_biometria = null
where operadora = 'VIVO'::public.operadora_enum
  and (coalesce(tem_biometria, false) = true or status_biometria is not null);
```

Apply with Supabase migration tooling.

- [ ] **Step 8: Extend movement tests to filter biometric destination for VIVO**

Add this fixture stage in `src/lib/pipeline-movement.test.ts`:

```ts
{ id: "a-biometria", funil_id: "assinatura", nome: "Aguardando Biometria", cor: "warning", ordem: 37, ativo: true },
```

Add:

```ts
test("VIVO nunca recebe a etapa de biometria", () => {
  const result = availableCommercialDestinations({
    funis,
    etapas,
    visibleFunilIds: ["assinatura"],
    currentFunilId: "assinatura",
    currentEtapaId: "a-assinado",
    role: "admin",
    operadora: "VIVO",
  });
  expect(result.some(item => item.etapaId === "a-biometria")).toBe(false);
});
```

Run:

```bash
bun test src/lib/pipeline-movement.test.ts
```

Expected: FAIL until `operadora` filtering is implemented.

- [ ] **Step 9: Add `operadora` filtering to movement logic and call sites**

In `src/lib/pipeline-movement.ts`, import:

```ts
import { isStageAllowedForOperadora } from "./biometria-operadora";
```

Add to `AvailableCommercialDestinationsInput`:

```ts
operadora?: string | null;
```

Destructure `operadora` in `availableCommercialDestinations` and, as the first stage-level guard after active/funnel matching, add:

```ts
if (!isStageAllowedForOperadora(etapa.id, operadora)) return false;
```

In `src/components/move-venda-dialog.tsx`, add prop:

```ts
operadora: string;
```

Destructure it and pass it to `availableCommercialDestinations`:

```ts
operadora,
```

In `src/components/commercial-pipeline.tsx`, add to its `MoveVendaDialog` call:

```tsx
operadora={venda.operadora}
```

In `src/components/venda-lifecycle-actions.tsx`, add to its `MoveVendaDialog` call:

```tsx
operadora={venda.operadora}
```

- [ ] **Step 10: Verify Task 2**

```bash
bun test src/lib/biometria-operadora.test.ts src/lib/pipeline-movement.test.ts
bun run build
```

Supabase verification after migration:

```sql
select count(*) as vivo_com_biometria
from public.vendas
where operadora = 'VIVO'::public.operadora_enum
  and (coalesce(tem_biometria, false) = true or status_biometria is not null);
```

Expected: `0`.

- [ ] **Step 11: Commit Task 2**

```bash
git add src/lib/biometria-operadora.ts src/lib/biometria-operadora.test.ts src/components/pedido-header-meta.tsx src/components/commercial-pipeline.tsx src/components/venda-lifecycle-actions.tsx src/routes/_shell.vendas.$id.tsx src/lib/pedido-nota-live.ts src/lib/pdf-nota-live.ts src/lib/pipeline-movement.ts src/lib/pipeline-movement.test.ts supabase/migrations/20260917194000_vivo_without_biometrics.sql
git commit -m "feat: make biometrics Claro-only"
```

---

### Task 3: Isolar renomeação de Tipo de Produto por operadora

**Files:**
- Modify: `src/components/catalogo-linha-select.tsx`
- Create: `supabase/migrations/20260917195000_rename_product_type_by_operator.sql`
- Create: `scripts/check-product-type-operator-scope.py`

**Interfaces:**
- Produces RPC: `public.rename_tipo_produto_catalogo(p_item_id uuid, p_novo_nome text) returns table(id uuid, operadora text, nome text, linhas_atualizadas bigint)`.
- Existing delete behavior remains deletion of the catalog row only; no line rewrite.

- [ ] **Step 1: Write the failing source/database contract checker**

Create `scripts/check-product-type-operator-scope.py`:

```python
from pathlib import Path

component = Path("src/components/catalogo-linha-select.tsx").read_text(encoding="utf-8")
migrations = "\n".join(p.read_text(encoding="utf-8") for p in Path("supabase/migrations").glob("*.sql"))

assert 'rename_tipo_produto_catalogo' in component
assert 'rename_tipo_produto_catalogo' in migrations
assert 'v.operadora::text = v_operadora' in migrations
assert 'vl.tipo_produto = v_nome_antigo' in migrations
assert 'linhas_atualizadas' in migrations
print("OK: renomeação de Tipo de Produto isolada por operadora")
```

- [ ] **Step 2: Run checker to confirm failure**

```bash
python scripts/check-product-type-operator-scope.py
```

Expected: FAIL because RPC and component integration do not exist.

- [ ] **Step 3: Preflight normalized duplicate names**

Run before applying the migration:

```sql
select operadora, lower(btrim(nome)) as nome_normalizado, count(*)
from public.tipos_pedido_catalogo
group by operadora, lower(btrim(nome))
having count(*) > 1;
```

Expected: zero rows. If rows exist, stop Task 3 and resolve those exact duplicates explicitly before creating the unique index; do not auto-delete catalog rows.

- [ ] **Step 4: Create the canonical rename RPC**

Create `supabase/migrations/20260917195000_rename_product_type_by_operator.sql`:

```sql
create unique index if not exists uq_tipos_pedido_catalogo_operadora_nome
on public.tipos_pedido_catalogo (operadora, lower(btrim(nome)));

create or replace function public.rename_tipo_produto_catalogo(
  p_item_id uuid,
  p_novo_nome text
)
returns table(id uuid, operadora text, nome text, linhas_atualizadas bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_operadora text;
  v_nome_antigo text;
  v_nome_novo text := btrim(coalesce(p_novo_nome, ''));
  v_count bigint := 0;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'bko'::public.app_role)
  ) then
    raise exception '403: apenas Administrador ou BKO pode renomear Tipo de Produto.';
  end if;

  if length(v_nome_novo) = 0 then
    raise exception 'O novo nome não pode ficar vazio.';
  end if;

  select t.operadora, t.nome
    into v_operadora, v_nome_antigo
  from public.tipos_pedido_catalogo t
  where t.id = p_item_id
  for update;

  if not found then
    raise exception 'Tipo de Produto não encontrado.';
  end if;

  if exists (
    select 1
    from public.tipos_pedido_catalogo t
    where t.operadora = v_operadora
      and t.id <> p_item_id
      and lower(btrim(t.nome)) = lower(v_nome_novo)
  ) then
    raise exception 'Já existe um Tipo de Produto com esse nome para esta operadora.';
  end if;

  update public.tipos_pedido_catalogo
  set nome = v_nome_novo
  where tipos_pedido_catalogo.id = p_item_id;

  update public.venda_linhas vl
  set tipo_produto = v_nome_novo
  from public.vendas v
  where v.id = vl.venda_id
    and v.operadora::text = v_operadora
    and vl.tipo_produto = v_nome_antigo;

  get diagnostics v_count = row_count;

  return query
  select p_item_id, v_operadora, v_nome_novo, v_count;
end;
$$;

revoke all on function public.rename_tipo_produto_catalogo(uuid, text) from public;
grant execute on function public.rename_tipo_produto_catalogo(uuid, text) to authenticated;
```

The live schema inspection already confirms `tipos_pedido_catalogo.operadora` is `text`, so keep `v_operadora text` exactly as shown.

- [ ] **Step 5: Route only Tipo de Produto rename through the RPC**

In `CatalogoLinhaSelect.saveEdit`, replace the current direct update with:

```ts
if (table === "tipos_pedido_catalogo") {
  const itemAtual = items.find(item => item.id === id);
  const confirmado = window.confirm(
    `Renomear “${itemAtual?.nome ?? "este tipo"}” para “${nome}” em ${operadora}? As linhas antigas desta mesma operadora que usam o nome anterior também serão atualizadas.`,
  );
  if (!confirmado) return;
}

setBusy(true);
const source = supabase as any;
const result = table === "tipos_pedido_catalogo"
  ? await source.rpc("rename_tipo_produto_catalogo", {
      p_item_id: id,
      p_novo_nome: nome,
    })
  : await source.from(table).update({ nome }).eq("id", id);
setBusy(false);

if (result.error) {
  toast.error(`Não foi possível editar ${label.toLowerCase()}`, {
    description: result.error.message,
  });
  return;
}

setEditingId(null);
setEditingName("");
await refresh();

if (table === "tipos_pedido_catalogo") {
  toast.success(`${label} atualizado`, {
    description: `O novo nome foi aplicado apenas às linhas ${operadora} que usavam o nome anterior.`,
  });
} else {
  toast.success(`${label} atualizado`, {
    description: "Vendas antigas mantêm o texto original.",
  });
}
```

Do not change the database action inside `deleteItem`: it must remain a delete of the catalog row by `id`, so historical `venda_linhas.tipo_produto` text is preserved.

- [ ] **Step 6: Run contract checker**

```bash
python scripts/check-product-type-operator-scope.py
```

Expected: PASS.

- [ ] **Step 7: Verify the RPC definition and operator filter after migration**

```sql
select pg_get_functiondef('public.rename_tipo_produto_catalogo(uuid,text)'::regprocedure) as definition;
```

Expected definition contains:

```text
v.operadora::text = v_operadora
vl.tipo_produto = v_nome_antigo
public.has_role(v_user_id, 'admin'
public.has_role(v_user_id, 'bko'
```

Also rerun:

```sql
select operadora, lower(btrim(nome)) as nome_normalizado, count(*)
from public.tipos_pedido_catalogo
group by operadora, lower(btrim(nome))
having count(*) > 1;
```

Expected: zero rows.

- [ ] **Step 8: Build and commit Task 3**

```bash
python scripts/check-product-type-operator-scope.py
bun run build
git add src/components/catalogo-linha-select.tsx scripts/check-product-type-operator-scope.py supabase/migrations/20260917195000_rename_product_type_by_operator.sql
git commit -m "feat: scope product type renames by operator"
```

---

### Task 4: Liberar Consultor para Assinatura preservando limite do BKO

**Files:**
- Modify: `src/lib/pipeline-movement.ts`
- Modify: `src/lib/pipeline-movement.test.ts`
- Modify: `src/components/move-venda-dialog.tsx`
- Modify: `src/components/commercial-pipeline.tsx`
- Modify: `src/components/venda-lifecycle-actions.tsx`
- Create: `supabase/migrations/20260917200000_consultant_signature_permissions.sql`

**Interfaces:**
- `availableCommercialDestinations` keeps the public name and uses `operadora` from Task 2.
- Database `pipeline_move_venda(uuid, text)` signature stays unchanged.

- [ ] **Step 1: Expand failing consultant movement tests**

Add active signature stages to the fixture:

```ts
{ id: "a-aguardando", funil_id: "assinatura", nome: "Aguardando Assinatura", cor: "warning", ordem: 29, ativo: true },
{ id: "a-d1", funil_id: "assinatura", nome: "Dia 1 - Assinatura", cor: "info", ordem: 32, ativo: true },
```

Keep the `a-biometria` active fixture from Task 2.

Replace the old BKO-only expectation and add:

```ts
test("consultor no BKO vê as outras etapas permitidas e somente a primeira entrada de Assinatura", () => {
  const result = availableCommercialDestinations({
    funis,
    etapas,
    visibleFunilIds: ["processos_bko", "assinatura"],
    currentFunilId: "processos_bko",
    currentEtapaId: "bko-pendente",
    role: "consultor",
    operadora: "CLARO",
  });

  expect(result.map(item => item.etapaId)).toEqual([
    "bko-apoio",
    "bko-troca",
    "a-aguardando",
  ]);
});

test("consultor dentro de Assinatura circula apenas dentro de Assinatura", () => {
  const result = availableCommercialDestinations({
    funis,
    etapas,
    visibleFunilIds: ["processos_bko", "assinatura"],
    currentFunilId: "assinatura",
    currentEtapaId: "a-aguardando",
    role: "consultor",
    operadora: "CLARO",
  });

  expect(result.every(item => item.funilId === "assinatura")).toBe(true);
  expect(result.some(item => item.etapaId === "a-d1")).toBe(true);
  expect(result.some(item => item.etapaId === "bko-pendente")).toBe(false);
});

test("consultor VIVO entra em Assinatura sem receber biometria", () => {
  const result = availableCommercialDestinations({
    funis,
    etapas,
    visibleFunilIds: ["processos_bko", "assinatura"],
    currentFunilId: "processos_bko",
    currentEtapaId: "bko-apoio",
    role: "consultor",
    operadora: "VIVO",
  });

  expect(result.some(item => item.etapaId === "a-biometria")).toBe(false);
  expect(result.some(item => item.etapaId === "a-aguardando")).toBe(true);
});
```

- [ ] **Step 2: Run movement tests and confirm failure**

```bash
bun test src/lib/pipeline-movement.test.ts
```

Expected: consultant BKO-to-signature tests FAIL under current logic.

- [ ] **Step 3: Implement the frontend destination matrix**

Inside `availableCommercialDestinations`, after role/current-funnel variables, add:

```ts
const assinaturaStages = etapas
  .filter(etapa =>
    etapa.ativo &&
    etapa.funil_id === "assinatura" &&
    isStageAllowedForOperadora(etapa.id, operadora)
  )
  .sort((a, b) => a.ordem - b.ordem);
const primeiraAssinatura = assinaturaStages[0]?.id ?? null;
```

Use this complete consultant branch inside the stage filter:

```ts
if (!consultor) return true;

if (consultorDentroProcessosBko) {
  const destinoBkoPermitido =
    funil.id === "processos_bko" && CONSULTOR_PROCESSOS_BKO_STAGE_SET.has(etapa.id);
  const entradaAssinatura =
    funil.id === "assinatura" && etapa.id === primeiraAssinatura;
  return destinoBkoPermitido || entradaAssinatura;
}

if (currentFunilId === "assinatura") {
  return funil.id === "assinatura";
}

if (funil.id === "processos_bko") {
  return CONSULTOR_PROCESSOS_BKO_STAGE_SET.has(etapa.id);
}

return true;
```

Keep this existing pre-filter guard unchanged because it is still required:

```ts
if (consultorDentroProcessosBko && !CONSULTOR_PROCESSOS_BKO_STAGE_SET.has(currentEtapaId)) {
  return [];
}
```

- [ ] **Step 4: Ensure `operadora` reaches both movement dialogs**

This should already be completed in Task 2. Verify both calls contain:

```tsx
operadora={venda.operadora}
```

in:

```text
src/components/commercial-pipeline.tsx
src/components/venda-lifecycle-actions.tsx
```

- [ ] **Step 5: Replace `pipeline_move_venda` with the exact approved matrix**

Create `supabase/migrations/20260917200000_consultant_signature_permissions.sql` with this complete function definition:

```sql
create or replace function public.pipeline_move_venda(
  p_venda_id uuid,
  p_etapa_id text
)
returns table(funil_id text, etapa_id text, funil_nome text, etapa_nome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_target_funil_id text;
  v_target_funil_nome text;
  v_target_etapa_id text;
  v_target_etapa_nome text;
  v_old_funil_nome text;
  v_old_etapa_nome text;
  v_user_nome text;
  v_roles text;
  v_broad boolean;
  v_consultor boolean;
  v_first_assinatura text;
  v_allowed_consultor_bko text[] := array['bko-pendente','bko-apoio','bko-troca'];
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  v_broad := public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'gestor'::public.app_role)
    or public.has_role(v_user_id, 'bko'::public.app_role);
  v_consultor := public.has_role(v_user_id, 'consultor'::public.app_role);

  if not v_broad and not v_consultor then
    raise exception '403: perfil sem permissão para movimentar pedidos comerciais.';
  end if;

  select * into v_venda
  from public.vendas
  where id = p_venda_id
  for update;

  if not found or v_venda.deleted_at is not null or coalesce(v_venda.is_deleted, false) then
    raise exception 'Pedido não encontrado.';
  end if;

  if coalesce(v_venda.status_pedido, '') in ('cancelado', 'reprovado') then
    raise exception 'Pedido cancelado ou reprovado não pode ser movimentado.';
  end if;

  if v_venda.concluido_em is not null then
    raise exception 'Pedido concluído não pode ser movimentado nem reaberto.';
  end if;

  if v_consultor and not v_broad and v_venda.consultor_id is distinct from v_user_id then
    raise exception '403: consultor sem acesso a este pedido.';
  end if;

  select f.id, f.nome, e.id, e.nome
    into v_target_funil_id, v_target_funil_nome, v_target_etapa_id, v_target_etapa_nome
  from public.pipeline_funis f
  join public.pipeline_etapas e on e.funil_id = f.id
  where e.id = p_etapa_id
    and f.ativo
    and f.participa_fluxo_comercial
    and e.ativo
  for share of f, e;

  if not found then
    raise exception 'Destino comercial inválido ou desativado.';
  end if;

  if v_venda.funil::text = v_target_funil_id and v_venda.etapa_id = v_target_etapa_id then
    raise exception 'O pedido já está neste destino.';
  end if;

  if v_venda.operadora = 'VIVO'::public.operadora_enum
     and v_target_etapa_id = 'a-biometria' then
    raise exception 'Pedidos VIVO não utilizam biometria.';
  end if;

  select e.id into v_first_assinatura
  from public.pipeline_funis f
  join public.pipeline_etapas e on e.funil_id = f.id
  where f.id = 'assinatura'
    and f.ativo
    and f.participa_fluxo_comercial
    and e.ativo
    and not (
      v_venda.operadora = 'VIVO'::public.operadora_enum
      and e.id = 'a-biometria'
    )
  order by e.ordem
  limit 1;

  if v_consultor and not v_broad then
    if v_venda.funil::text = 'processos_bko' then
      if not (v_venda.etapa_id = any(v_allowed_consultor_bko)) then
        raise exception '403: consultor não pode movimentar pedido após a faixa permitida de Processos BKO.';
      end if;

      if v_target_funil_id = 'processos_bko' then
        if not (v_target_etapa_id = any(v_allowed_consultor_bko)) then
          raise exception '403: consultor só pode circular nas três etapas permitidas de Processos BKO.';
        end if;
      elsif v_target_funil_id = 'assinatura' then
        if v_first_assinatura is null or v_target_etapa_id <> v_first_assinatura then
          raise exception '403: consultor só pode entrar em Assinatura pela primeira etapa ativa.';
        end if;
      else
        raise exception '403: a partir de Processos BKO o consultor só pode permanecer na faixa permitida ou entrar em Assinatura.';
      end if;

    elsif v_venda.funil::text = 'assinatura' then
      if v_target_funil_id <> 'assinatura' then
        raise exception '403: dentro de Assinatura o consultor só pode movimentar dentro do próprio funil.';
      end if;

    elsif v_target_funil_id = 'processos_bko'
          and not (v_target_etapa_id = any(v_allowed_consultor_bko)) then
      raise exception '403: consultor só pode entrar em Processos BKO pelas três etapas permitidas.';
    end if;
  end if;

  select nome into v_old_funil_nome
  from public.pipeline_funis
  where id = v_venda.funil::text;

  select nome into v_old_etapa_nome
  from public.pipeline_etapas
  where id = v_venda.etapa_id;

  select coalesce(nome_completo, email, 'Usuário') into v_user_nome
  from public.profiles
  where id = v_user_id;

  select coalesce(string_agg(role::text, ', ' order by role::text), 'sem_perfil') into v_roles
  from public.user_roles
  where user_id = v_user_id;

  update public.vendas
  set funil = v_target_funil_id::public.funil_enum,
      etapa_id = v_target_etapa_id,
      dias_na_etapa = 0
  where id = p_venda_id;

  insert into public.venda_historico(
    venda_id,
    tipo,
    campo,
    valor_anterior,
    valor_novo,
    descricao,
    user_id,
    user_nome
  ) values (
    p_venda_id,
    'funil'::public.historico_tipo_enum,
    'movimentacao_pipeline',
    v_venda.funil::text || ' / ' || v_venda.etapa_id,
    v_target_funil_id || ' / ' || v_target_etapa_id,
    'Movimentação manual confirmada no Pipeline. Perfil: ' || v_roles || E'\nOrigem: ' ||
      coalesce(v_old_funil_nome, v_venda.funil::text) || ' → ' || coalesce(v_old_etapa_nome, v_venda.etapa_id) ||
      E'\nDestino: ' || v_target_funil_nome || ' → ' || v_target_etapa_nome,
    v_user_id,
    coalesce(v_user_nome, 'Usuário')
  );

  return query
  select v_target_funil_id, v_target_etapa_id, v_target_funil_nome, v_target_etapa_nome;
end;
$$;
```

Apply through Supabase migration tooling.

- [ ] **Step 6: Run the movement test suite**

```bash
bun test src/lib/pipeline-movement.test.ts src/lib/biometria-operadora.test.ts
```

Expected: PASS.

- [ ] **Step 7: Verify live database function definition after migration**

```sql
select pg_get_functiondef('public.pipeline_move_venda(uuid,text)'::regprocedure) as definition;
```

Confirm the definition contains:

```text
v_first_assinatura
Pedidos VIVO não utilizam biometria
primeira etapa ativa
v_target_funil_id <> 'assinatura'
```

- [ ] **Step 8: Commit Task 4**

```bash
git add src/lib/pipeline-movement.ts src/lib/pipeline-movement.test.ts src/components/move-venda-dialog.tsx src/components/commercial-pipeline.tsx src/components/venda-lifecycle-actions.tsx supabase/migrations/20260917200000_consultant_signature_permissions.sql
git commit -m "feat: allow consultants to operate signature funnel"
```

---

### Task 5: Integração final, regressão e preparação para teste do usuário

**Files:**
- Create: `.github/workflows/check-operator-rules.yml`
- Modify only when verification reveals a reproducible defect: files from Tasks 1-4 implicated by that failing check.

**Interfaces:**
- CI workflow becomes the package-level acceptance gate.

- [ ] **Step 1: Add a dedicated CI workflow**

Create `.github/workflows/check-operator-rules.yml`:

```yaml
name: Check Operator Rules

on:
  pull_request:
    branches:
      - main
  push:
    branches:
      - feat/regras-operacionais-operadora-2026-09-17
      - main

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Instalar dependências
        run: bun install --frozen-lockfile
      - name: Testar regras de linha e operadora
        run: bun test src/lib/linha-doador.test.ts src/lib/biometria-operadora.test.ts src/lib/pipeline-movement.test.ts
      - name: Validar escopo de Tipo de Produto
        run: python scripts/check-product-type-operator-scope.py
      - name: Build
        run: bun run build
```

- [ ] **Step 2: Run all project checks**

```bash
bun test src/lib/linha-doador.test.ts src/lib/biometria-operadora.test.ts src/lib/pipeline-movement.test.ts
python scripts/check-product-type-operator-scope.py
bun run build
```

Expected: every command exits `0`.

- [ ] **Step 3: Run Supabase integrity queries**

```sql
select linha_id, count(*)
from public.venda_linha_doadores
group by linha_id
having count(*) > 1;
```

Expected: zero rows.

```sql
select id, numero, status_biometria, tem_biometria
from public.vendas
where operadora = 'VIVO'::public.operadora_enum
  and (coalesce(tem_biometria, false) = true or status_biometria is not null);
```

Expected: zero rows.

```sql
select operadora, lower(btrim(nome)) as nome_normalizado, count(*)
from public.tipos_pedido_catalogo
group by operadora, lower(btrim(nome))
having count(*) > 1;
```

Expected: zero rows.

- [ ] **Step 4: Manual acceptance matrix in preview**

Run exactly these checks before requesting user test:

```text
1. Linha elegível a doador, sem doador -> formulário disponível; após salvar -> selo Doador visível; segundo cadastro não disponível.
2. Mesma linha com bônus e doador -> dois selos coexistem.
3. Pedido VIVO -> nenhum controle/ícone/campo de biometria na ficha, card, Nota ou PDF.
4. Pedido CLARO -> biometria permanece disponível para Admin/BKO.
5. Renomear Tipo de Produto VIVO -> linhas VIVO equivalentes mudam; CLARO homônimo permanece igual.
6. Excluir Tipo de Produto VIVO -> opção sai do catálogo, linhas antigas mantêm o texto.
7. Consultor em bko-pendente/bko-apoio/bko-troca -> vê as outras etapas permitidas + primeira etapa ativa de Assinatura.
8. Consultor em bko-montar ou etapa posterior -> não recebe movimento comercial novo.
9. Consultor dentro de Assinatura -> vê apenas etapas ativas de Assinatura.
10. Pedido VIVO em Assinatura -> nunca recebe a-biometria.
11. Consultor em etapa assinada -> botão Concluir continua ausente.
```

- [ ] **Step 5: Commit workflow**

```bash
git add .github/workflows/check-operator-rules.yml
git commit -m "test: verify operator-specific operational rules"
```

If a check in Step 2 or Step 3 fails, do not include an unrelated fix in this commit. Reproduce the failure, correct only the implicated task file(s), rerun the failing check until green, commit that correction with a focused message, then commit the workflow separately.

- [ ] **Step 6: Open PR against `main` and wait for checks**

PR title:

```text
Regras operacionais por operadora e perfil
```

PR body:

```markdown
## Regras implementadas
- um único doador por linha, com indicador visual junto do bônus;
- biometria exclusiva da CLARO e removida da VIVO em UI, Nota, PDF, banco e destinos;
- Tipo de Produto isolado por operadora, com renomeação propagada somente no mesmo escopo e exclusão preservando histórico;
- Consultor mantém limite nas três etapas do BKO e ganha entrada/movimentação no funil Assinatura.

## Aceite executado
1. Doador único e selo visual.
2. Bônus e Doador coexistindo.
3. VIVO sem biometria.
4. CLARO com biometria preservada.
5. Renomeação de Tipo de Produto isolada por operadora.
6. Exclusão preservando texto histórico.
7. Consultor saindo da faixa permitida do BKO apenas para a primeira etapa de Assinatura.
8. Consultor bloqueado nas etapas posteriores do BKO.
9. Consultor circulando somente dentro de Assinatura depois da entrada.
10. VIVO sem destino de biometria.
11. Consultor sem permissão de conclusão.
```

Do not merge until checks are green. If GitHub Actions again records `runner_id: 0` with no executed steps, document that infrastructure condition in the PR and require successful execution of the exact Step 2 commands through an available runtime plus the Step 3 Supabase integrity queries before merging.
