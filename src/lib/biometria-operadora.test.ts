import { describe, expect, test } from "bun:test";
import { isStageAllowedForOperadora, supportsBiometria } from "./biometria-operadora";

describe("biometria por operadora", () => {
  test("CLARO aceita biometria", () => {
    expect(supportsBiometria("CLARO")).toBe(true);
    expect(isStageAllowedForOperadora("a-biometria", "CLARO")).toBe(true);
  });

  test("VIVO não aceita biometria", () => {
    expect(supportsBiometria("VIVO")).toBe(false);
    expect(isStageAllowedForOperadora("a-biometria", "VIVO")).toBe(false);
    expect(isStageAllowedForOperadora("a-d1", "VIVO")).toBe(true);
  });

  test("operadora ausente mantém biometria fechada", () => {
    expect(supportsBiometria(undefined)).toBe(false);
    expect(supportsBiometria(null)).toBe(false);
    expect(isStageAllowedForOperadora("a-biometria", undefined)).toBe(false);
  });
});
