import { describe, expect, test } from "bun:test";
import {
  isProdutoPassaporteAdicional,
  isProdutoPassaporteClaro,
  linhaPermitePassaporte,
} from "./linha-passaporte";

describe("Passaporte por linha", () => {
  test("CLARO Móvel permite Passaporte nos Tipos de Pedido com Móvel", () => {
    expect(linhaPermitePassaporte({ operadora: "CLARO", produto: "Móvel", tipoPedido: "Novo" })).toBe(true);
    expect(linhaPermitePassaporte({ operadora: "CLARO", produto: "Móvel", tipoPedido: "Renovação" })).toBe(true);
    expect(linhaPermitePassaporte({ operadora: "CLARO", produto: "Móvel", tipoPedido: "Portabilidade Cruzada PF/PJ" })).toBe(true);
    expect(linhaPermitePassaporte({ operadora: "CLARO", produto: "Móvel", tipoPedido: "Transferência de Titularidade PF/PJ Pós" })).toBe(false);
    expect(linhaPermitePassaporte({ operadora: "CLARO", produto: "Móvel", tipoPedido: "Transferência de Titularidade PF/PJ Pré" })).toBe(false);
    expect(linhaPermitePassaporte({ operadora: "CLARO", produto: "Móvel", tipoPedido: "Transferência de Titularidade PJ/PJ" })).toBe(false);
    expect(linhaPermitePassaporte({ operadora: "CLARO", produto: "Fixa", tipoPedido: "Novo" })).toBe(false);
  });

  test("produto Passaporte CLARO funciona em Novo e SVA", () => {
    expect(linhaPermitePassaporte({ operadora: "CLARO", produto: "Passaporte", tipoPedido: "Novo" })).toBe(true);
    expect(linhaPermitePassaporte({ operadora: "CLARO", produto: "Passaporte", tipoPedido: "SVA" })).toBe(true);
    expect(linhaPermitePassaporte({ operadora: "CLARO", produto: "Passaporte", tipoPedido: "Portado" })).toBe(false);
  });

  test("reconhece somente os Passaportes adicionais escondidos do Produto principal", () => {
    expect(isProdutoPassaporteClaro("CLARO PASSAPORTE AMÉRICAS")).toBe(true);
    expect(isProdutoPassaporteAdicional("CLARO PASSAPORTE MUNDO TOTAL")).toBe(true);
    expect(isProdutoPassaporteAdicional("CLARO PASSAPORTE ÁSIA")).toBe(true);
    expect(isProdutoPassaporteAdicional("VIVO TRAVEL ÁSIA")).toBe(true);
    expect(isProdutoPassaporteAdicional("Passaporte")).toBe(false);
  });
});


describe("Passaporte VIVO atualizado", () => {
  test("Móvel VIVO aceita Passaporte em Migrações e Novo", () => {
    expect(linhaPermitePassaporte({ operadora: "vivo", produto: "MÓVEL", tipoPedido: "MIGRAÇÃO PLANO" })).toBe(true);
    expect(linhaPermitePassaporte({ operadora: "VIVO", produto: "movel", tipoPedido: "migração pré" })).toBe(true);
    expect(linhaPermitePassaporte({ operadora: "VIVO", produto: "Móvel", tipoPedido: "MIGRACAO POS" })).toBe(true);
    expect(linhaPermitePassaporte({ operadora: "VIVO", produto: "Móvel", tipoPedido: "NOVO" })).toBe(true);
  });

  test("Passaporte como produto principal é do SVA VIVO", () => {
    expect(linhaPermitePassaporte({ operadora: "VIVO", produto: "PASSAPORTE", tipoPedido: "SVA" })).toBe(true);
    expect(linhaPermitePassaporte({ operadora: "VIVO", produto: "PASSAPORTE", tipoPedido: "NOVO" })).toBe(false);
  });
});
