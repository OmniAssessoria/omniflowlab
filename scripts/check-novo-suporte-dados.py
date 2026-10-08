from pathlib import Path

dialog = Path("src/components/novo-suporte-dialog.tsx").read_text(encoding="utf-8")
functions = Path("src/lib/support.functions.ts").read_text(encoding="utf-8")
detail = Path("src/routes/_shell.suporte.$id.tsx").read_text(encoding="utf-8")
migrations = "\n".join(
    path.read_text(encoding="utf-8")
    for path in Path("supabase/migrations").glob("*.sql")
)

required_labels = [
    "<Label>Razão Social *</Label>",
    "<Label>CNPJ *</Label>",
    "<Label>Nome completo *</Label>",
    "<Label>E-mail *</Label>",
    "<Label>Telefone *</Label>",
    "<Label>Motivo / descrição *</Label>",
    "<Label>Prioridade *</Label>",
    "<Label>Destino inicial *</Label>",
]
for label in required_labels:
    assert label in dialog, f"Campo obrigatório ausente no modal: {label}"

for current, following in zip(required_labels, required_labels[1:]):
    assert dialog.index(current) < dialog.index(following), f"Ordem incorreta: {current} deve vir antes de {following}"

for token in ["clienteRazaoSocial", "clienteTelefone", "isCompleteSupportPhone", "formatSupportPhone"]:
    assert token in dialog, f"Modal não usa {token}"

for token in ["clienteRazaoSocial", "clienteTelefone", "p_cliente_razao_social", "p_cliente_telefone", "criar_suporte_avulso_v2"]:
    assert token in functions, f"Camada de dados não envia {token}"

for token in ['label="Razão Social"', 'label="Contato"', 'label="Telefone"', 'label="E-mail"']:
    assert token in detail, f"Ficha do suporte não exibe {token}"

for token in ["cliente_razao_social", "cliente_telefone", "Razão social é obrigatória", "Telefone é obrigatório"]:
    assert token in migrations, f"Banco não contém contrato obrigatório: {token}"

print("OK: novo suporte possui empresa, contato, atendimento e direcionamento obrigatórios.")
