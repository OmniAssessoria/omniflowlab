from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
component = (ROOT / "src/components/observacoes-pedido.tsx").read_text(encoding="utf-8")
migrations = sorted((ROOT / "supabase/migrations").glob("*_observacao_tags_catalogo.sql"))

assert migrations, "Migração de catálogo de tags de observação ainda não existe"
migration = migrations[-1].read_text(encoding="utf-8").lower()

# Banco: catálogo, snapshots e quatro tags padrão.
for required in [
    "create table if not exists public.observacao_tags_catalogo",
    "tag_id",
    "tag_nome_snapshot",
    "tag_cor_snapshot",
    "tag_icone_snapshot",
    "tag_slug_snapshot",
    "cancelamento",
    "suporte",
    "observacao",
    "endereco",
    "admin_bko_write_insert",
    "admin_bko_write_update",
    "admin_bko_write_delete",
]:
    assert required in migration, f"Migração sem requisito: {required}"

# UI: catálogo dinâmico, ícones/cores e gestão restrita a Admin/BKO.
for required in [
    'observacao_tags_catalogo',
    'tag_nome_snapshot',
    'tag_cor_snapshot',
    'tag_icone_snapshot',
    'tag_slug_snapshot',
    'Gerenciar tags',
    'TAG_COLORS',
    'TAG_ICONS',
    'tags.filter(tagItem => tagItem.ativo)',
    'House',
    'Headphones',
    'canManageTags',
    'roles.includes("admin")',
    'roles.includes("bko")',
]:
    assert required in component, f"Componente sem requisito: {required}"

# Novas observações precisam gravar snapshot. Observações antigas continuam renderizando snapshots.
assert "tag_id:" in component, "Insert/update não grava tag_id"
assert "tag_nome_snapshot:" in component, "Insert/update não grava nome snapshot"
assert "tag_cor_snapshot:" in component, "Insert/update não grava cor snapshot"
assert "tag_icone_snapshot:" in component, "Insert/update não grava ícone snapshot"
assert "tag_slug_snapshot:" in component, "Insert/update não grava slug snapshot"
assert "tagNomeSnapshot" in component, "Renderização não usa snapshot histórico"

# Endereço deve ter tratamento visual/textual especial, sem bloquear tags personalizadas.
assert 'selectedTag?.slug === "endereco"' in component, "Tag Endereço sem comportamento especial"
assert "placeholderObservacao" in component, "Placeholder contextual não implementado"

print("Contrato de tags das observações OK")
