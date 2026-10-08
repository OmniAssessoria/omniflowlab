import type {
  ConsultorAcompanhamento,
  MetaSemanalGrupo,
  MetaSemanalRow,
} from "./acompanhamento.types";

function cents(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100);
}

export function suggestWeeklySplit(total: number, weekCount: number): number[] {
  if (!Number.isInteger(weekCount) || weekCount < 1 || weekCount > 5) {
    throw new Error("Quantidade de semanas inválida.");
  }

  const totalCents = Math.max(0, cents(total));
  const base = Math.floor(totalCents / weekCount);
  const remainder = totalCents - base * weekCount;

  return Array.from({ length: weekCount }, (_, index) => {
    const value = base + (index < remainder ? 1 : 0);
    return value / 100;
  });
}

export function resolveWeeklySplit(
  suggested: number[],
  stored: Array<Pick<MetaSemanalRow, "semana" | "grupo" | "valor" | "origem">>,
  group: MetaSemanalGrupo,
): number[] {
  return suggested.map((value, index) => {
    const week = index + 1;
    const row = stored.find(item => item.grupo === group && item.semana === week);
    return row?.origem === "manual" ? Number(row.valor) : value;
  });
}

export function resolveWeeklyOrigin(
  stored: Array<Pick<MetaSemanalRow, "semana" | "grupo" | "origem">>,
  group: MetaSemanalGrupo,
  week: number,
  editedNow: boolean,
): "automatico" | "manual" {
  if (editedNow) return "manual";
  const row = stored.find(item => item.grupo === group && item.semana === week);
  return row?.origem === "manual" ? "manual" : "automatico";
}

export function getConsultorTargetRows(
  active: ConsultorAcompanhamento[],
  historical: ConsultorAcompanhamento[],
  targetConsultorIds: string[],
): ConsultorAcompanhamento[] {
  const byId = new Map([...active, ...historical].map(item => [item.id, item]));
  return targetConsultorIds.map(id => byId.get(id) ?? {
    id,
    nome_completo: "Consultor histórico",
    ativo: false,
    historico: true,
  });
}

export function getAvailableConsultants(
  active: ConsultorAcompanhamento[],
  assignedConsultorIds: string[],
): ConsultorAcompanhamento[] {
  const assigned = new Set(assignedConsultorIds);
  return active.filter(item => item.ativo && !assigned.has(item.id));
}
