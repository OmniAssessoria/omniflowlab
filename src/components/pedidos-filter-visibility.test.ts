import { describe, expect, test } from "bun:test";
import { shouldHidePedidosFilter } from "./pedidos-filter-visibility";

describe("visibilidade dos filtros de Pedidos", () => {
  test("oculta BKO, Biometria e Erro", () => {
    expect(shouldHidePedidosFilter("BKO")).toBe(true);
    expect(shouldHidePedidosFilter("Biometria")).toBe(true);
    expect(shouldHidePedidosFilter("Erro")).toBe(true);
  });

  test("mantém os demais filtros", () => {
    expect(shouldHidePedidosFilter("Operadora")).toBe(false);
    expect(shouldHidePedidosFilter("Consultor")).toBe(false);
    expect(shouldHidePedidosFilter("SLA")).toBe(false);
    expect(shouldHidePedidosFilter("Funil")).toBe(false);
    expect(shouldHidePedidosFilter("Mês")).toBe(false);
    expect(shouldHidePedidosFilter("Ano")).toBe(false);
  });
});
