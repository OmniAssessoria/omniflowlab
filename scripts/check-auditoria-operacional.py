from pathlib import Path

panel = Path("src/components/auditoria-panel.tsx").read_text(encoding="utf-8")

assert "useServerFn" not in panel, "Auditoria ainda depende de função server-side"
assert "listAuditLogs" not in panel, "Auditoria ainda depende da SUPABASE_SECRET_KEY"
assert 'from "@/integrations/supabase/client"' in panel, "Auditoria deve usar sessão autenticada do Supabase"

for source in [
    "audit_logs",
    "venda_historico",
    "venda_status_comercial_historico",
    "suporte_eventos",
    "import_logs",
    "ticket_sla_historico",
]:
    assert source in panel, f"Fonte operacional ausente da Auditoria: {source}"

for token in ["Buscar na auditoria", "Origem", "Detalhes", "Atualizar"]:
    assert token in panel, f"Auditoria visual sem requisito: {token}"

print("OK: Auditoria agrega fontes operacionais e não depende de secret key.")
