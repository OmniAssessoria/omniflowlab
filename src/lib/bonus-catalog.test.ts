import { describe, expect, test } from "bun:test";
import { getSelectableBonusValues } from "./bonus-catalog";

describe("catálogo de bônus VIVO", () => {
  test("lista somente opções ativas, únicas e ordenadas", () => {
    expect(getSelectableBonusValues([
      { gb: 20, ativo: true },
      { gb: 10, ativo: true },
      { gb: 20, ativo: true },
      { gb: 30, ativo: false },
    ])).toEqual([10, 20]);
  });

  test("preserva valor histórico selecionado mesmo se saiu do catálogo", () => {
    expect(getSelectableBonusValues([
      { gb: 10, ativo: true },
      { gb: 20, ativo: true },
      { gb: 30, ativo: false },
    ], 30)).toEqual([10, 20, 30]);
  });

  test("ignora valores inválidos do catálogo", () => {
    expect(getSelectableBonusValues([
      { gb: 0, ativo: true },
      { gb: -10, ativo: true },
      { gb: 15.5, ativo: true },
      { gb: 25, ativo: true },
    ])).toEqual([25]);
  });
});
