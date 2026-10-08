from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
migration = ROOT / "supabase/migrations/20260926143000_acompanhamento_atomic_config_writes.sql"
services = ROOT / "src/lib/acompanhamento.functions.ts"

assert migration.exists(), "Migration de gravações atômicas ainda não existe"
sql = migration.read_text(encoding="utf-8").lower()
src = services.read_text(encoding="utf-8")

for fn in [
    "acompanhamento_salvar_tipo_vinculo",
    "acompanhamento_salvar_quadro_regras",
]:
    assert f"function public.{fn}" in sql, f"RPC ausente: {fn}"
    assert "security invoker" in sql, "RPCs de configuração devem respeitar RLS"
    assert f"revoke all on function public.{fn}" in sql, f"Revoke explícito ausente: {fn}"

assert '.rpc("acompanhamento_salvar_tipo_vinculo"' in src
assert '.rpc("acompanhamento_salvar_quadro_regras"' in src

# Não pode manter o padrão destrutivo delete-then-insert no serverFn.
tipo_block = src.split("export const saveTipoVinculo", 1)[1].split("export const deleteTipoVinculo", 1)[0]
regras_block = src.split("export const saveQuadroRules", 1)[1]
assert '.from("acompanhamento_tipo_vinculos").delete()' not in tipo_block
assert '.from("acompanhamento_quadro_regras")\n      .delete()' not in regras_block

print("Contrato de gravações atômicas do Acompanhamento OK")
