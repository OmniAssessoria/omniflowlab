# Documentos do Pedido + Layout Compacto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar documentos privados auditáveis aos pedidos e compactar a ficha do pedido sem remover as Datas do Sistema nem alterar regras operacionais existentes.

**Architecture:** Os binários ficam em um bucket privado `pedido-documentos`; metadados e auditoria ficam em `venda_documentos`/`venda_historico`. A autorização é centralizada em `venda_usuario_tem_acesso(uuid)`, refletindo a visibilidade já existente de `vendas`, e RPCs transacionais registram/excluem metadados. No frontend, validação/serviço de documentos e componentes visuais ficam isolados da rota grande `_shell.vendas.$id.tsx`.

**Tech Stack:** React 19, TanStack Router, TypeScript, Tailwind CSS, shadcn/Radix, Supabase Postgres + Storage, Bun tests, Python static contracts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-15-documentos-pedido-layout-compacto-design.md`

## Global Constraints

- Upload máximo: **100 MB por arquivo** (`104857600` bytes).
- Aceitar imagens comuns, PDF, Word `.doc` e `.docx`.
- Bucket `pedido-documentos` é **privado**; não criar URL pública permanente.
- Título do documento é obrigatório e livre.
- Todo usuário que já tem acesso ao pedido pode listar, enviar, abrir/baixar e excluir seus documentos.
- Exclusão é lógica no domínio (`deleted_at`/`deleted_by`) e auditada; o binário é removido do Storage após a marcação lógica quando possível.
- A operadora mostra apenas `CLARO` ou `VIVO`, sem ícone, ligeiramente maior e com brilho premium.
- Biometria fica ao lado da operadora com legenda: pendente amarelo, cancelada vermelho, concluída verde, sem informação neutra.
- Remover visualmente `Dias na etapa` e `Próx. ação` apenas da faixa superior; não apagar seus campos do banco.
- Manter `Linhas`, `Valor da venda` e `Consultor` em uma faixa compacta.
- Manter `Status do Pedido` com as mesmas quatro opções e mesmas permissões, em apresentação horizontal compacta.
- **Datas do Sistema permanecem**, com seus campos e comportamento atuais.
- Não alterar regras de Status Comercial, observações, conclusão/reabertura comercial ou Suporte.

---

## File Structure

- `supabase/migrations/20260915203000_venda_documentos_storage.sql` — bucket, tabela, helper de acesso, RLS/Storage policies, RPCs e auditoria.
- `src/integrations/supabase/types-extended.ts` — tipos da nova tabela e RPCs sem editar o arquivo gerado `types.ts`.
- `src/lib/pedido-documentos.ts` — constantes, tipos, validação, sanitização e formatação puras.
- `src/lib/pedido-documentos.test.ts` — testes Bun do domínio de arquivo.
- `src/lib/pedido-documentos.api.ts` — listar, enviar, gerar URL assinada e excluir documento usando Supabase.
- `src/components/documentos-pedido.tsx` — lista, modal de upload, preview/download e confirmação de exclusão.
- `src/components/pedido-header-meta.tsx` — operadora luminosa sem ícone + biometria compacta editável conforme permissões existentes.
- `src/routes/_shell.vendas.$id.tsx` — composição da nova UI, KPIs compactos, Status do Pedido horizontal e preservação de Datas.
- `scripts/check-pedido-documentos-layout.py` — contrato estático de banco/UI para impedir regressões.
- `.github/workflows/check-pipeline-structure.yml` — executar novo contrato/teste e disparar CI na branch da feature.

---

### Task 1: Contrato de feature e CI da branch

**Files:**
- Create: `scripts/check-pedido-documentos-layout.py`
- Modify: `.github/workflows/check-pipeline-structure.yml`
- Test: `scripts/check-pedido-documentos-layout.py`

**Interfaces:**
- Consumes: spec aprovada e estrutura atual da rota de venda.
- Produces: contrato estático que exige migration, componentes e invariantes de layout; CI executável a cada push da branch.

- [ ] **Step 1: Criar o contrato estático inicialmente vermelho**

Criar `scripts/check-pedido-documentos-layout.py` para verificar, no mínimo:

```python
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
route = (ROOT / "src/routes/_shell.vendas.$id.tsx").read_text(encoding="utf-8")
workflow = (ROOT / ".github/workflows/check-pipeline-structure.yml").read_text(encoding="utf-8")

