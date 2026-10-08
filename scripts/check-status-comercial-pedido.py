from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
route = (ROOT / "src/routes/_shell.vendas.$id.tsx").read_text(encoding="utf-8")
component_path = ROOT / "src/components/status-comercial-pedido.tsx"
migrations = sorted((ROOT / "supabase/migrations").glob("*_status_comercial_pedido.sql"))

EXPECTED = {
    "AGUARDANDO CORREÇÃO CADASTRAL",
    "AGUARDANDO INTERAÇÃO",
    "ARQUIVADO",
    "AUDITORIA",
    "AVA - AGUARDANDO ACEITE",
    "AVA - CANCELADO",
    "AVA - EM VALIDAÇÃO",
    "AVA - INSTALADO",
    "AVA - PENDÊNCIA",
    "AVA - TÉCNICA",
    "AVA - TRAMITANDO CLARO",
    "COM - INICIO NEGOCIAÇÃO (25%)",
    "COM - PROPOSTA ENVIADA (50%)",
    "COM - SDR TRATANDO",
    "COM - SDR VALIDADO",
    "COM - SEM CONTATO",
    "COM - VALIDAÇÃO",
    "CONFECÇÃO ANDAMENTO",
    "CONVERGENCIA",
    "ENVIADO PARCEIRO ACCE",
    "FB - AGUARDANDO ACEITE",
    "FB - CADASTRO NETSALES",
    "FB - CANCELADO",
    "FB - CONECTADO",
    "FB - ENDEREÇO BLOQUEADO",
    "FB - FILA INPUT",
    "FB - LIBERACAO DE GED",
    "FB - PENDÊNCIA COMERCIAL",
    "FB - PENDÊNCIA SISTÊMICA",
    "FB - PENDÊNCIA TÉCNICA",
    "FB - PENDENTE BAIXA",
    "FB - PENDENTE INSTALAÇÃO",
    "FB - QUALIFICAÇÃO",
    "FB - QUEBRA",
    "FB - REAGENDAMENTO",
    "FB - RECADASTRO",
    "FB - REPROVADO ATUAR",
    "FB - REQUALIFICAÇÃO",
    "FB - RETORNO DE INSTALAÇÃO",
    "FB - SOBRE PENDENTE",
    "FB - LIMPEZA DE AGENDA",
    "INTERAÇÃO COM CLIENTE",
    "MV - ABRIR TROCA DE CARTEIRA",
    "MV - AGUARDANDO ACEITE",
    "MV - AGUARDANDO BAIXA NF",
    "MV - AGUARDANDO DE ACORDO",
    "MV - AGUARDANDO ENTREGA",
    "MV - AGUARDANDO ENVIO GC",
    "MV - AGUARDANDO NOTA FISCAL",
    "MV - AGUARDANDO PORTABILIDADE",
    "MV - ANÁLISE DE CRÉDITO (CPC)",
    "MV - ANÁLISE DE CRÉDITO SOLAR",
    "MV - ATIVADO 100%",
    "MV - AUDITORIA",
    "MV - CANCELADO",
    "MV - CONCLUÍDO INSPEÇÃO (CPO)",
    "MV - CONFECÇÃO ACEITE",
    "MV - CONFLITOS PORTABILIDADE",
    "MV - DESCONTO POR VOLUME EM ANALISE",
    "MV - DEVOLVIDO BKO",
    "MV - DEVOLVIDO CONFECÇÃO",
    "MV - ENVIAR AO PARCEIRO",
    "MV - FALTA EQUIPAMENTO",
    "MV - FILA INPUT",
    "MV - INPUT EM ANDAMENTO",
    "MV - INSUCESSO DE ENTREGA",
    "MV - PENDÊNCIA COMERCIAL",
    "MV - PENDENTE AUDITORIA",
    "MV - PENDENTE CONSULTOR",
    "MV - PENDENTE MKT",
    "MV - PORTABILIDADE NEGADA",
    "MV - PRD - SUPORTE",
    "MV - PRD CORREÇÃO",
    "MV - PRD ERRO SOLAR",
    "MV - QUALIFICAÇÃO",
    "MV - RENOVAÇÃO ANTECIPADA EM ANALISE",
    "MV - REPROVADO - ATUAR",
    "MV - REPROVADO - PERDIDO",
    "MV - REQUALIFICAÇÃO",
    "MV - SOLICITAR DESCONTO POR VOLUME",
    "MV - SOLICITAR RENOVAÇÃO ANTECIPADA",
    "MV - TROCA DE CARTEIRA EM ANÁLISE",
    "MV - TROCA NEGADA",
    "MV - VALIDAÇÃO PENDENTE (CPC)",
    "MV - VALIDAR ATIVAÇÃO",
    "MV - AGUARDANDO BIOMETRIA",
    "PENDÊNCIA PARCEIROS",
    "RETORNO FUTURO",
    "VENDA PERDIDA",
}

