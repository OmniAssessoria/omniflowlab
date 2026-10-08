from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
route = ROOT / "src/routes/_shell.acompanhamento.tsx"
assert route.exists(), "Rota /acompanhamento ainda não existe"

text = route.read_text(encoding="utf-8")
required = [
    "Acompanhamento da Gestão",
    "Meta mensal",
    "Vendas em Processo Claro",
    "Vendas em Processo Vivo",
    "Total Geral",
    "Residual do Mês",
    "Meta da semana",
    "Contratos Gerados Semana / Data de Recebimento",
    "Contratos Assinados Semana / Data de Aceite",
    "Enviados / Data de Recebimento",
    "Assinados / Data de Aceite",
    "Aguardando Aceite",
    "Troca de Carteira / Caso",
    "Confecção / Correções",
    "Tratativas / Pendências",
]
for value in required:
    assert value in text, f"Seção ausente: {value}"

for value in ["Tudo", "Claro", "Vivo"]:
    assert value in text, f"Filtro de Total Geral ausente: {value}"

for forbidden in [
    "R$ 15.000,00",
    "R$ 4.000,00",
    "R$ 11.000,00",
    "R$ 9.122,00",
    "R$ 2.585,00",
    "AG TEMPO INPUT",
]:
    assert forbidden not in text, f"Valor/regra da planilha não pode entrar na fase 1: {forbidden}"

assert "Aguardando configuração" in text or "Aguardando integração" in text
assert "vendas" not in text.lower() or "Vendas em Processo" in text, "Rota não deve calcular vendas diretamente"

for component in [
    "ProcessoOperadoraCard",
    "TotalGeralCard",
    "ResidualCard",
    "WeeklyResultCard",
    "ConsultorWeeklyTable",
    "StatusOperationalCard",
]:
    assert component in text, f"Componente ausente da composição: {component}"

print("Contrato da página Acompanhamento da Gestão OK")
