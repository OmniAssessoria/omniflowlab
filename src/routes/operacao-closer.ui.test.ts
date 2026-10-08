import { describe, expect, test } from "bun:test";

describe("layout da Operação Closer", () => {
  test("não exibe título, subtítulo nem cards de resumo geral", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.tsx", import.meta.url)).text();

    expect(source).not.toContain(">Operação Closer<");
    expect(source).not.toContain("Acompanhamento visual das operações Onvox e Take Flow");
    expect(source).not.toContain('<StatCard label="Total"');
    expect(source).not.toContain('<StatCard label="Em andamento"');
    expect(source).not.toContain('<StatCard label="Concluídos"');
    expect(source).not.toContain('<StatCard label="Cancelados"');
  });

  test("não volta a exibir os cards grandes ONVOX e TAKE na lista principal", async () => {
    const source = await Bun.file(new URL("./_shell.operacao-closer.tsx", import.meta.url)).text();
    const brandTileSource = await Bun.file(new URL("../components/brand-logo.tsx", import.meta.url)).text();

    expect(source).not.toContain("function CloserBrandCard");
    expect(source).not.toContain("<CloserBrandCard");
    expect(brandTileSource).toContain("showRadialGlow = true");
  });
});
