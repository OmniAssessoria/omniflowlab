import { describe, expect, test } from "bun:test";
import {
  getAvailableConsultants,
  getConsultorTargetRows,
  resolveWeeklyOrigin,
  resolveWeeklySplit,
  suggestWeeklySplit,
} from "./acompanhamento-metas";

describe("suggestWeeklySplit", () => {
  test("divide em centavos preservando o total mensal", () => {
    const split = suggestWeeklySplit(100, 3);
    expect(split).toHaveLength(3);
    expect(split.reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(split).toEqual([33.34, 33.33, 33.33]);
  });

  test("suporta cinco semanas", () => {
    expect(suggestWeeklySplit(500, 5)).toEqual([100, 100, 100, 100, 100]);
  });
});

describe("resolveWeeklySplit", () => {
  test("preserva valor manual armazenado no bootstrap", () => {
    const resolved = resolveWeeklySplit(
      [100, 100, 100, 100],
      [{ semana: 2, grupo: "novo_importado", valor: 175, origem: "manual" }],
      "novo_importado",
    );
    expect(resolved).toEqual([100, 175, 100, 100]);
  });

  test("recalcula valor anteriormente automático quando a meta mensal muda", () => {
    const resolved = resolveWeeklySplit(
      [125, 125, 125, 125],
      [{ semana: 2, grupo: "novo_importado", valor: 100, origem: "automatico" }],
      "novo_importado",
    );
    expect(resolved).toEqual([125, 125, 125, 125]);
  });
});

describe("resolveWeeklyOrigin", () => {
  test("mantém origem manual depois de recarregar sem nova edição", () => {
    expect(resolveWeeklyOrigin(
      [{ semana: 2, grupo: "novo_importado", valor: 175, origem: "manual" }] as any,
      "novo_importado",
      2,
      false,
    )).toBe("manual");
  });

  test("nova edição transforma a semana em manual", () => {
    expect(resolveWeeklyOrigin([], "renovacao", 1, true)).toBe("manual");
  });

  test("sem edição nem manual anterior, mantém automático", () => {
    expect(resolveWeeklyOrigin([], "renovacao", 1, false)).toBe("automatico");
  });
});

describe("consultant target helpers", () => {
  const active = [{ id: "a", nome_completo: "Ativo", ativo: true }];
  const historical = [{ id: "h", nome_completo: "Histórico", ativo: false, historico: true }];

  test("mantém consultor inativo quando ele já possui meta histórica", () => {
    expect(getConsultorTargetRows(active, historical, ["h"]).map(item => item.id)).toEqual(["h"]);
  });

  test("não oferece consultor inativo para nova meta", () => {
    expect(getAvailableConsultants(active, []).map(item => item.id)).toEqual(["a"]);
  });
});
