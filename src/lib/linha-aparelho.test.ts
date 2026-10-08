import { describe, expect, test } from "bun:test";
import { isTipoProdutoAparelho, linhaBusinessFields } from "./linha-aparelho";

describe("linhas de Aparelhos", () => {
  test("reconhece Aparelhos sem depender de caixa ou espaços", () => {
    expect(isTipoProdutoAparelho("Aparelhos")).toBe(true);
    expect(isTipoProdutoAparelho("  aparelhos  ")).toBe(true);
    expect(isTipoProdutoAparelho("Portabilidade")).toBe(false);
  });

  test("Aparelhos usa somente Nome do aparelho, Produto, Tipo de Produto e Valor", () => {
    expect(linhaBusinessFields("Aparelhos")).toEqual([
      "nome_aparelho",
      "produto",
      "tipo_produto",
      "valor",
    ]);
  });

  test("linha normal mantém DDD, Número, Produto, Tipo de Produto, Plano e Valor", () => {
    expect(linhaBusinessFields("Portabilidade")).toEqual([
      "ddd",
      "numero",
      "produto",
      "tipo_produto",
      "plano",
      "valor",
    ]);
  });
});
