from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILE = ROOT / "src/lib/acompanhamento.functions.ts"

assert FILE.exists(), "Camada de dados do acompanhamento ainda não existe"
text = FILE.read_text(encoding="utf-8").lower()

for forbidden in [
    '.from("vendas")',
    ".from('vendas')",
    '.from("venda_linhas")',
    ".from('venda_linhas')",
    "sum(valor",
    "quantidade_linhas",
]:
    assert forbidden not in text, f"Fase 1 não pode calcular vendas: {forbidden}"

assert "getacompanhamentobootstrap" in text
assert "tipos_pedido_catalogo" in text
assert "status_comercial_operadoras" in text
assert "venda_robo_logs" in text
assert "pipeline_etapas" in text
assert "user_roles" in text
assert "colaboradores" in text, "Gestor deve descobrir consultores pelo cadastro operacional legível, não pelos roles de terceiros"
assert '.eq("role", "consultor")' not in text, "Gestor não enxerga roles de outros usuários pela RLS de user_roles"
assert "admin" in text and "gestor" in text

print("Contrato phase-1 sem cálculo de vendas OK")
