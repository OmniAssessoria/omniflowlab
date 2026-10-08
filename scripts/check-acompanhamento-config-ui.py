from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
base = ROOT / "src/components/acompanhamento"

files = {
    "dialog": base / "acompanhamento-config-dialog.tsx",
    "types": base / "tipo-classificacao-panel.tsx",
    "rules": base / "quadro-rule-editor.tsx",
    "summary": base / "config-summary.tsx",
}

for name, path in files.items():
    assert path.exists(), f"Componente de configuração ausente: {name}"

types = files["types"].read_text(encoding="utf-8")
rules = files["rules"].read_text(encoding="utf-8")
dialog = files["dialog"].read_text(encoding="utf-8")
summary = files["summary"].read_text(encoding="utf-8")

assert "Não classificados" in types
assert "operadora" in types.lower()
assert "contexto" in types.lower()
assert "grupo" in types.lower()
assert "Classificar" in types
assert "Outros" not in types or "default" not in types.lower(), "Não pode haver fallback automático para Outros"

assert "QuadroConfigButton" in rules
assert "Status manual" in rules
assert "Status do robô" in rules
assert "Etapa do pipeline" in rules
assert "normaliz" in rules.lower()
assert "saveQuadroRules" in rules
assert "valorOriginal" in rules
assert "useEffect" in rules and "if (!open) return;" in rules, "Editor deve carregar regras existentes ao abrir"
assert "selectionKey" in types, "Seleção temporária deve ser isolada por contexto + tipo"
assert "fuzzy" not in rules.lower()

assert "AcompanhamentoConfigDialog" in dialog
assert "TipoClassificacaoPanel" in dialog
assert "ConfigSummary" in dialog
assert "Não classificados" in summary or "classifica" in summary.lower()

print("Contrato da central de configuração do Acompanhamento OK")