required_files = [
    ROOT / "supabase/migrations/20260915203000_venda_documentos_storage.sql",
    ROOT / "src/lib/pedido-documentos.ts",
    ROOT / "src/lib/pedido-documentos.api.ts",
    ROOT / "src/components/documentos-pedido.tsx",
    ROOT / "src/components/pedido-header-meta.tsx",
]
for path in required_files:
    assert path.exists(), f"Arquivo obrigatório ausente: {path.relative_to(ROOT)}"

migration = required_files[0].read_text(encoding="utf-8")
assert "pedido-documentos" in migration
assert "create table" in migration.lower() and "venda_documentos" in migration
assert "104857600" in migration
assert "venda_usuario_tem_acesso" in migration
assert "registrar_documento_pedido" in migration
assert "excluir_documento_pedido" in migration

assert "<DocumentosPedido" in route
assert "<PedidoHeaderMeta" in route
assert 'label="Dias na etapa"' not in route
assert 'label="Próx. ação"' not in route
assert 'title="Datas"' in route or 'title="Datas do Sistema"' in route
assert "feat/documentos-pedido-layout-" in workflow
print("pedido-documentos-layout contract: OK")
```

- [ ] **Step 2: Rodar o contrato e confirmar vermelho**

Run:

```bash
python scripts/check-pedido-documentos-layout.py
```

Expected: FAIL no primeiro arquivo novo ainda inexistente.

- [ ] **Step 3: Incluir branch, contrato e teste no workflow**

Adicionar no `push.branches`:

```yaml
- 'feat/documentos-pedido-layout-*'
```

Adicionar em `Check shared sale-detail contracts`:

```yaml
python scripts/check-pedido-documentos-layout.py
```

Adicionar em `Run pipeline and support tests`:

```yaml
src/lib/pedido-documentos.test.ts
```

- [ ] **Step 4: Commitar o contrato vermelho**

```bash
git add scripts/check-pedido-documentos-layout.py .github/workflows/check-pipeline-structure.yml
git commit -m "test: add order documents and layout contract"
```

---

### Task 2: Banco, autorização e Storage privado

**Files:**
- Create: `supabase/migrations/20260915203000_venda_documentos_storage.sql`
- Modify: `src/integrations/supabase/types-extended.ts`
- Test: `scripts/check-pedido-documentos-layout.py`

**Interfaces:**
- Produces table: `public.venda_documentos`.
- Produces helper: `public.venda_usuario_tem_acesso(p_venda_id uuid) returns boolean`.
- Produces RPC: `public.registrar_documento_pedido(p_documento_id uuid, p_venda_id uuid, p_titulo text, p_nome_original text, p_storage_path text, p_mime_type text, p_tamanho_bytes bigint) returns uuid`.
- Produces RPC: `public.excluir_documento_pedido(p_documento_id uuid) returns text`, retornando `storage_path` para limpeza física pelo cliente.

- [ ] **Step 1: Escrever a migration com bucket e tabela**

A migration deve inserir/atualizar o bucket:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pedido-documentos',
  'pedido-documentos',
  false,
  104857600,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
```

Criar tabela:

```sql
create table if not exists public.venda_documentos (
  id uuid primary key,
  venda_id uuid not null references public.vendas(id) on delete cascade,
  titulo text not null check (length(btrim(titulo)) between 1 and 200),
  arquivo_nome_original text not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif'
  )),
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 104857600),
  created_by uuid not null references auth.users(id),
  created_by_nome text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  deleted_by_nome text
);
create index if not exists venda_documentos_venda_ativos_idx
  on public.venda_documentos(venda_id, created_at desc)
  where deleted_at is null;
```

- [ ] **Step 2: Centralizar a mesma regra de acesso de vendas**

Criar helper `SECURITY DEFINER`:

