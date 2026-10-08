import { describe, expect, test } from "bun:test";
import { formatCnpjInput, getCnpjDigits, isCompleteCnpj } from "./cnpj-mask";

describe("campo livre de CNPJ", () => {
  test("preserva letras, números e pontuação sem aplicar máscara", () => {
    expect(formatCnpjInput("12.ABC.678/90X2-34")).toBe("12.ABC.678/90X2-34");
    expect(formatCnpjInput("ABC123")).toBe("ABC123");
  });

  test("não limita o tamanho do valor digitado", () => {
    expect(getCnpjDigits("12.ABC.678/90X2-345678")).toBe("12.ABC.678/90X2-345678");
  });

  test("considera válido qualquer valor não vazio", () => {
    expect(isCompleteCnpj("12.ABC.678/90X2-34")).toBe(true);
    expect(isCompleteCnpj("ABC123")).toBe(true);
    expect(isCompleteCnpj("   ")).toBe(false);
  });
});
