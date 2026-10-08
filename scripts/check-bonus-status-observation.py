from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
bonus = "\n".join([
    (ROOT / "src/components/linha-operational-extras.tsx").read_text(encoding="utf-8"),
    (ROOT / "src/components/bonus-vivo-select.tsx").read_text(encoding="utf-8"),
])
status = (ROOT / "src/components/status-comercial-pedido.tsx").read_text(encoding="utf-8")
migrations = "\n".join(
    p.read_text(encoding="utf-8")
    for p in sorted((ROOT / "supabase/migrations").glob("*.sql"))
)

# Bônus VIVO: catálogo gerenciável, sem lista 10/20 hardcoded na UI nem no guard novo.
assert "bonus_vivo_catalogo" in migrations, "Catálogo de bônus VIVO ainda não foi criado"
assert "Gerenciar bônus" in bonus, "BKO/Admin ainda não têm gerenciamento de opções de bônus"
assert "bonus_vivo_catalogo" in bonus, "Tela de bônus ainda não consome o catálogo"
assert '<SelectItem value="10">10 GB</SelectItem>' not in bonus, "10 GB segue hardcoded na UI"
assert '<SelectItem value="20">20 GB</SelectItem>' not in bonus, "20 GB segue hardcoded na UI"

# Observação: não deve ser preenchida antes da troca; é salva depois no ciclo ativo.
assert "Observação da atualização" not in status, "Observação ainda aparece antes da escolha do status"
assert "atualizar_observacao_status_comercial" in migrations, "RPC de observação pós-status não foi criada"
assert "atualizar_observacao_status_comercial" in status, "Componente ainda não salva observação após o status"
assert "Adicionar observação" in status, "Campo pós-status de observação não foi renderizado"
assert 'event.key === "Enter"' in status, "Observação pós-status não é enviada com Enter"

print("Contrato de bônus gerenciável e observação pós-status OK")
