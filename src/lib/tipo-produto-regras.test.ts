import test from "node:test";
import assert from "node:assert/strict";
import {
  podeAdicionarBonusTipoProduto,
  podeAdicionarDoadorTipoProduto,
  deveExibirBonusTipoProduto,
  deveExibirDoadorTipoProduto,
} from "./tipo-produto-regras.ts";

test("bônus novo só é permitido para VIVO com flag ativa", () => {
  assert.equal(podeAdicionarBonusTipoProduto({ operadora: "VIVO", permite_bonus: true }), true);
  assert.equal(podeAdicionarBonusTipoProduto({ operadora: "VIVO", permite_bonus: false }), false);
  assert.equal(podeAdicionarBonusTipoProduto({ operadora: "CLARO", permite_bonus: true }), false);
});

test("doador novo segue a flag do tipo de produto em qualquer operadora", () => {
  assert.equal(podeAdicionarDoadorTipoProduto({ operadora: "VIVO", permite_doador: true }), true);
  assert.equal(podeAdicionarDoadorTipoProduto({ operadora: "CLARO", permite_doador: true }), true);
  assert.equal(podeAdicionarDoadorTipoProduto({ operadora: "VIVO", permite_doador: false }), false);
});

test("histórico de bônus continua visível quando a configuração futura é desligada", () => {
  const config = { operadora: "VIVO", permite_bonus: false };
  assert.equal(deveExibirBonusTipoProduto(config, true, 20), true);
  assert.equal(deveExibirBonusTipoProduto(config, false, null), false);
});

test("histórico de doador continua visível quando a configuração futura é desligada", () => {
  const config = { operadora: "CLARO", permite_doador: false };
  assert.equal(deveExibirDoadorTipoProduto(config, true), true);
  assert.equal(deveExibirDoadorTipoProduto(config, false), false);
});
