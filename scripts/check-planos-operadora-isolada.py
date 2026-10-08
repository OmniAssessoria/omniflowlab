from pathlib import Path

catalogos = Path("src/lib/catalogos.ts").read_text(encoding="utf-8")
manager = Path("src/components/catalogo-linha-select.tsx").read_text(encoding="utf-8")
migrations = "\n".join(p.read_text(encoding="utf-8") for p in Path("supabase/migrations").glob("*.sql"))

assert 'if (operadora) q = q.eq("operadora", operadora)' in catalogos, "Leitura de catálogo não está isolada por operadora"
assert '.eq("operadora", operadora)' in manager, "Edição/exclusão não está escopada pela operadora"
assert 'table === "planos_catalogo"' in manager, "Gerenciador não trata Plano explicitamente como catálogo por operadora"
assert "Catálogo de planos exclusivo da" in manager, "Interface não deixa claro o escopo da operadora"
assert "guard_planos_catalogo_operadora" in migrations, "Banco ainda não bloqueia troca de operadora do plano"
assert "planos_catalogo_operadora_valida" in migrations, "Banco ainda não restringe Plano a CLARO/VIVO"

print("OK: Planos são isolados por operadora no frontend e no banco.")
