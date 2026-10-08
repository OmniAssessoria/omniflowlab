import { describe, expect, test } from "bun:test";
import { produtoExigeEndereco, usesScopedTipoProdutoRename } from "./tipo-produto-catalogo";

describe("endereço obrigatório por produto", () => {
  test("FIXA e BANDA LARGA exibem o campo de endereço", () => {
    expect(produtoExigeEndereco(["FIXA"])).toBe(true);
    expect(produtoExigeEndereco(["Fixa"])).toBe(true);
    expect(produtoExigeEndereco(["BANDA LARGA"])).toBe(true);
    expect(produtoExigeEndereco(["Banda Larga"])).toBe(true);
  });

  test("outros produtos não exibem o campo de endereço", () => {
    expect(produtoExigeEndereco(["MÓVEL"])).toBe(false);
    expect(produtoExigeEndereco(["APARELHO"])).toBe(false);
    expect(produtoExigeEndereco([])).toBe(false);
  });
});

describe("renomeação de catálogo por operadora", () => {
  test("Tipo de Produto usa a renomeação transacional por operadora", () => {
    expect(usesScopedTipoProdutoRename("tipos_pedido_catalogo")).toBe(true);
  });

  test("outros catálogos mantêm a edição simples", () => {
    expect(usesScopedTipoProdutoRename("produtos_catalogo")).toBe(false);
    expect(usesScopedTipoProdutoRename("planos_catalogo")).toBe(false);
  });
});