```sql
create or replace function public.venda_usuario_tem_acesso(p_venda_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.vendas v
    where v.id = p_venda_id
      and v.deleted_at is null
      and coalesce(v.is_deleted, false) = false
      and (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        or public.has_role(auth.uid(), 'gestor'::public.app_role)
        or public.has_role(auth.uid(), 'bko'::public.app_role)
        or public.has_role(auth.uid(), 'suporte'::public.app_role)
        or (
          public.has_role(auth.uid(), 'consultor'::public.app_role)
          and v.consultor_id = auth.uid()
        )
      )
  );
$$;
```

Revogar acesso de `public/anon` e conceder execução a `authenticated`.

- [ ] **Step 3: Criar RLS da tabela e policies de Storage**

Tabela de metadados deve ser somente leitura direta pelo cliente; inserção/exclusão passam por RPC:

```sql
alter table public.venda_documentos enable row level security;
create policy "Acesso a documentos segue acesso ao pedido"
on public.venda_documentos for select to authenticated
using (public.venda_usuario_tem_acesso(venda_id));

revoke insert, update, delete on public.venda_documentos from authenticated;
grant select on public.venda_documentos to authenticated;
```

Storage:

```sql
create policy "Upload documentos de pedidos acessiveis"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'pedido-documentos'
  and public.venda_usuario_tem_acesso(split_part(name, '/', 1)::uuid)
);

create policy "Ler documentos ativos de pedidos acessiveis"
on storage.objects for select to authenticated
using (
  bucket_id = 'pedido-documentos'
  and public.venda_usuario_tem_acesso(split_part(name, '/', 1)::uuid)
  and exists (
    select 1 from public.venda_documentos d
    where d.storage_path = name and d.deleted_at is null
  )
);

create policy "Remover binario de pedido acessivel"
on storage.objects for delete to authenticated
using (
  bucket_id = 'pedido-documentos'
  and public.venda_usuario_tem_acesso(split_part(name, '/', 1)::uuid)
);
```

Antes de criar policies, usar `drop policy if exists` para tornar migration idempotente em ambientes já parcialmente preparados.

- [ ] **Step 4: Criar RPC transacional de registro e histórico**

`registrar_documento_pedido` deve:

1. validar `venda_usuario_tem_acesso(p_venda_id)`;
2. validar título, MIME e tamanho novamente no banco;
3. exigir `p_storage_path = p_venda_id || '/' || p_documento_id || '/' || ...`;
4. exigir existência do objeto em `storage.objects` no bucket privado;
5. capturar nome do ator em `profiles`;
6. inserir `venda_documentos`;
7. inserir `venda_historico` com `tipo='campo'`, `campo='documento_pedido'` e descrição de upload.

Trecho obrigatório:

```sql
if not public.venda_usuario_tem_acesso(p_venda_id) then
  raise exception '403: sem acesso a este pedido.';
end if;

if split_part(p_storage_path, '/', 1) <> p_venda_id::text
   or split_part(p_storage_path, '/', 2) <> p_documento_id::text then
  raise exception 'Caminho de documento inválido.';
end if;
```

- [ ] **Step 5: Criar RPC de exclusão lógica auditada**

`excluir_documento_pedido` deve `FOR UPDATE`, validar acesso, ser idempotente e retornar o path:

```sql
update public.venda_documentos
set deleted_at = now(),
    deleted_by = v_user_id,
    deleted_by_nome = v_user_nome
where id = p_documento_id and deleted_at is null;
```

Registrar em `venda_historico` o título, nome original, ator e data/hora. Não apagar a linha de metadados.

- [ ] **Step 6: Estender a tipagem do cliente**

Em `types-extended.ts`, adicionar `venda_documentos` a `Tables` e as duas RPCs a `Functions`, preservando a extensão já existente de `vendas` e Pipeline.

Tipo mínimo de `venda_documentos.Row`:

```ts
{
  id: string;
  venda_id: string;
  titulo: string;
  arquivo_nome_original: string;
  storage_path: string;
  mime_type: string;
  tamanho_bytes: number;
  created_by: string;
  created_by_nome: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_by_nome: string | null;
}
```

- [ ] **Step 7: Rodar contrato do banco**

```bash
python scripts/check-pedido-documentos-layout.py
```

