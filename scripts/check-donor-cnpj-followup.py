from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
linha = (ROOT / "src/components/linha-operational-extras.tsx").read_text(encoding="utf-8")
suporte = (ROOT / "src/components/novo-suporte-dialog.tsx").read_text(encoding="utf-8")
migrations = "\n".join(
    p.read_text(encoding="utf-8")
    for p in sorted((ROOT / "supabase/migrations").glob("*.sql"))
)

# Doador: operadora é texto livre, não Select CLARO/VIVO.
assert 'type Doador' in linha and 'operadora: string;' in linha, "Operadora do doador ainda não é texto livre"
assert '<Label>Operadora</Label><Input' in linha.replace("\n", ""), "Campo Operadora do doador ainda não é Input livre"
assert 'SelectItem value="CLARO"' not in linha and 'SelectItem value="VIVO"' not in linha, "Operadora do doador continua limitada a CLARO/VIVO"
assert 'alter column operadora type text' in migrations.lower(), "Banco ainda não converte operadora do doador para text"

# Novo Suporte: CNPJ recebe máscara e validação de 14 dígitos.
assert 'formatCnpjInput' in suporte, "Novo Suporte ainda não aplica máscara de CNPJ"
assert 'isCompleteCnpj' in suporte, "Novo Suporte ainda não valida CNPJ completo"
assert 'maxLength={18}' in suporte, "Campo CNPJ não está limitado ao tamanho formatado"

print("Contrato de operadora livre e CNPJ mascarado OK")
