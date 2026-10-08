import { describe, expect, test } from "bun:test";
import { getSlaState, matchesSlaConfigFilter } from "./status-sla";

describe("getSlaState", () => {
  test("retorna neutro quando o status não tem SLA", () => {
    expect(getSlaState({ startedAt: "2026-09-16T12:00:00Z", slaHours: null, now: "2026-09-16T18:00:00Z" })).toBe("sem_sla");
  });

  test("fica verde antes de 50% do prazo", () => {
    expect(getSlaState({ startedAt: "2026-09-16T00:00:00Z", slaHours: 72, now: "2026-09-17T11:59:59Z" })).toBe("verde");
  });

  test("fica laranja exatamente em 50% e até 100% do prazo", () => {
    expect(getSlaState({ startedAt: "2026-09-16T00:00:00Z", slaHours: 72, now: "2026-09-17T12:00:00Z" })).toBe("laranja");
    expect(getSlaState({ startedAt: "2026-09-16T00:00:00Z", slaHours: 72, now: "2026-09-19T00:00:00Z" })).toBe("laranja");
  });

  test("fica vermelho somente depois de 100% do prazo", () => {
    expect(getSlaState({ startedAt: "2026-09-16T00:00:00Z", slaHours: 72, now: "2026-09-19T00:00:01Z" })).toBe("vermelho");
  });
});

describe("matchesSlaConfigFilter", () => {
  test("CLARO e VIVO mostram status mesmo quando ainda não são aplicáveis à operadora", () => {
    expect(matchesSlaConfigFilter("CLARO", false, true)).toBe(true);
    expect(matchesSlaConfigFilter("VIVO", true, false)).toBe(true);
    expect(matchesSlaConfigFilter("CLARO", false, false)).toBe(true);
    expect(matchesSlaConfigFilter("VIVO", false, false)).toBe(true);
  });

  test("Ambas mostra apenas status ativos nas duas operadoras", () => {
    expect(matchesSlaConfigFilter("AMBAS", true, true)).toBe(true);
    expect(matchesSlaConfigFilter("AMBAS", true, false)).toBe(false);
    expect(matchesSlaConfigFilter("AMBAS", false, true)).toBe(false);
    expect(matchesSlaConfigFilter("AMBAS", false, false)).toBe(false);
  });
});
