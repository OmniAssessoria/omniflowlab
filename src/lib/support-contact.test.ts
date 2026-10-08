import { describe, expect, test } from "bun:test";
import { formatSupportPhone, isCompleteSupportPhone } from "./support-contact";

describe("contato do suporte avulso", () => {
  test("forma o DDD enquanto a pessoa digita", () => {
    expect(formatSupportPhone("1")).toBe("(1");
    expect(formatSupportPhone("16")).toBe("(16)");
    expect(formatSupportPhone("169")).toBe("(16) 9");
  });

  test("mantém a máscara de celular estável enquanto o número é digitado", () => {
    expect(formatSupportPhone("1698765")).toBe("(16) 98765");
    expect(formatSupportPhone("16987654")).toBe("(16) 98765-4");
  });

  test("formata celular brasileiro com DDD", () => {
    expect(formatSupportPhone("16987654321")).toBe("(16) 98765-4321");
  });

  test("formata telefone fixo brasileiro com DDD", () => {
    expect(formatSupportPhone("1633334444")).toBe("(16) 3333-4444");
  });

  test("considera completo apenas telefone com DDD e 10 ou 11 dígitos", () => {
    expect(isCompleteSupportPhone("(16) 98765-4321")).toBe(true);
    expect(isCompleteSupportPhone("(16) 3333-4444")).toBe(true);
    expect(isCompleteSupportPhone("(16) 9876-543")).toBe(false);
  });
});
