import { describe, expect, test } from "bun:test";
import { bonusLinhaLabel } from "./linha-bonus";

describe("bonusLinhaLabel", () => {
  test("mantém o bônus histórico visível mesmo quando a regra futura do tipo muda", () => {
    expect(bonusLinhaLabel("VIVO", "Portado", true, 20)).toBe("Bônus 20 GB");
    expect(bonusLinhaLabel("VIVO", "Renovação", true, 20)).toBe("Bônus 20 GB");
  });

  test("não exibe estado vazio nem bônus em CLARO", () => {
    expect(bonusLinhaLabel("VIVO", "Portado", false, null)).toBeNull();
    expect(bonusLinhaLabel("CLARO", "Portado", true, 20)).toBeNull();
  });
});