Expected: avança além das asserções da migration e falha nos arquivos frontend ainda ausentes.

- [ ] **Step 8: Commitar banco/tipos**

```bash
git add supabase/migrations/20260915203000_venda_documentos_storage.sql src/integrations/supabase/types-extended.ts
git commit -m "feat: add private order document storage"
```

---

### Task 3: Domínio e serviço de documentos com TDD

**Files:**
- Create: `src/lib/pedido-documentos.ts`
- Create: `src/lib/pedido-documentos.test.ts`
- Create: `src/lib/pedido-documentos.api.ts`
- Modify: `.github/workflows/check-pipeline-structure.yml`

**Interfaces:**
- Produces `MAX_PEDIDO_DOCUMENT_BYTES = 104857600`.
- Produces `validatePedidoDocumento(input): string | null`.
- Produces `sanitizePedidoDocumentFileName(name): string`.
- Produces `formatDocumentBytes(bytes): string`.
- Produces API `listPedidoDocumentos`, `uploadPedidoDocumento`, `getPedidoDocumentoSignedUrl`, `deletePedidoDocumento`.

- [ ] **Step 1: Escrever testes vermelhos do domínio**

Criar `src/lib/pedido-documentos.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  MAX_PEDIDO_DOCUMENT_BYTES,
  validatePedidoDocumento,
  sanitizePedidoDocumentFileName,
} from "./pedido-documentos";

const valid = { name: "contrato.pdf", type: "application/pdf", size: 1024 };

describe("pedido documentos", () => {
  test("aceita PDF abaixo de 100 MB", () => {
    expect(validatePedidoDocumento("Contrato", valid)).toBeNull();
  });

  test("rejeita exatamente acima de 100 MB", () => {
    expect(validatePedidoDocumento("Contrato", { ...valid, size: MAX_PEDIDO_DOCUMENT_BYTES + 1 }))
      .toContain("100 MB");
  });

  test("rejeita executável", () => {
    expect(validatePedidoDocumento("Arquivo", { name: "x.exe", type: "application/x-msdownload", size: 10 }))
      .toContain("não suportado");
  });

  test("exige título", () => {
    expect(validatePedidoDocumento("   ", valid)).toContain("título");
  });

  test("sanitiza nome sem perder extensão", () => {
    expect(sanitizePedidoDocumentFileName("Meu Contrato (1).PDF")).toBe("meu-contrato-1.pdf");
  });
});
```

- [ ] **Step 2: Rodar teste e confirmar vermelho**

```bash
bun test src/lib/pedido-documentos.test.ts
```

Expected: FAIL porque `pedido-documentos.ts` ainda não existe.

- [ ] **Step 3: Implementar domínio mínimo**

Em `src/lib/pedido-documentos.ts`:

```ts
export const MAX_PEDIDO_DOCUMENT_BYTES = 100 * 1024 * 1024;
export const PEDIDO_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function validatePedidoDocumento(
  titulo: string,
  file: Pick<File, "name" | "type" | "size">,
): string | null {
  if (!titulo.trim()) return "Informe o título do documento.";
  if (file.size <= 0) return "O arquivo está vazio.";
  if (file.size > MAX_PEDIDO_DOCUMENT_BYTES) return "O arquivo deve ter no máximo 100 MB.";
  if (!PEDIDO_DOCUMENT_MIME_TYPES.has(file.type)) return "Tipo de arquivo não suportado.";
  return null;
}
```

Implementar sanitização e formatação sem dependência do browser.

- [ ] **Step 4: Rodar testes e confirmar verde**

```bash
bun test src/lib/pedido-documentos.test.ts
```

Expected: PASS.

- [ ] **Step 5: Implementar serviço Supabase**

`uploadPedidoDocumento` deve:

```ts
const documentoId = crypto.randomUUID();
const storagePath = `${vendaId}/${documentoId}/${sanitizePedidoDocumentFileName(file.name)}`;
const { error: uploadError } = await supabase.storage
  .from("pedido-documentos")
  .upload(storagePath, file, { upsert: false, contentType: file.type });
```

Depois chamar RPC `registrar_documento_pedido`. Se RPC falhar, tentar `remove([storagePath])` antes de relançar o erro.

