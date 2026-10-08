# Contrato de regressão da estrutura dinâmica, incluindo todas as rotas de criação de vendas.
from pathlib import Path
import re


def src(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


migration = src("supabase/migrations/20260915170000_pipeline_structure_dynamic.sql")
hardening = src("supabase/migrations/20260915170500_pipeline_structure_concurrency.sql")
pipeline_route = src("src/routes/_shell.pipeline.tsx")
pipeline_ui = src("src/components/commercial-pipeline.tsx")
new_sale = src("src/components/nova-venda-dialog.tsx")
pipeline = "\n".join([pipeline_route, pipeline_ui, new_sale])
detail = src("src/routes/_shell.vendas.$id.tsx")
store = src("src/lib/omni-store.tsx")
config = src("src/routes/_shell.config.tsx")
panel = src("src/components/pipeline-structure-panel.tsx")
support_pipeline = src("src/components/support-pipeline.tsx")
support_flow = src("src/lib/support-flow.ts")
app_shell = src("src/components/app-shell.tsx")
permissions = src("src/lib/permissions.ts")
types = src("src/integrations/supabase/types.ts")
audit = src("src/components/auditoria-panel.tsx")

expected_funis = {"prospeccao", "followup", "processos_bko", "assinatura", "suporte"}
expected_etapas = {
    "p-aguardando", "p-d1-lig", "p-d2-lig", "p-d2-wpp", "p-d3-lig", "p-d4-lig",
    "p-d4-wpp", "p-d5-lig", "p-d5-declinio", "p-proposta",
    "f-proposta", "f-troca", "f-d1", "f-d2", "f-d3", "f-d4-apoio", "f-d5", "f-d6",
    "f-d7-declinio", "f-contrato",
    "bko-pendente", "bko-apoio", "bko-troca", "bko-montar", "bko-suporte", "bko-input",
    "bko-enviado", "bko-assinatura",
    "a-aguardando", "a-reenvio", "a-correcao", "a-d1", "a-d2", "a-d3", "a-d4", "a-confirmar",
    "a-biometria", "a-tt", "a-apoio", "a-assinado", "a-assinado-vivo",
    "s-espera", "s-urgente", "s-prevendas", "s-devolutiva", "s-tratar", "s-retorno-cliente",
    "s-conferencia", "s-retorno-omni", "s-retorno-interno", "s-anatel", "s-pendencia-comercial", "s-concluido",
}

funil_seed = migration.split("insert into public.pipeline_funis", 1)[1].split("on conflict (id) do nothing;", 1)[0]
funis = set(re.findall(r"\('([^']+)'\s*,", funil_seed))
require(funis == expected_funis, f"Funis seed divergentes: {funis}")

etapa_seed = migration.split("insert into public.pipeline_etapas", 1)[1].split("on conflict (id) do nothing;", 1)[0]
etapas = re.findall(r"\('([^']+)'\s*,\s*'(?:prospeccao|followup|processos_bko|assinatura|suporte)'\s*,", etapa_seed)
require(len(etapas) == 53, f"Esperadas 53 etapas, encontradas {len(etapas)}")
require(len(set(etapas)) == 53, "Há IDs de etapa duplicados no seed")
require(set(etapas) == expected_etapas, "Conjunto de etapas do seed diverge da estrutura aprovada")

# Segurança e integridade no banco.
for token in [
    "pipeline_set_funil_ativo", "pipeline_set_etapa_ativo", "pipeline_rename_etapa",
    "pipeline_resolve_initial_destination", "pipeline_resolve_next_destination",
    "pipeline_validate_venda_destination", "pipeline_validate_support_ticket_destination",
    "has_role(auth.uid(), 'admin'::public.app_role)", "has_role(auth.uid(), 'bko'::public.app_role)",
    "participa_fluxo_comercial", "audit_logs",
]:
    require(token in migration, f"Migration sem requisito: {token}")
require("revoke all on public.pipeline_funis from anon, authenticated" in migration.lower(), "pipeline_funis deve proibir escrita direta")
require("revoke all on public.pipeline_etapas from anon, authenticated" in migration.lower(), "pipeline_etapas deve proibir escrita direta")
require("grant update on public.pipeline_" not in migration.lower(), "Não deve existir UPDATE direto para authenticated")
require("v.etapa_id <> 's-concluido'" in hardening, "Suporte concluído não pode contar como ocupação ativa")
require("for share of f, e" in hardening.lower(), "Guards devem serializar com mudanças estruturais")
require("suporte_solicitacoes_validate_pipeline" in hardening, "Solicitação de suporte precisa de guarda concorrente")

# UI e autorização. Aceita aspas simples/duplas para não testar prettier em vez de regra.
require(
    re.search(r"roles\.includes\(['\"]admin['\"]\)\s*\|\|\s*roles\.includes\(['\"]bko['\"]\)", panel) is not None,
    "Painel deve permitir somente Admin/BKO",
)
require('roles: ["admin", "bko"]' in app_shell and '{ to: "/config"' in app_shell, "BKO precisa chegar em Configurações")
require('"/config": ["admin", "bko"]' in permissions, "Rota /config deve aceitar Admin/BKO")
require('const isAdmin = primaryRole === "admin"' in config, "Config deve separar conteúdo administrativo")
require('{isAdmin && (<>' in config, "Abas administrativas devem ficar ocultas para BKO")
require("<PipelineStructurePanel />" in config, "Config deve usar painel estrutural")

# Pipeline comercial dinâmico, mesmo quando a rota delega para componentes.
require("CommercialPipelinePage" in pipeline_route, "Rota /pipeline deve delegar para a UI comercial")
require("usePipelineStructure" in pipeline_ui, "Pipeline deve consumir estrutura dinâmica")
require("activeFunis.map" in pipeline_ui, "Pipeline deve renderizar apenas funis ativos")
require("etapas.filter" in pipeline_ui and "stage.funil_id" in pipeline_ui, "Pipeline deve renderizar etapas dinâmicas")
require('funil: "prospeccao"' not in new_sale, "Nova venda não pode hardcodar Prospecção")
require('etapa_id: "p-aguardando"' not in new_sale, "Nova venda não pode hardcodar p-aguardando")
require('rpc("pipeline_resolve_initial_destination")' in new_sale, "Nova venda deve resolver destino inicial no banco")
require("nextActiveCommercialDestination" in pipeline_ui, "Virar Venda deve pular destinos inativos")
require('firstActiveDestinationForFunnel("assinatura"' in pipeline_ui, "Enviar para Assinatura deve respeitar o funil nominal")

# Store e detalhe não podem validar disponibilidade pela lista mockada.
require("ETAPAS" not in store and "FUNIS" not in store, "Store não deve usar FUNIS/ETAPAS estáticos para movimentação")
require('rpc("pipeline_move_venda"' in store, "Store deve persistir movimentação pela RPC canônica")
require("Promise<boolean>" in store, "moveVenda deve informar sucesso/falha ao chamador")
require("supportEnabled" in detail, "Detalhe deve respeitar ativação do Suporte")
require("pipelineEtapas.find" in detail and "pipelineFunis.find" in detail, "Cabeçalho do pedido deve refletir nomes dinâmicos")

# A rota alternativa /vendas/nova também deve obedecer a estrutura dinâmica.
require(
    re.search(r"if\s*\(id\s*===\s*['\"]nova['\"]\)[\s\S]{0,1800}?rpc\(['\"]pipeline_resolve_initial_destination['\"]\)", detail) is not None,
    "A criação pela ficha /vendas/nova deve resolver o destino inicial no banco antes do INSERT",
)
require(
    "initialDestination?.funilId || 'prospeccao'" not in detail
    and 'initialDestination?.funilId || "prospeccao"' not in detail
    and "initialDestination?.etapaId || 'p-proposta'" not in detail
    and 'initialDestination?.etapaId || "p-proposta"' not in detail,
    "A ficha /vendas/nova não pode cair em fallback estático de funil/etapa",
)
require(
    '<Campo label="Etapa">' not in detail,
    "A edição manual não pode oferecer seletor direto de etapa; use Mover para",
)
require(
    "delete patch.funil" in detail and "delete patch.etapa_id" in detail,
    "A edição genérica deve descartar funil/etapa de vendas existentes",
)

# Suporte independente, porém configurável.
require("usePipelineStructure" in support_pipeline, "SupportPipeline deve consumir estrutura dinâmica")
require('from "@/lib/mock-data"' not in support_pipeline, "SupportPipeline não deve usar etapas mockadas")
reopen_block = support_flow.split("export function reopenTarget", 1)[1].split("export function supportStatusLabel", 1)[0]
require("s-espera" not in reopen_block, "Reabertura não pode hardcodar s-espera")
require("pipeline_resolve_first_stage('suporte')" in migration, "RPCs de Suporte devem usar primeira etapa ativa")
require("O funil Suporte está desativado" in migration, "Criação de solicitação deve bloquear Suporte inativo")

# Tipagem e auditoria.
for token in ["pipeline_funis:", "pipeline_etapas:", "pipeline_resolve_initial_destination:", "pipeline_set_funil_ativo:"]:
    require(token in types, f"Tipos Supabase sem {token}")
for action in ["pipeline_funil_ativacao", "pipeline_funil_desativacao", "pipeline_etapa_ativacao", "pipeline_etapa_desativacao", "pipeline_etapa_renomeacao"]:
    require(action in audit, f"Auditoria sem estilo para {action}")

print("Contrato da estrutura dinâmica do pipeline: OK")
