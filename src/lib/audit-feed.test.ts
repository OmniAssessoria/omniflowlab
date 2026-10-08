import { describe, expect, test } from "bun:test";
import { auditActionLabel, auditOriginLabel, type AuditOrigin } from "./audit-feed";

describe("auditOriginLabel", () => {
  test("traduz todas as origens operacionais", () => {
    const expected: Record<AuditOrigin, string> = {
      sistema: "Sistema",
      pedido: "Pedido",
      status_comercial: "Status Comercial",
      suporte: "Suporte",
      importacao: "Importação",
      chamado_sla: "SLA de Chamado",
    };
    for (const [origin, label] of Object.entries(expected)) {
      expect(auditOriginLabel(origin as AuditOrigin)).toBe(label);
    }
  });
});

describe("auditActionLabel", () => {
  test("traduz ações conhecidas sem expor código interno", () => {
    expect(auditActionLabel("pipeline_etapa_desativacao")).toBe("Etapa do Pipeline desativada");
    expect(auditActionLabel("suporte_avulso_exclusao")).toBe("Suporte avulso excluído");
    expect(auditActionLabel("status_comercial_alterado")).toBe("Status Comercial alterado");
    expect(auditActionLabel("sla_status_alterado")).toBe("SLA Comercial alterado");
    expect(auditActionLabel("sla_status_excluido")).toBe("SLA Comercial excluído");
  });

  test("humaniza ações desconhecidas", () => {
    expect(auditActionLabel("alguma_acao_nova")).toBe("Alguma acao nova");
  });
});