`listPedidoDocumentos` filtra `.is("deleted_at", null)` e ordena `created_at desc`.

`getPedidoDocumentoSignedUrl` usa:

```ts
supabase.storage.from("pedido-documentos").createSignedUrl(storagePath, 120)
```

`deletePedidoDocumento` chama RPC primeiro e depois tenta remover o path retornado do bucket. Se o `remove` físico falhar, retornar um aviso não fatal porque a exclusão lógica/auditoria já ocorreu.

- [ ] **Step 6: Rodar testes da feature + regressão curta**

```bash
bun test src/lib/pedido-documentos.test.ts src/lib/observacoes-permissions.test.ts src/lib/pipeline-movement.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commitar domínio/serviço**

```bash
git add src/lib/pedido-documentos.ts src/lib/pedido-documentos.test.ts src/lib/pedido-documentos.api.ts .github/workflows/check-pipeline-structure.yml
git commit -m "feat: add order document client service"
```

---

### Task 4: Componente Documentos do Pedido

**Files:**
- Create: `src/components/documentos-pedido.tsx`
- Modify: `src/routes/_shell.vendas.$id.tsx`
- Test: `scripts/check-pedido-documentos-layout.py`

**Interfaces:**
- Consumes `uploadPedidoDocumento`, `listPedidoDocumentos`, `getPedidoDocumentoSignedUrl`, `deletePedidoDocumento`.
- Produces `<DocumentosPedido vendaId: string />`.

- [ ] **Step 1: Criar componente de listagem e estados**

O componente deve manter:

```ts
const [documentos, setDocumentos] = useState<PedidoDocumento[]>([]);
const [loading, setLoading] = useState(true);
const [uploadOpen, setUploadOpen] = useState(false);
const [titulo, setTitulo] = useState("");
const [arquivo, setArquivo] = useState<File | null>(null);
const [uploading, setUploading] = useState(false);
const [excluindo, setExcluindo] = useState<PedidoDocumento | null>(null);
```

Carregar documentos ao montar e após upload/exclusão.

- [ ] **Step 2: Implementar modal de upload**

Usar `Dialog` com título livre e `Input type="file"`:

```tsx
<Input
  type="file"
  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  onChange={(event) => setArquivo(event.target.files?.[0] ?? null)}
/>
```

Mostrar explicitamente `Máximo 100 MB · Imagens, PDF e Word`.

Antes de chamar API, usar `validatePedidoDocumento` e apresentar `toast.error` em erro.

- [ ] **Step 3: Implementar tabela/lista responsiva**

Desktop: colunas `Título`, `Nome do arquivo`, `Tipo`, `Tamanho`, `Enviado por`, `Data de envio`, `Ações`.

Ações:

- `Eye`: gerar URL assinada e `window.open(url, "_blank", "noopener,noreferrer")`;
- `Download`: gerar URL assinada e abrir a URL; não persistir URL no estado além do necessário;
- `Trash2`: abrir `AlertDialog` de confirmação.

Mobile/tablet: envolver tabela em `overflow-x-auto` com largura mínima, sem ocultar Datas ou ações.

- [ ] **Step 4: Implementar exclusão com confirmação**

Texto mínimo:

```text
Excluir este documento?
Ele deixará de aparecer no pedido. A exclusão ficará registrada no histórico.
```

Após sucesso, remover da lista e mostrar `Documento excluído.`. Se houver apenas falha na limpeza física do Storage, mostrar toast de sucesso com aviso de limpeza pendente, sem restaurar o item na UI.

- [ ] **Step 5: Integrar abaixo de Observações**

Na rota, imediatamente após:

```tsx
<ObservacoesPedido vendaId={venda?.id || ""} />
```

Adicionar:

```tsx
<div className="mt-4">
  <DocumentosPedido vendaId={venda?.id || ""} />
