import { describe, expect, test } from "bun:test";
import {
  SUPPORT_PRIORITY_OPTIONS,
  canReclassifySupportPriority,
  getSupportPriorityMeta,
  type SupportPriority,
} from "./support-priority";

describe("prioridade de suporte", () => {
  test("possui exatamente A tratar e Urgente como valores independentes da etapa", () => {
    expect(SUPPORT_PRIORITY_OPTIONS.map(item => item.value)).toEqual(["a_tratar", "urgente"]);
    expect(SUPPORT_PRIORITY_OPTIONS.map(item => item.label)).toEqual(["A tratar", "Urgente"]);
    expect(SUPPORT_PRIORITY_OPTIONS.every(item => !item.value.startsWith("s-"))).toBe(true);
  });

  test("define sinalização visual sem depender de stage ids", () => {
    const normal = getSupportPriorityMeta("a_tratar");
    const urgent = getSupportPriorityMeta("urgente");
    expect(normal.label).toBe("A tratar");
    expect(normal.tone).toBe("warning");
    expect(normal.pulse).toBe(false);
    expect(urgent.label).toBe("Urgente");
    expect(urgent.tone).toBe("destructive");
    expect(urgent.pulse).toBe(true);
  });

  test("somente BKO e Admin podem reclassificar prioridade", () => {
    expect(canReclassifySupportPriority("bko")).toBe(true);
    expect(canReclassifySupportPriority("admin")).toBe(true);
    expect(canReclassifySupportPriority("gestor")).toBe(false);
    expect(canReclassifySupportPriority("consultor")).toBe(false);
    expect(canReclassifySupportPriority("suporte")).toBe(false);
  });

  test("tipo aceita somente os dois valores aprovados", () => {
    const values: SupportPriority[] = ["a_tratar", "urgente"];
    expect(values).toHaveLength(2);
  });
});
