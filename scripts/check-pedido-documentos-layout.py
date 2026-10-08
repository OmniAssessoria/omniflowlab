from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
route = (ROOT / "src/routes/_shell.vendas.$id.tsx").read_text(encoding="utf-8")
workflow = (ROOT / ".github/workflows/check-pipeline-structure.yml").read_text(encoding="utf-8")
document_api = (ROOT / "src/lib/pedido-documentos.api.ts").read_text(encoding="utf-8")
document_component = (ROOT / "src/components/documentos-pedido.tsx").read_text(encoding="utf-8")

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
assert "deleted_at" in migration and "deleted_by" in migration

# Estrutura principal da ficha
assert "<DocumentosPedido" in route
assert "<PedidoHeaderMeta" in route
assert 'label="Dias na etapa"' not in route
assert 'label="Próx. ação"' not in route
assert 'title="Datas"' in route or 'title="Datas do Sistema"' in route

# O Status do Pedido deve ficar na faixa das abas, com nomes completos e sem truncamento.
assert 'data-pedido-status-inline="true"' in route, "Status do Pedido ainda não está na faixa horizontal das abas"
assert 'xl:col-span-2' in route, "Status Comercial precisa voltar a ocupar duas colunas no Resumo"
assert '<span className="truncate">{opt.label}</span>' not in route, "Os rótulos do Status do Pedido ainda estão truncados"

# Visualização deve baixar o objeto autenticado e abrir um Blob local, sem depender de URL assinada temporária.
assert "createSignedUrl" not in document_api, "Preview ainda depende de createSignedUrl"
assert ".download(storagePath)" in document_api, "API ainda não baixa o arquivo autenticado como Blob"
assert "URL.createObjectURL" in document_component, "UI ainda não abre o documento via Blob URL local"

assert "feat/documentos-pedido-layout-" in workflow
assert "fix/status-pedido-documento-preview" in workflow
print("pedido-documentos-layout contract: OK")