</div>
```

- [ ] **Step 6: Rodar contrato e build**

```bash
python scripts/check-pedido-documentos-layout.py
bun run build
```

Expected: contrato ainda pode falhar apenas em `PedidoHeaderMeta`; build PASS para a parte de documentos.

- [ ] **Step 7: Commitar UI de documentos**

```bash
git add src/components/documentos-pedido.tsx src/routes/_shell.vendas.$id.tsx
git commit -m "feat: add order documents section"
```

---

### Task 5: Cabeçalho, biometria e compactação da ficha

**Files:**
- Create: `src/components/pedido-header-meta.tsx`
- Modify: `src/routes/_shell.vendas.$id.tsx`
- Test: `scripts/check-pedido-documentos-layout.py`

**Interfaces:**
- Produces `<PedidoHeaderMeta operadora statusBiometria canEditBiometria onBiometriaChange />`.
- Preserva a função atual de atualização de `status_biometria` e as permissões `isAdmin || isBKO`.

- [ ] **Step 1: Extrair operadora + biometria para componente próprio**

Props:

```ts
type PedidoHeaderMetaProps = {
  operadora: "CLARO" | "VIVO" | string;
  statusBiometria: "" | "pendente" | "concluido" | "cancelado";
  canEditBiometria: boolean;
  onBiometriaChange: (status: "" | "pendente" | "concluido" | "cancelado") => Promise<void> | void;
};
```

Operadora sem ícone. Classes conceituais:

```tsx
<span className={cn(
  "inline-flex min-w-20 items-center justify-center rounded-xl border px-4 py-2 text-sm font-black tracking-[0.12em]",
  operadora === "VIVO"
    ? "border-violet-500/70 text-violet-200 bg-violet-500/10 shadow-[0_0_18px_rgba(139,92,246,0.55)]"
    : "border-red-500/70 text-red-200 bg-red-500/10 shadow-[0_0_18px_rgba(239,68,68,0.50)]",
)}>{operadora}</span>
```

Não adicionar antena, logo ou qualquer outro ícone à operadora.

- [ ] **Step 2: Implementar biometria compacta ao lado**

Mostrar `Fingerprint` + legenda atual. Tons:

```ts
pendente -> warning/amarelo
cancelado -> destructive/vermelho
concluido -> success/verde
"" -> muted/neutro
```

Quando `canEditBiometria`, clicar abre `Popover` com as mesmas opções existentes. Não mudar permissão nem valores gravados.

- [ ] **Step 3: Remover bloco grande antigo de Biometria**

Eliminar apenas a renderização corporal de `<BiometriaBlock ... />` e integrar `PedidoHeaderMeta` no cabeçalho ao lado do número/operadora. Manter helpers de biometria se ainda forem usados por badges; remover código morto somente se não houver referência.

- [ ] **Step 4: Reduzir faixa de KPIs de cinco para três**

Substituir:

```tsx
<div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
```

por faixa compacta, por exemplo:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
  <MiniKpi label="Linhas" ... compact />
  <MiniKpi label="Valor da venda" ... compact />
  <MiniKpi label="Consultor" ... compact />
</div>
```

Remover somente os dois usos de `MiniKpi` para `Dias na etapa` e `Próx. ação`. Não remover `diasNaEtapa`, `proximaAcao` ou `proximaAcaoData` do modelo/formulários.

Ajustar `MiniKpi` para `py-3`/tipografia menor ou adicionar prop `compact` sem afetar outros usos.

- [ ] **Step 5: Compactar Status do Pedido e preservar Datas**

A composição do Resumo deve usar três áreas em desktop:

```tsx
<div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr_0.8fr] gap-4">
  <StatusComercialPedido ... />
  <StatusPedidoBlock ... compact />
  <Block title="Datas">
    <DatasBlock ... />
  </Block>
</div>
```

`StatusPedidoBlock` passa a exibir as quatro opções em uma linha com wrap:

```tsx
<div className="grid grid-cols-2 2xl:grid-cols-4 gap-2">
```

Não remover, renomear nem simplificar campos de `DatasBlock`. Esta etapa falha se Datas deixar de renderizar.

- [ ] **Step 6: Validar responsividade**

Garantir que em largura pequena:

- cabeçalho permite `flex-wrap`;
- operadora e biometria continuam legíveis;
- KPIs viram uma coluna ou três itens empilhados;
- Status do Pedido quebra 2x2;
- Datas permanece abaixo/ao lado sem overflow destrutivo;
- Documentos usa rolagem horizontal.

