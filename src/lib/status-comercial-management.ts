export type StatusCommercialOperator = "CLARO" | "VIVO";
export type StatusCommercialCreationScope = StatusCommercialOperator | "AMBAS";

export function normalizeStatusCommercialName(value: string): string | null {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return null;

  const reduced = normalized
    .replace(/^(MV|FB|AVA|COM)\s*-\s*/i, "")
    .trim();

  return reduced || null;
}

export function parseStatusCommercialSla(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) return undefined;
  return parsed;
}

export function creationTargets(scope: StatusCommercialCreationScope): StatusCommercialOperator[] {
  return scope === "AMBAS" ? ["CLARO", "VIVO"] : [scope];
}
