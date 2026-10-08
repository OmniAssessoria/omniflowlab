export type SlaVisualState = "sem_sla" | "verde" | "laranja" | "vermelho";
export type SlaConfigFilter = "CLARO" | "VIVO" | "AMBAS";

export interface GetSlaStateInput {
  startedAt: string | Date | null | undefined;
  slaHours: number | null | undefined;
  now?: string | Date;
}

function asDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

export function getSlaState({ startedAt, slaHours, now = new Date() }: GetSlaStateInput): SlaVisualState {
  if (!startedAt || slaHours === null || slaHours === undefined || slaHours <= 0) return "sem_sla";

  const started = asDate(startedAt).getTime();
  const current = asDate(now).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(current)) return "sem_sla";

  const totalMs = slaHours * 60 * 60 * 1000;
  const elapsedMs = Math.max(0, current - started);

  if (elapsedMs > totalMs) return "vermelho";
  if (elapsedMs >= totalMs / 2) return "laranja";
  return "verde";
}

export function matchesSlaConfigFilter(filter: SlaConfigFilter, claroAtivo: boolean, vivoAtivo: boolean) {
  if (filter === "AMBAS") return claroAtivo && vivoAtivo;
  return true;
}