- [ ] **Step 7: Rodar contrato, testes e build**

```bash
python scripts/check-pedido-documentos-layout.py
bun test src/lib/pedido-documentos.test.ts src/lib/pipeline-movement.test.ts src/lib/support-priority.test.ts
bun run build
```

Expected: tudo PASS.

- [ ] **Step 8: Commitar compactação visual**

```bash
git add src/components/pedido-header-meta.tsx src/routes/_shell.vendas.$id.tsx
git commit -m "feat: compact order detail header and status layout"
```

---

### Task 6: Revisão, integração e rollout de produção

**Files:**
- Verify: todos os arquivos anteriores
- No new product code unless a review finding requires correction.

**Interfaces:**
- Consumes branch completa.
- Produces PR mergeado, migration aplicada no Supabase externo `jgruzxaibvjejkjjgxcu` e Lovable publicado.

- [ ] **Step 1: Rodar verificação completa na branch**

```bash
python scripts/check-pipeline-structure.py
python scripts/check-pipeline-movement-completion-support-priority.py
python scripts/check-support-priority-ui.py
python scripts/check-status-comercial-pedido.py
python scripts/check-observacao-tags.py
python scripts/check-catalogos-linhas-venda.py
python scripts/check-pedido-documentos-layout.py
bun test src/lib/pipeline-structure.test.ts src/lib/pipeline-movement.test.ts src/lib/support-flow.test.ts src/lib/support-source.test.ts src/lib/support-priority.test.ts src/lib/observacoes-permissions.test.ts src/lib/deletion-source.test.ts src/lib/pedido-documentos.test.ts
bun run build
```

Expected: todos os contratos, testes e build PASS.

- [ ] **Step 2: Revisar diff contra `main`**

Confirmar explicitamente:

- nenhuma alteração remove Datas;
- nenhuma alteração muda as permissões de biometria/Status do Pedido;
- nenhuma URL pública de Storage foi criada;
- bucket é privado e limitado a 100 MB;
- todos os acessos de documentos passam pela visibilidade do pedido;
- exclusão lógica registra ator/data antes da tentativa de remover o binário;
- operadora não contém ícone.

- [ ] **Step 3: Abrir PR contra `main` e aguardar checks verdes**

Título sugerido:

```text
feat: adicionar documentos e compactar ficha do pedido
```

Não fazer merge enquanto algum check estiver pendente ou falhando.

- [ ] **Step 4: Mergear PR e confirmar `main`/Cortex**

Após merge, confirmar que eventual commit automático `chore: atualiza mapa do projeto` é filho do merge e altera apenas `graphify-out` antes de publicar.

- [ ] **Step 5: Aplicar migration no Supabase externo**

Aplicar `20260915203000_venda_documentos_storage.sql` ao projeto `jgruzxaibvjejkjjgxcu` usando migration DDL.

Validar somente leitura:

```sql
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'pedido-documentos';

select to_regclass('public.venda_documentos') is not null as table_exists;

select proname, pg_get_function_identity_arguments(oid)
from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('venda_usuario_tem_acesso','registrar_documento_pedido','excluir_documento_pedido')
order by proname;
```

Expected: bucket privado com 104857600 bytes, tabela existente e três funções presentes.

- [ ] **Step 6: Publicar Lovable existente**

Publicar o projeto existente `1e9e293f-2276-46d2-9d2a-4b08c685e7b2` no slug atual `omniflowlab`; não criar/remixar projeto.

Confirmar `status=ready`, `is_published=true`, `error=null` e commit sincronizado com o `main` (aceitando commit Graphify imediatamente filho do merge).

- [ ] **Step 7: Smoke test estrutural pós-deploy**

Sem criar/excluir dados reais automaticamente, confirmar:

- bucket permanece privado;
- policies de Storage existem;
- tabela não contém documento ativo com `tamanho_bytes > 104857600`;
- rota publicada carrega sem erro de build/deploy;
- migration consta no histórico do Supabase.

O teste funcional final de upload/exclusão em um pedido real deve ser feito por usuário autenticado na aplicação, usando um arquivo de teste não sensível.