assert len(EXPECTED) == 89, f"Contrato deveria conter 89 status, contém {len(EXPECTED)}"
assert component_path.exists(), "Componente StatusComercialPedido ainda não existe"
assert migrations, "Migração de status comercial ainda não existe"

component = component_path.read_text(encoding="utf-8")
migration = migrations[-1].read_text(encoding="utf-8")

# Resumo: cards redundantes e o antigo Status do Pedido foram removidos.
# Status Comercial e Datas do Sistema permanecem como fontes operacionais canônicas.
assert '<Block title="Dados Comerciais">' not in route, "Card Dados Comerciais ainda está no resumo"
assert '<Block title="Operação">' not in route, "Card Operação ainda está no resumo"
assert "<StatusComercialPedido" in route, "Status Comercial não foi inserido na página"
assert "canEdit={isAdmin || isBKO}" in route, "Permissão visual não está limitada a Admin/BKO"
assert "<StatusPedidoBlock" not in route, "Status do Pedido antigo deve ser removido do resumo"
assert "<StatusPedidoBadge" not in route, "Badge antigo de Status do Pedido deve ser removido do cabeçalho"
assert 'title="Datas do Sistema"' in route or 'title="Datas"' in route, "Datas do Sistema devem permanecer no resumo"

# Datas: Envio e Próx. ação continuam fora desse quadro. Próx. ação também foi removida
# da faixa superior pela compactação aprovada, sem apagar o campo de dados do sistema.
datas_section = route.split("const ORDEM_DATAS", 1)[1].split("function DatePickerField", 1)[0]
assert 'label: "Envio"' not in datas_section, "Envio ainda aparece no quadro Datas"
assert 'k="Próx. ação"' not in datas_section, "Próx. ação ainda aparece no quadro Datas"
assert 'MiniKpi label="Próx. ação"' not in route, "KPI superior de Próx. ação deveria ter sido removido pela compactação"

# Componente: seletor pesquisável, status atual evidente e histórico auditável.
for required in [
    "Status Comercial",
    "STATUS ATIVO",
    "Histórico de Status",
    "CommandInput",
    "Pesquisar status",
    "venda_status_comercial_historico",
    "status_comercial_catalogo",
    "canEdit",
    "roles.includes(\"admin\")",
    "roles.includes(\"bko\")",
]:
    assert required in component, f"Componente sem requisito: {required}"

# Banco: catálogo, histórico imutável e RLS.
low = migration.lower()
for required in [
    "create table if not exists public.status_comercial_catalogo",
    "create table if not exists public.venda_status_comercial_historico",
    "status_nome_snapshot",
    "admin_bko_insert",
    "has_role((select auth.uid()), 'admin'::app_role)",
    "has_role((select auth.uid()), 'bko'::app_role)",
]:
    assert required in low, f"Migração sem requisito: {required}"

# Extrai somente os nomes da carga inicial entre VALUES e ON CONFLICT.
seed_match = re.search(
    r"insert\s+into\s+public\.status_comercial_catalogo\s*\([^)]*\)\s*values\s*(.*?)\s*on\s+conflict",
    migration,
    flags=re.IGNORECASE | re.DOTALL,
)
assert seed_match, "Carga inicial dos status não encontrada"
seed_names = set(re.findall(r"\(\s*'((?:''|[^'])*)'\s*,\s*\d+\s*\)", seed_match.group(1)))
seed_names = {name.replace("''", "'") for name in seed_names}
assert seed_names == EXPECTED, (
    f"Status divergentes. Faltando={sorted(EXPECTED-seed_names)}; extras={sorted(seed_names-EXPECTED)}"
)
assert len(seed_names) == 89, "Catálogo inicial deve ter exatamente 89 status únicos"

# Histórico não pode ser reescrito pela aplicação.
assert "grant select, insert on table public.venda_status_comercial_historico to authenticated" in low
assert "for update" not in low.split("create table if not exists public.venda_status_comercial_historico", 1)[1], "Histórico não deve ter policy UPDATE"
assert "for delete" not in low.split("create table if not exists public.venda_status_comercial_historico", 1)[1], "Histórico não deve ter policy DELETE"

print("Contrato do Status Comercial OK")
