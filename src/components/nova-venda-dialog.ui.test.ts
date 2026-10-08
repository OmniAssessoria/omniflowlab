import { describe, expect, test } from "bun:test";

describe("Nova Venda no Pipeline", () => {
  test("entra em Processos BKO > Troca de Carteira | Abertura de Caso", async () => {
    const source = await Bun.file(new URL("./nova-venda-dialog.tsx", import.meta.url)).text();

    expect(source).toContain('const PIPELINE_NOVA_VENDA_DESTINO = {');
    expect(source).toContain('funil_id: "processos_bko"');
    expect(source).toContain('etapa_id: "bko-troca"');
    expect(source).toContain('nome: "Troca de Carteira | Abertura de Caso"');
    expect(source).toContain("PIPELINE_NOVA_VENDA_DESTINO.funil_id");
    expect(source).toContain("PIPELINE_NOVA_VENDA_DESTINO.etapa_id");
  });
});
