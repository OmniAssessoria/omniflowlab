import { describe, expect, test } from "bun:test";

describe("edição da data de portabilidade", () => {
  test("não aplica limites cronológicos à data de portabilidade", async () => {
    const source = await Bun.file(new URL("./_shell.vendas.$id.tsx", import.meta.url)).text();

    expect(source).toContain('key === "data_portabilidade"');
    expect(source).toContain("portabilidadeSemLimite");
    expect(source).toContain("minDate={portabilidadeSemLimite ? undefined : minFor(key)}");
    expect(source).toContain("maxDate={portabilidadeSemLimite ? undefined : maxFor(key)}");
  });
});
