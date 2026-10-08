import { describe, expect, test } from "bun:test";
import {
  creationTargets,
  normalizeStatusCommercialName,
  parseStatusCommercialSla,
} from "./status-comercial-management";

describe("Status Comercial gerenciável", () => {
  test("normaliza nome sem aceitar vazio", () => {
    expect(normalizeStatusCommercialName("  NOVO STATUS  ")).toBe("NOVO STATUS");
    expect(normalizeStatusCommercialName("   ")).toBeNull();
    expect(normalizeStatusCommercialName("MV - AGUARDANDO ACEITE")).toBe("AGUARDANDO ACEITE");
    expect(normalizeStatusCommercialName("FB - CANCELADO")).toBe("CANCELADO");
    expect(normalizeStatusCommercialName("AVA - CANCELADO")).toBe("CANCELADO");
    expect(normalizeStatusCommercialName("COM - PROPOSTA ENVIADA (50%)")).toBe("PROPOSTA ENVIADA (50%)");
    expect(normalizeStatusCommercialName("TROCA NEGADA - CANCELADO")).toBe("TROCA NEGADA - CANCELADO");
    expect(normalizeStatusCommercialName("PRD - SUPORTE")).toBe("PRD - SUPORTE");
  });

  test("SLA aceita horas inteiras positivas ou Sem SLA", () => {
    expect(parseStatusCommercialSla("72")).toBe(72);
    expect(parseStatusCommercialSla("")).toBeNull();
    expect(parseStatusCommercialSla("0")).toBeUndefined();
    expect(parseStatusCommercialSla("2.5")).toBeUndefined();
  });

  test("criação respeita CLARO, VIVO ou Ambas", () => {
    expect(creationTargets("CLARO")).toEqual(["CLARO"]);
    expect(creationTargets("VIVO")).toEqual(["VIVO"]);
    expect(creationTargets("AMBAS")).toEqual(["CLARO", "VIVO"]);
  });
});
