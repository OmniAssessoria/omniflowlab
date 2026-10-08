from pathlib import Path

config = Path("src/components/status-comercial-sla-config.tsx").read_text(encoding="utf-8")
pedido = Path("src/components/status-comercial-pedido.tsx").read_text(encoding="utf-8")
audit = Path("src/lib/audit-feed.ts").read_text(encoding="utf-8")
audit_panel = Path("src/components/auditoria-panel.tsx").read_text(encoding="utf-8")
migrations = "\n".join(p.read_text(encoding="utf-8") for p in Path("supabase/migrations").glob("*.sql"))

for token in [
    "Novo Status Comercial",
    "criar_status_comercial",
    "atualizar_status_comercial",
    "excluir_status_comercial",
    "Nome do Status Comercial",
    "Sem SLA",
    "Finalizador",
    "Status finalizador não pode ser desativado",
    "Status finalizador não pode ser excluído",
]:
    assert token in config, f"Gerenciador sem requisito: {token}"

assert 'select("status_id, operadora, nome, sla_horas, ativo, is_final' in config, "Configuração ainda usa nome global"
assert "row.nome" in pedido, "Pedido ainda não usa nome específico da operadora"
assert "is_final" in pedido, "Pedido ainda depende do nome para reconhecer status final"

for token in ["status_comercial_criado", "status_comercial_excluido", "status_comercial_alterado"]:
    assert token in audit, f"Auditoria sem rótulo: {token}"

assert 'startsWith("status_comercial_")' in audit_panel, "Eventos de Status Comercial não estão classificados na origem correta"

for token in [
    "criar_status_comercial",
    "atualizar_status_comercial",
    "excluir_status_comercial",
    "is_final",
]:
    assert token in migrations, f"Banco sem requisito: {token}"

print("OK: Status Comercial é criável/editável/excluível por operadora, com SLA e auditoria.")

assert "revoke execute on function public.criar_status_comercial" in migrations and "from anon" in migrations, "RPC de criação ainda exposta a anon"
assert "revoke execute on function public.atualizar_status_comercial" in migrations, "RPC de atualização sem revoke explícito"
assert "revoke execute on function public.excluir_status_comercial" in migrations, "RPC de exclusão sem revoke explícito"
