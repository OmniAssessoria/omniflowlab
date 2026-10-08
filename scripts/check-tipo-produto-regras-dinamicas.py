from pathlib import Path

catalog = Path("src/components/catalogo-linha-select.tsx").read_text(encoding="utf-8")
extras = Path("src/components/linha-operational-extras.tsx").read_text(encoding="utf-8")
catalogos = Path("src/lib/catalogos.ts").read_text(encoding="utf-8")
route = Path("src/routes/_shell.vendas.$id.tsx").read_text(encoding="utf-8")
migrations = "\n".join(
    p.read_text(encoding="utf-8")
    for p in Path("supabase/migrations").glob("*.sql")
)

for token in ["permite_bonus", "permite_doador"]:
    assert token in catalogos, f"CatalogoItem não expõe {token}"
    assert token in catalog, f"Gerenciador de Tipo de Produto não edita {token}"
    assert token in route, f"Linha da venda não recebe {token}"
    assert token in migrations, f"Banco não contém {token}"

assert "Permite bônus" in catalog, "Gerenciador não exibe opção de bônus"
assert "Permite doador" in catalog, "Gerenciador não exibe opção de doador"
assert 'operadora === "VIVO"' in catalog, "Bônus não está visualmente restrito à VIVO"
assert "TIPOS_COM_DOADOR" not in extras, "Doador ainda depende de lista fixa por nome"
assert "aceitaBonusVivo" not in extras, "Bônus ainda depende de lista fixa por nome"

print("OK: bônus e doador são configurados pelo catálogo de Tipo de Produto.")
