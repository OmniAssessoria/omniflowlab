from pathlib import Path

config = Path("src/components/status-comercial-sla-config.tsx").read_text(encoding="utf-8")
status_component = Path("src/components/status-comercial-pedido.tsx").read_text(encoding="utf-8")
migrations = "\n".join(p.read_text(encoding="utf-8") for p in Path("supabase/migrations").glob("*.sql"))

for token in [
    "Editar SLA",
    "Excluir SLA",
    "Pencil",
    "Trash2",
    "roles.includes(\"admin\")",
    "roles.includes(\"bko\")",
]:
    assert token in config, f"Configuração de SLA sem requisito: {token}"

assert "isCommercialCompletionStatus" in status_component, "Status final ainda está hardcoded no componente"
assert "LOGÍSTICA CONCLUÍDA" in migrations, "Carga VIVO não inclui LOGÍSTICA CONCLUÍDA"
assert "MV - ATIVADO 100%" in migrations, "Carga CLARO perdeu ATIVADO 100%"
assert "bko_manage_status_comercial_operadoras" in migrations, "BKO ainda não pode gerenciar SLA"

print("OK: SLA possui edição/exclusão e finalização por operadora.")
