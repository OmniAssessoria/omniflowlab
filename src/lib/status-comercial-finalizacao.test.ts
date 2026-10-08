import test from "node:test";
import assert from "node:assert/strict";
import {
  isCommercialCompletionStatus,
  commercialCompletionStatusName,
} from "./status-comercial-finalizacao.ts";

test("CLARO considera ATIVADO 100% como status comercial final", () => {
  assert.equal(isCommercialCompletionStatus("CLARO", "MV - ATIVADO 100%"), true);
  assert.equal(isCommercialCompletionStatus("CLARO", "MV - LOGÍSTICA CONCLUÍDA"), false);
  assert.equal(commercialCompletionStatusName("CLARO"), "ATIVADO 100%");
});

test("VIVO considera LOGÍSTICA CONCLUÍDA como status comercial final", () => {
  assert.equal(isCommercialCompletionStatus("VIVO", "MV - LOGÍSTICA CONCLUÍDA"), true);
  assert.equal(isCommercialCompletionStatus("VIVO", "MV - ATIVADO 100%"), false);
  assert.equal(commercialCompletionStatusName("VIVO"), "LOGÍSTICA CONCLUÍDA");
});

test("comparação ignora prefixo de produto, caixa e acento da logística", () => {
  assert.equal(isCommercialCompletionStatus("VIVO", "logistica concluida"), true);
  assert.equal(isCommercialCompletionStatus("CLARO", "ativado 100%"), true);
});
