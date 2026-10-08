from pathlib import Path

shell = Path("src/components/app-shell.tsx").read_text(encoding="utf-8")

for token in [
    'Select value={String(mesRef)}',
    'Select value={String(anoRef)}',
    'MESES_LONG.map',
]:
    assert token not in shell, f"Filtro global de período ainda está no AppShell: {token}"

print("OK: cabeçalho global não renderiza filtro de mês/ano.")
