import { describe, expect, test } from "bun:test";
import { getMonthOperationalWeeks, normalizeAcompanhamentoStatus } from "./acompanhamento";

describe("normalizeAcompanhamentoStatus", () => {
  test("normaliza caixa, acentos e espaços", () => {
    expect(normalizeAcompanhamentoStatus("  Aguardando   Aceite ")).toBe("AGUARDANDO ACEITE");
    expect(normalizeAcompanhamentoStatus("aguardándo aceite")).toBe("AGUARDANDO ACEITE");
  });

  test("remove apenas prefixos técnicos conhecidos do robô", () => {
    expect(normalizeAcompanhamentoStatus("ROBÔ - AGUARDANDO ACEITE")).toBe("AGUARDANDO ACEITE");
    expect(normalizeAcompanhamentoStatus("ROBO: AGUARDANDO ACEITE")).toBe("AGUARDANDO ACEITE");
  });

  test("não aproxima nomes semanticamente parecidos", () => {
    expect(normalizeAcompanhamentoStatus("AGUARDANDO ACEITE CLIENTE")).not.toBe(
      normalizeAcompanhamentoStatus("AGUARDANDO ACEITE"),
    );
  });
});

describe("getMonthOperationalWeeks", () => {
  test("usa blocos operacionais de sete dias e suporta quinta semana", () => {
    const september = getMonthOperationalWeeks(2026, 9);
    expect(september).toHaveLength(5);
    expect(september[0]).toEqual({ index: 1, start: "2026-09-01", end: "2026-09-07" });
    expect(september[4]).toEqual({ index: 5, start: "2026-09-29", end: "2026-09-30" });
  });

  test("mês de 28 dias usa quatro semanas", () => {
    const february = getMonthOperationalWeeks(2026, 2);
    expect(february).toHaveLength(4);
    expect(february[3]).toEqual({ index: 4, start: "2026-02-22", end: "2026-02-28" });
  });
});
