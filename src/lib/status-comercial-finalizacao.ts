export type StatusCommercialOperator = "CLARO" | "VIVO";

function normalizeStatusName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^(MV|FB)\s*-\s*/i, "")
    .trim()
    .toUpperCase();
}

export function commercialCompletionStatusName(
  operadora: StatusCommercialOperator,
): string {
  return operadora === "CLARO" ? "ATIVADO 100%" : "LOGÍSTICA CONCLUÍDA";
}

export function isCommercialCompletionStatus(
  operadora: StatusCommercialOperator,
  statusName: string,
): boolean {
  return normalizeStatusName(statusName) === normalizeStatusName(
    commercialCompletionStatusName(operadora),
  );
}
