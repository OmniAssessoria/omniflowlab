from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIGRATION_DIR = ROOT / "supabase/migrations"
PIPELINE_ROUTE = ROOT / "src/routes/_shell.pipeline.tsx"
COMMERCIAL_PIPELINE = ROOT / "src/components/commercial-pipeline.tsx"
PIPELINE_MOVEMENT = ROOT / "src/lib/pipeline-movement.ts"
STORE = ROOT / "src/lib/omni-store.tsx"
SUPPORT_PIPELINE = ROOT / "src/components/support-pipeline.tsx"
MOVE_DIALOG = ROOT / "src/components/move-venda-dialog.tsx"
DETAIL = ROOT / "src/routes/_shell.vendas.$id.tsx"
CLIENTES_PEDIDOS = ROOT / "src/components/clientes-pedidos.tsx"
LIFECYCLE_ACTIONS = ROOT / "src/components/venda-lifecycle-actions.tsx"
SUPPORT_FUNCTIONS = ROOT / "src/lib/support.functions.ts"
SUPPORT_PRIORITY_DOMAIN = ROOT / "src/lib/support-priority.ts"
OPERATIONAL_PERMISSIONS = MIGRATION_DIR / "20260917004100_operational_permissions_pipeline.sql"
CONSULTOR_MOVEMENT_UPDATE = MIGRATION_DIR / "20260930152731_consultor_movement_nove_etapas.sql"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def read(path: Path) -> str:
    require(path.exists(), f"Arquivo ausente: {path.relative_to(ROOT)}")
    return path.read_text(encoding="utf-8")


