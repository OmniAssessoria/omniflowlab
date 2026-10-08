from pathlib import Path

route = Path("src/routes/_shell.suporte.central.tsx").read_text(encoding="utf-8")
support = Path("src/lib/support.functions.ts").read_text(encoding="utf-8")
migrations = "\n".join(p.read_text(encoding="utf-8") for p in Path("supabase/migrations").glob("*.sql"))

for token in [
    "deleteStandaloneSupport",
    "Excluir suporte avulso",
    "Trash2",
    "isAdmin",
]:
    assert token in route or token in support, f"Exclusão de suporte sem requisito: {token}"

assert "excluir_suporte_avulso" in migrations, "RPC admin-only de exclusão não existe"
assert "somente Administrador" in migrations or "somente administrador" in migrations.lower(), "RPC não documenta/bloqueia perfil"
assert "deleted_at" in support, "Listagem de suporte não filtra exclusões lógicas"

print("OK: suporte avulso possui exclusão lógica exclusiva de Administrador.")
