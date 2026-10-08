import type { OperationalWeek } from "./acompanhamento.types";

function isoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function normalizeAcompanhamentoStatus(value: string): string {
  let normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

  normalized = normalized.replace(/^ROBO\s*(?:-|:)\s*/, "");
  return normalized.trim().replace(/\s+/g, " ");
}

export function getMonthOperationalWeeks(year: number, month: number): OperationalWeek[] {
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    throw new Error("Ano inválido para o acompanhamento.");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Mês inválido para o acompanhamento.");
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const weeks: OperationalWeek[] = [];
  let index = 1;

  for (let start = 1; start <= lastDay; start += 7) {
    const end = Math.min(lastDay, start + 6);
    weeks.push({
      index,
      start: isoDate(year, month, start),
      end: isoDate(year, month, end),
    });
    index += 1;
  }

  return weeks;
}
