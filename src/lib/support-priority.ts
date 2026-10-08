export type SupportPriority = "a_tratar" | "urgente";

export const SUPPORT_PRIORITY_OPTIONS = [
  { value: "a_tratar" as const, label: "A tratar", tone: "warning" as const, pulse: false },
  { value: "urgente" as const, label: "Urgente", tone: "destructive" as const, pulse: true },
] as const;

export function getSupportPriorityMeta(priority: SupportPriority) {
  return SUPPORT_PRIORITY_OPTIONS.find(item => item.value === priority)!;
}

export function canReclassifySupportPriority(role: string | null | undefined): boolean {
  const normalized = String(role ?? "").trim().toLowerCase();
  return normalized === "bko" || normalized === "admin";
}