def main() -> None:
    old_movement = "\n".join(
        path.read_text(encoding="utf-8")
        for path in sorted(MIGRATION_DIR.glob("2026091519000*_pipeline_movement_completion*.sql"))
    )
    operational = read(OPERATIONAL_PERMISSIONS) + "\n" + read(CONSULTOR_MOVEMENT_UPDATE)
    pipeline_route = read(PIPELINE_ROUTE)
    commercial_pipeline = read(COMMERCIAL_PIPELINE)
    pipeline_movement = read(PIPELINE_MOVEMENT)
    store = read(STORE)
    support_pipeline = read(SUPPORT_PIPELINE)
    move_dialog = read(MOVE_DIALOG)
    detail = read(DETAIL)
    clientes_pedidos = read(CLIENTES_PEDIDOS)
    lifecycle_actions = read(LIFECYCLE_ACTIONS)
    support_functions = read(SUPPORT_FUNCTIONS)
    priority_domain = read(SUPPORT_PRIORITY_DOMAIN)

    # Ciclo de vida: conclusão continua canônica, mas reabertura comercial foi removida pelo pacote 2026-09-16.
    require("concluido_em" in old_movement and "concluido_por" in old_movement,
            "Conclusão deve permanecer estado explícito da venda")
    require("create or replace function public.pipeline_move_venda" in operational.lower(),
            "RPC pipeline_move_venda atualizada deve estar versionada")
    require("drop function if exists public.pipeline_reabrir_venda(uuid)" in operational.lower(),
            "Migration operacional deve remover a RPC de reabertura comercial")
    require("pedido concluído não pode ser movimentado nem reaberto" in operational.lower(),
            "Backend deve impedir movimento de pedido concluído")
    require("trg_guard_vendas_operational_update" in operational,
            "Permissões pós-conclusão devem possuir proteção no banco")
    require("datas do sistema só podem ser alteradas por bko ou administrador" in operational.lower(),
            "Datas do Sistema precisam de validação backend BKO/Admin")

    # Pipeline comercial continua sem drag local e usa ações canônicas.
    require("CommercialPipelinePage" in pipeline_route,
            "Rota do Pipeline deve delegar ao componente comercial")
    for token in ["draggable", "onDragStart", "onDragEnd", "cursor-grab", "GripVertical"]:
        require(token not in commercial_pipeline, f"Pipeline comercial ainda contém legado removido: {token}")
    require("MoveVendaDialog" in commercial_pipeline and "MoveVendaDialog" in move_dialog,
            "Cards comerciais devem usar Mover para")
    require("Concluir pedido" in commercial_pipeline,
            "Conclusão autorizada deve continuar disponível")

    # Store: mover/concluir sim; reabrir nunca mais.
    require('rpc("pipeline_move_venda"' in store or "rpc('pipeline_move_venda'" in store,
            "Store deve usar pipeline_move_venda")
    require('rpc("pipeline_concluir_venda"' in store or "rpc('pipeline_concluir_venda'" in store,
            "Store deve expor conclusão via RPC")
    require("pipeline_reabrir_venda" not in store,
            "Store não pode manter reabertura comercial")
    require("concluidoEm) return false" in store,
            "Pedido concluído não pode permanecer em vendasPipeline")

    # Ficha: sem botão de reabertura; concluído segue consultável.
    require("VendaLifecycleActions" in detail and "VendaLifecycleActions" in lifecycle_actions,
            "Ficha deve usar ações canônicas de ciclo de vida")
    require("Reabrir pedido" not in lifecycle_actions and "pipeline_reabrir_venda" not in lifecycle_actions,
            "Ficha não pode oferecer reabertura comercial")
    require("Concluir pedido" in lifecycle_actions,
            "Ficha deve permitir conclusão quando autorizada")
    require("const concluida = Boolean(venda?.concluidoEm)" in detail,
            "Ficha deve usar concluidoEm como fonte de verdade")
    require('<Campo label="Etapa">' not in detail,
            "Edição genérica não pode oferecer seletor direto de etapa")
    require("delete patch.funil" in detail and "delete patch.etapa_id" in detail,
            "Edição genérica deve remover funil/etapa antes de persistir")

    require("concluido_em" in clientes_pedidos,
            "Clientes/Pedidos deve consultar conclusão explícita")
    require("Concluído em" in clientes_pedidos and "Concluído" in clientes_pedidos,
            "Clientes/Pedidos deve identificar pedidos concluídos")

    # Consultor: exatamente nove destinos autorizados, divididos entre Processos BKO e Assinatura.
    destinos_consultor = [
        "bko-pendente", "bko-montar", "bko-apoio",
        "a-d1", "a-d2", "a-d3", "a-d4", "a-apoio", "a-assinado",
    ]
    for etapa in destinos_consultor:
        require(etapa in operational, f"Backend sem etapa permitida do Consultor: {etapa}")
        require(etapa in pipeline_movement, f"Domínio de movimentação sem etapa permitida do Consultor: {etapa}")
    for etapa_bloqueada in ["bko-troca", "bko-suporte", "bko-input", "bko-enviado", "a-aguardando"]:
        require(etapa_bloqueada not in pipeline_movement.split("CONSULTOR_ASSINATURA_STAGE_IDS", 1)[0].split("CONSULTOR_PROCESSOS_BKO_STAGE_IDS", 1)[1],
                f"Domínio do Consultor contém destino indevido: {etapa_bloqueada}")
    require("CONSULTOR_PROCESSOS_BKO_STAGE_IDS" in pipeline_movement,
            "Domínio deve centralizar os destinos permitidos do Consultor em Processos BKO")
    require("CONSULTOR_ASSINATURA_STAGE_IDS" in pipeline_movement,
            "Domínio deve centralizar os destinos permitidos do Consultor em Assinatura")
    require("availableCommercialDestinations" in move_dialog,
            "UI deve consumir a regra canônica de destinos comerciais")
    require("processos_bko" in operational and "assinatura" in operational and "consultor" in operational.lower(),
            "Migration deve proteger os nove destinos do Consultor por papel")

    # Prioridade de Suporte continua domínio próprio.
    require('"a_tratar"' in priority_domain and '"urgente"' in priority_domain,
            "Prioridade deve manter A tratar/Urgente")
    require("canReclassifySupportPriority" in priority_domain,
            "Domínio deve centralizar permissão de reclassificação")
    require("SupportPriority" in support_functions and "p_prioridade" in support_functions,
            "Frontend deve enviar prioridade explícita")
    require("reclassificar_prioridade_suporte" in support_functions,
            "Frontend deve usar RPC para reclassificar prioridade")

    # Suporte mantém drag separado e autorizado por regra própria.
    require("canMoveSupportCard(primaryRole)" in support_pipeline,
            "Movimentação do Suporte deve usar regra canônica")
    require("draggable={canMove}" in support_pipeline and "onDrop" in support_pipeline,
            "Suporte deve preservar seu drag operacional")

    print("Contrato de movimentação/conclusão/prioridade: OK")


if __name__ == "__main__":
    main()
