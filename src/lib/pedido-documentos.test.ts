import { describe, expect, test } from "bun:test";
import {
  MAX_PEDIDO_DOCUMENT_BYTES,
  formatDocumentBytes,
  sanitizePedidoDocumentFileName,
  validatePedidoDocumento,
} from "./pedido-documentos";

const valid = { name: "contrato.pdf", type: "application/pdf", size: 1024 };

describe("pedido-documentos", () => {
  test("aceita PDF abaixo de 100 MB", () => {
    expect(validatePedidoDocumento("Contrato", valid)).toBeNull();
  });

  test("rejeita exatamente acima de 100 MB", () => {
    expect(
      validatePedidoDocumento("Contrato", {
        ...valid,
        size: MAX_PEDIDO_DOCUMENT_BYTES + 1,
      }),
    ).toContain("100 MB");
  });

  test("rejeita executável", () => {
    expect(
      validatePedidoDocumento("Arquivo", {
        name: "x.exe",
        type: "application/x-msdownload",
        size: 10,
      }),
    ).toContain("não suportado");
  });

  test("rejeita título vazio", () => {
    expect(validatePedidoDocumento("   ", valid)).toContain("título");
  });

  test("rejeita arquivo vazio", () => {
    expect(validatePedidoDocumento("Contrato", { ...valid, size: 0 })).toContain("vazio");
  });

  test("sanitiza nome mantendo extensão", () => {
    expect(sanitizePedidoDocumentFileName("Contrato Assinado (Final).PDF"))
      .toBe("contrato-assinado-final.pdf");
  });

  test("formata tamanho de arquivo", () => {
    expect(formatDocumentBytes(1024)).toBe("1 KB");
    expect(formatDocumentBytes(1536 * 1024)).toBe("1,5 MB");
  });
});
