import { describe, expect, test } from "bun:test";

describe("funil de suporte enxuto", () => {
  test("remove cabeçalho, valor comercial e textos redundantes do card", async () => {
    const pipeline = await Bun.file(new URL("./support-pipeline.tsx", import.meta.url)).text();
    const commercial = await Bun.file(new URL("./commercial-pipeline.tsx", import.meta.url)).text();

    expect(pipeline).not.toContain("Funil de Suporte");
    expect(pipeline).not.toContain("<SupportPriorityBadge");
    expect(pipeline).not.toContain("Suporte avulso");
    expect(pipeline).not.toContain("{item.motivo}");
    expect(pipeline).not.toContain("{item.ticket?.numero || item.numero}");
    expect(pipeline).not.toContain("<MessageCircle");
    expect(commercial).toContain('funil !== "suporte"');
  });

  test("mantém lateral por prioridade e mostra alerta amarelo de novas mensagens", async () => {
    const source = await Bun.file(new URL("./support-pipeline.tsx", import.meta.url)).text();

    expect(source).toContain('item.prioridade === "urgente"');
    expect(source).toContain("bg-destructive animate-pulse");
    expect(source).toContain("bg-warning");
    expect(source).toContain("Novas Mensagens");
    expect(source).toContain("getSupportUnreadMap");
  });

  test("a central geral redireciona perfis operacionais ao funil e preserva Meus Suportes do Closer", async () => {
    const source = await Bun.file(new URL("../routes/_shell.suporte.index.tsx", import.meta.url)).text();

    expect(source).toContain("SUPORTE_GERAL_SOMENTE_CLOSER");
    expect(source).toContain('to="/pipeline"');
    expect(source).toContain('funil: "suporte"');
  });
});
