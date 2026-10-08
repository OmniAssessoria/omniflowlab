from pathlib import Path

nova = Path("src/components/nova-venda-dialog.tsx").read_text(encoding="utf-8")
vendas = Path("src/routes/_shell.vendas.$id.tsx").read_text(encoding="utf-8")
catalogos = Path("src/lib/catalogos.ts").read_text(encoding="utf-8")
types = Path("src/integrations/supabase/types.ts").read_text(encoding="utf-8")

for legado in ("<Label>Tipo de pedido</Label>", "<Label>Produto</Label>", "<Label>Status inicial</Label>"):
    assert legado not in nova, f"Nova Venda ainda contém campo legado: {legado}"

assert "Nova Venda · Etapa {step}/3" not in nova, "Nova Venda ainda usa wizard de 3 etapas"
assert "tipo_pedido: tipoPedido" not in nova, "Nova Venda ainda grava tipo de pedido no cabeçalho"
assert "produto," not in nova, "Nova Venda ainda grava produto no cabeçalho"

linhas_inicio = vendas.index("function LinhasTab(")
linhas_fim = vendas.index("function KpiLinha", linhas_inicio)
linhas = vendas[linhas_inicio:linhas_fim]

cabecalhos = [
    ">DDD</th>",
    ">Número</th>",
    ">Produto</th>",
    ">Tipo de Produto</th>",
    ">Plano</th>",
    ">Valor (R$)</th>",
    ">Ações</th>",
]
posicoes = [linhas.index(item) for item in cabecalhos]
assert posicoes == sorted(posicoes), "Ordem das colunas não corresponde a DDD → Número → Produto → Tipo de Produto → Plano → Valor → Ações"

for legado in (">Tamanho do Plano</th>", ">Status</th>", ">Obs.</th>"):
    assert legado not in linhas, f"Tabela de linhas ainda contém coluna removida: {legado}"

assert "tipo_produto" in linhas, "Linhas ainda não armazenam Tipo de Produto"
assert 'useCatalogo("planos_catalogo"' in linhas, "Plano ainda não usa catálogo próprio"
assert "planos_catalogo" in catalogos, "Hook de catálogo ainda não reconhece planos_catalogo"
assert "tipo_produto" in types, "Tipos do Supabase ainda não contêm venda_linhas.tipo_produto"
assert "planos_catalogo" in types, "Tipos do Supabase ainda não contêm planos_catalogo"

component = Path("src/components/catalogo-linha-select.tsx")
assert component.exists(), "Componente de seleção/gestão de catálogo por linha não existe"
component_text = component.read_text(encoding="utf-8")
assert "canManage" in component_text, "Componente não diferencia permissão de gestão"
assert ".delete()" in component_text, "Componente não permite excluir item do catálogo"
assert ".update(" in component_text, "Componente não permite editar item do catálogo"
assert ".insert(" in component_text, "Componente não permite adicionar item do catálogo"

migrations = list(Path("supabase/migrations").glob("*_catalogos_linhas_venda.sql"))
assert migrations, "Migration de catálogos/Tipo de Produto não existe"
migration_text = migrations[-1].read_text(encoding="utf-8")
for trecho in (
    "add column if not exists tipo_produto",
    "create table if not exists public.planos_catalogo",
    "admin_bko_write",
    "'bko'::app_role",
):
    assert trecho in migration_text, f"Migration não contém requisito: {trecho}"

print("OK: comportamento de catálogos por linha validado")
