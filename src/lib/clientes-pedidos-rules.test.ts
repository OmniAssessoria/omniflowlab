import { describe, expect, test } from "bun:test";
import {
  SLA_FILTER_OPTIONS,
  meusPedidosCorrespondeMesAno,
  meusPedidosMesReferencia,
  pedidoStatusMaisRecente,
  missingRequiredCompletionDates,
  pedidoTableColumns,
  statusFiltroCorresponde,
  statusFiltroSelecionadosDisponiveis,
  visibleCommercialFunnels,
} from "./clientes-pedidos-rules";

describe("regras de Clientes / Pedidos", () => {
  test("status automático marca somente os status disponíveis pelos outros filtros", () => {
    expect(statusFiltroSelecionadosDisponiveis(
      ["CONECTADO", "AGUARDANDO ENTREGA", "CANCELADO"],
      [],
      false,
    )).toEqual(["CONECTADO", "AGUARDANDO ENTREGA", "CANCELADO"]);

    expect(statusFiltroCorresponde("QUALQUER STATUS", [], false)).toBe(true);
  });

  test("status manual preserva somente as escolhas ainda disponíveis", () => {
    expect(statusFiltroSelecionadosDisponiveis(
      ["CONECTADO", "AGUARDANDO ENTREGA"],
      ["CONECTADO", "CANCELADO"],
      true,
    )).toEqual(["CONECTADO"]);

    expect(statusFiltroCorresponde("CONECTADO", ["CONECTADO"], true)).toBe(true);
    expect(statusFiltroCorresponde("AGUARDANDO ENTREGA", ["CONECTADO"], true)).toBe(false);
  });


  test("Meus Pedidos oculta somente grupos do produto APARELHO", async () => {
    const rules = await import("./clientes-pedidos-rules");
    const visivel = (rules as any).pedidoProdutoVisivelEmMeusPedidos;

    expect(visivel?.("APARELHO")).toBe(false);
    expect(visivel?.(" aparelho ")).toBe(false);
    expect(visivel?.("MÓVEL")).toBe(true);
    expect(visivel?.("FIXA")).toBe(true);
    expect(visivel?.(null)).toBe(true);
  });

  test("status do pedido usa o evento mais recente entre usuário e robô", () => {
    expect(pedidoStatusMaisRecente(
      {
        nome: "ANÁLISE BKO",
        createdAt: "2026-10-01T19:54:49.512Z",
        origem: "manual",
      },
      {
        nome: "PENDÊNCIA COMERCIAL",
        createdAt: "2026-10-01T19:40:00.000Z",
        origem: "robo",
      },
    )?.nome).toBe("ANÁLISE BKO");

    expect(pedidoStatusMaisRecente(
      {
        nome: "ANÁLISE BKO",
        createdAt: "2026-10-01T19:54:49.512Z",
        origem: "manual",
      },
      {
        nome: "AGUARDANDO ACEITE",
        createdAt: "2026-10-01T20:10:00.000Z",
        origem: "robo",
      },
    )?.nome).toBe("AGUARDANDO ACEITE");
  });

  test("pedido sem Data de Ativação e não cancelado fica no mês atual", () => {
    const hoje = new Date(2026, 9, 7, 12, 0, 0);
    const pedido = {
      status: "QUALQUER STATUS",
      dataAtivacao: null,
      dataPreenchimento: "2026-09-15",
    };

    expect(meusPedidosMesReferencia(pedido)).toBeNull();
    expect(meusPedidosCorrespondeMesAno(pedido, "10", "2026", hoje)).toBe(true);
    expect(meusPedidosCorrespondeMesAno(pedido, "9", "2026", hoje)).toBe(false);
  });

  test("qualquer pedido com Data de Ativação pertence ao mês dessa data, ignorando status", () => {
    const pedido = {
      status: "AGUARDANDO PORTABILIDADE",
      dataAtivacao: "2026-09-30",
      dataPreenchimento: "2026-10-01",
    };

    expect(meusPedidosMesReferencia(pedido)).toEqual({ year: 2026, month: 9 });
    expect(meusPedidosCorrespondeMesAno(pedido, "9", "2026")).toBe(true);
    expect(meusPedidosCorrespondeMesAno(pedido, "10", "2026")).toBe(false);
  });

  test("Data de Portabilidade não interfere mais na competência", () => {
    const hoje = new Date(2026, 9, 7, 12, 0, 0);
    const pedido = {
      status: "AGUARDANDO PORTABILIDADE",
      dataAtivacao: null,
      dataPreenchimento: "2026-09-20",
    };

    expect(meusPedidosMesReferencia(pedido)).toBeNull();
    expect(meusPedidosCorrespondeMesAno(pedido, "10", "2026", hoje)).toBe(true);
    expect(meusPedidosCorrespondeMesAno(pedido, "9", "2026", hoje)).toBe(false);
  });

  test("cancelado sem ativação usa Data de Preenchimento", () => {
    const pedido = {
      status: "CANCELADO",
      dataAtivacao: null,
      dataPreenchimento: "2026-09-12",
    };

    expect(meusPedidosMesReferencia(pedido)).toEqual({ year: 2026, month: 9 });
    expect(meusPedidosCorrespondeMesAno(pedido, "9", "2026")).toBe(true);
    expect(meusPedidosCorrespondeMesAno(pedido, "10", "2026")).toBe(false);
  });

  test("cancelado com Data de Ativação usa Ativação, que tem prioridade", () => {
    const pedido = {
      status: "CANCELADO",
      dataAtivacao: "2026-10-03",
      dataPreenchimento: "2026-09-12",
    };

    expect(meusPedidosMesReferencia(pedido)).toEqual({ year: 2026, month: 10 });
    expect(meusPedidosCorrespondeMesAno(pedido, "10", "2026")).toBe(true);
    expect(meusPedidosCorrespondeMesAno(pedido, "9", "2026")).toBe(false);
  });

  test("SLA usa nomes operacionais e não expõe Sem SLA", () => {
    expect(SLA_FILTER_OPTIONS).toEqual([
      ["todos", "Todos os prazos"],
      ["verde", "No prazo"],
      ["laranja", "Atenção"],
      ["vermelho", "Fora do prazo"],
    ]);
  });

  test("funil mostra somente fluxo comercial ativo e respeita ordem", () => {
    expect(visibleCommercialFunnels([
      { id: "assinatura", nome: "Assinatura", ativo: true, participa_fluxo_comercial: true, ordem: 4 },
      { id: "suporte", nome: "Suporte", ativo: true, participa_fluxo_comercial: false, ordem: 5 },
      { id: "prospeccao", nome: "Prospecção", ativo: false, participa_fluxo_comercial: true, ordem: 1 },
      { id: "processos_bko", nome: "Processos BKO", ativo: true, participa_fluxo_comercial: true, ordem: 3 },
    ])).toEqual([
      ["todos", "Todos"],
      ["processos_bko", "Processos BKO"],
      ["assinatura", "Assinatura"],
    ]);
  });

  test("tabela de pedidos exibe quebra por tipo/produto, quantidade e datas operacionais", () => {
    const columns = pedidoTableColumns(false);
    expect(columns.includes("BKO")).toBe(false);
    expect(columns.includes("Etapa")).toBe(false);
    expect(columns.includes("Ciclo")).toBe(false);
    expect(columns.includes("Erro")).toBe(false);
    expect(columns.includes("Funil")).toBe(false);
    expect(columns.includes("Pedido")).toBe(false);
    expect(columns.includes("Status Comercial")).toBe(false);
    expect(columns.includes("Status")).toBe(true);
    expect(columns.includes("Biometria")).toBe(true);
    expect(columns.includes("Tipo Pedido")).toBe(true);
    expect(columns.includes("Tipo Produto")).toBe(true);
    expect(columns.includes("Qtd.")).toBe(true);
    expect(columns.includes("Valor")).toBe(true);
    expect(columns.includes("Recebimento")).toBe(true);
    expect(columns.includes("Aceite")).toBe(true);
    expect(columns.includes("Preenchimento")).toBe(true);
    expect(columns.includes("Envio")).toBe(true);
    expect(columns.includes("Ativação")).toBe(true);
    expect(columns.indexOf("Valor")).toBe(columns.indexOf("Ult. Alteração") - 1);
    expect(columns.slice(
      columns.indexOf("Recebimento"),
      columns.indexOf("Ativação") + 1,
    )).toEqual([
      "Recebimento",
      "Preenchimento",
      "Envio",
      "Aceite",
      "Ativação",
    ]);
  });

  test("portabilidade e entrega/instalação não são obrigatórias para concluir", () => {
    expect(missingRequiredCompletionDates({
      dataRecebimento: "2026-09-17",
      dataPreenchimento: "2026-09-17",
      dataAceite: "2026-09-17",
      dataInput: "2026-09-17",
      dataAtivacao: "2026-09-17",
      dataPortabilidade: null,
      dataEntrega: null,
    })).toEqual([]);
  });

  test("informa cada data obrigatória ausente", () => {
    expect(missingRequiredCompletionDates({
      dataRecebimento: "2026-09-17",
      dataPreenchimento: null,
      dataAceite: "2026-09-17",
      dataInput: "2026-09-17",
      dataAtivacao: "2026-09-17",
      dataPortabilidade: null,
      dataEntrega: null,
    })).toEqual(["Preenchimento"]);
  });
});
