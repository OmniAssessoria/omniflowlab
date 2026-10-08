import { describe, expect, test } from "bun:test";
import ts from "typescript";

async function read(path: string) {
  return Bun.file(new URL(path, import.meta.url)).text();
}

describe("Operação Closer - navegação principal", () => {
  test("a rota de detalhe Closer possui JSX sintaticamente válido", async () => {
    const path = "./_shell.operacao-closer.$id.tsx";
    const source = await read(path);
    const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    expect(sourceFile.parseDiagnostics).toHaveLength(0);
  });

  test("o header global troca GERAL OMNI / CLARO / VIVO por GERAL CLOSER / ONVOX / TAKE na Operação Closer", async () => {
    const source = await read("../components/app-shell.tsx");

    expect(source).toContain('const isOperacaoCloser = pathname.startsWith("/operacao-closer")');
    expect(source).toContain("Geral Closer");
    expect(source).toContain("closerCounts.total");
    expect(source).toContain("closerCounts.onvox");
    expect(source).toContain("closerCounts.take");
    expect(source).toContain('brand="ONVOX"');
    expect(source).toContain('brand="TAKE_FLOW"');
  });

  test("a marca selecionada no header controla o filtro da lista pela rota", async () => {
    const source = await read("./_shell.operacao-closer.tsx");

    expect(source).toContain("validateSearch");
    expect(source).toContain("Route.useSearch()");
    expect(source).toContain('marca === "ONVOX"');
    expect(source).toContain('marca === "TAKE_FLOW"');
  });

  test("remove os cards grandes de ONVOX e TAKE da tela principal", async () => {
    const source = await read("./_shell.operacao-closer.tsx");

    expect(source).not.toContain("function CloserBrandCard");
    expect(source).not.toContain("<CloserBrandCard");
  });

  test("o fundo do cabeçalho acompanha Geral, ONVOX e TAKE", async () => {
    const source = await read("./_shell.operacao-closer.tsx");

    expect(source).toContain('produto === "TODOS"');
    expect(source).toContain('produto === "ONVOX"');
    expect(source).toContain('produto === "TAKE_FLOW"');
    expect(source).toContain("CLOSER_HEADER_BACKGROUND");
  });
});


describe("Operação Closer - totalizador da coluna Receita", () => {
  test("mostra abaixo do título a receita total dos pedidos visíveis", async () => {
    const source = await read("./_shell.operacao-closer.tsx");

    expect(source).toContain("somarReceitaCloser(filtered)");
    expect(source).toContain("receitaTotalFiltrada");
    expect(source).toContain("Total:");
    expect(source).toContain("brl(receitaTotalFiltrada)");
  });
});
