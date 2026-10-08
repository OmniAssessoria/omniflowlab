from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DETAIL = ROOT / "src/routes/_shell.vendas.$id.tsx"
CENTRAL = ROOT / "src/routes/_shell.suporte.central.tsx"
SUPPORT_DETAIL = ROOT / "src/routes/_shell.suporte.$id.tsx"
SUPPORT_PIPELINE = ROOT / "src/components/support-pipeline.tsx"
SUPPORT_HOME = ROOT / "src/routes/_shell.suporte.index.tsx"
PRIORITY_UI = ROOT / "src/components/support-priority-ui.tsx"
SUPPORT_FLOW = ROOT / "src/lib/support-flow.ts"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> None:
    require(PRIORITY_UI.exists(), "Componente visual de prioridade do Suporte ainda não existe")
    priority_ui = PRIORITY_UI.read_text(encoding="utf-8")
    detail = DETAIL.read_text(encoding="utf-8")
    central = CENTRAL.read_text(encoding="utf-8")
    support_detail = SUPPORT_DETAIL.read_text(encoding="utf-8")
    support_pipeline = SUPPORT_PIPELINE.read_text(encoding="utf-8")
    support_home = SUPPORT_HOME.read_text(encoding="utf-8")
    support_flow = SUPPORT_FLOW.read_text(encoding="utf-8")

    require("SupportPriorityBadge" in priority_ui and "SupportPriorityPicker" in priority_ui and "SupportPrioritySelect" in priority_ui,
            "UI deve ter badge, seletor inicial e seletor compacto de prioridade")
    require("A tratar" in priority_ui and "Urgente" in priority_ui,
            "UI deve nomear as duas prioridades aprovadas")
    require("animate-pulse" in priority_ui and "motion-reduce:animate-none" in priority_ui,
            "Urgente deve pulsar sem desrespeitar preferência de movimento reduzido")

    require("suportePrioridade" in detail and "SupportPriorityPicker" in detail,
            "Envio para Suporte deve exigir escolha visual de prioridade")
    require("createSupportRequest(venda.id, suporteMotivo.trim(), suportePrioridade)" in detail,
            "Solicitação deve enviar prioridade explícita ao backend")
    require("Selecione a prioridade" in detail,
            "Envio sem prioridade deve ser bloqueado com mensagem clara")

    require("SupportPriorityBadge" in central,
            "Central deve mostrar prioridade antes da criação do card")
    require("SupportPrioritySelect" in central and "reclassifySupportPriority" in central,
            "Central deve permitir reclassificação autorizada")
    require("canReclassifySupportPriority(primaryRole)" in central,
            "Central deve usar regra canônica BKO/Admin para reclassificar")

    require("SupportPriorityBadge" in support_pipeline,
            "Card do funil de Suporte deve carregar a prioridade")
    require("SupportPriorityBadge" in support_home,
            "Atendimentos recentes também devem mostrar a prioridade")
    require("canMoveSupportCard(primaryRole)" in support_pipeline,
            "Movimentação do funil de Suporte deve usar regra canônica BKO/Admin")
    require("draggable={canMove}" in support_pipeline and "onDrop" in support_pipeline,
            "Drag próprio do Suporte deve ser preservado")

    require("SupportPriorityBadge" in support_detail and "SupportPrioritySelect" in support_detail,
            "Detalhe do atendimento deve mostrar e permitir reclassificar prioridade")
    require("canReclassifySupportPriority(primaryRole)" in support_detail and "reclassifySupportPriority" in support_detail,
            "Detalhe deve limitar reclassificação a BKO/Admin")

    require("normalized === 'bko' || normalized === 'admin'" in support_flow,
            "Helper de movimentação deve autorizar BKO e Admin")

    print("Contrato visual da prioridade do Suporte: OK")


if __name__ == "__main__":
    main()
