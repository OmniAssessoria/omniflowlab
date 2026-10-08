import { describe, expect, test } from "bun:test";
import { doadorLinhaLabel, hasDoador } from "./linha-doador";

describe("linha com doador único", () => {
  test("sem doador não mostra indicador", () => {
    expect(hasDoador(null)).toBe(false);
    expect(doadorLinhaLabel(null)).toBeNull();
  });

  test("com doador mostra um único indicador", () => {
    const doador = { nome_completo: "Maria Silva" };
    expect(hasDoador(doador)).toBe(true);
    expect(doadorLinhaLabel(doador)).toBe("Doador");
  });
});
