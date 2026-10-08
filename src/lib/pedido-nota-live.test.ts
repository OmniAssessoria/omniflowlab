import { describe, expect, test } from "bun:test";
import { formatPedidoNotaText, type PedidoNotaLive } from "./pedido-nota-live";

const baseModel: PedidoNotaLive = {
  id: "venda-1",
  numero: "1-979544952815",
  operadora: "VIVO",
  funil: "Assinatura",
  etapa: "Contrato Assinado",
  status: "Aguardando Aceite",
  statusComercial: "AGUARDANDO ENTREGA",
  statusPedido: "—",
  statusPedidoObs: "",
  consultor: "Leticia Ohara",
  bko: "Não atribuído",
  mesRef: 10,
  anoRef: 2026,
  cliente: {
    razaoSocial: "VIMAFRE VITORIA CORRETORA DE SEGUROS LTDA",
    cnpjCpf: "20.019.941/0001-84",
    contato: "VITORIA MARCELA FIGUEIREDO JABUR JUNQUEIRA",
    telefone: "982339491",
    email: "vitoriaj@vimafre.com.br",
    uf: "SP",
    ddd: "16",
    observacao: "",
  },
  linhas: [
    {
      id: "linha-1",
      ordem: 1,
      ddd: "16",
      numero: "992288080",
      iccid: "",
      produto: "MÓVEL",
      tipoProduto: "PORTABILIDADE PF/PJ",
      plano: "20GB",
      status: "Ativa",
      dataAtivacao: null,
      valorMensal: 59.99,
      observacao: "",
      bonusPlano: "BÔNUS +10GB",
      possuiBonus: true,
      bonusGb: 10,
      doadores: [],
    },
    {
      id: "linha-2",
      ordem: 2,
      ddd: "16",
      numero: "999999999",
      iccid: "",
      produto: "FIXA",
      tipoProduto: "NOVO",
      plano: "100 MEGA",
      status: "Ativa",
      dataAtivacao: null,
      valorMensal: 100,
      observacao: "",
      bonusPlano: "",
      possuiBonus: false,
      bonusGb: null,
      doadores: [],
    },
  ],
  quantidadeLinhas: 2,
  valorLinhas: 159.99,
  valorPedido: 159.99,
  operacao: {
    sla: "Ok",
    prioridade: "Media",
    biometria: null,
    portabilidade: "—",
    proximaAcao: "Pendente Consultor",
    proximaAcaoData: null,
    viabilidadeFixa: "—",
    cotacao: "—",
    notaFiscal: "—",
    codigoRastreio: "—",
    equipamentos: "—",
    observacao: "",
    temErro: false,
    concluidoEm: null,
    ativado100Em: null,
  },
  datas: {
    recebimento: null,
    preenchimento: null,
    envio: null,
    aceite: null,
    input: null,
    ativacao: null,
    portabilidade: null,
    entrega: null,
    atualizadoEm: null,
    ultimaAlteracaoPor: "Sistema",
  },
  observacoes: [],
  documentos: [],
};

describe("Nota do Pedido - formato enxuto", () => {
  test("lista todos os tipos e produtos e remove blocos operacionais antigos", () => {
    const nota = formatPedidoNotaText(baseModel);

    expect(nota).toContain("Tipos de pedido: PORTABILIDADE PF/PJ | NOVO");
    expect(nota).toContain("Produtos: MÓVEL | FIXA");
    expect(nota).toContain("Operadora: VIVO");
    expect(nota).toContain("DDD: SP / 16");
    expect(nota).toContain("LINHAS");
    expect(nota).toContain("20GB · BÔNUS +10GB · R$ 59,99");
    expect(nota).not.toContain("BÔNUS +10GB · Bônus 10 GB");
    expect(nota).toContain("Valor registrado no pedido: R$ 159,99");

    expect(nota).not.toContain("IDENTIFICAÇÃO");
    expect(nota).not.toContain("OPERAÇÃO");
    expect(nota).not.toContain("DATAS DO PEDIDO");
    expect(nota).not.toContain("OBSERVAÇÕES RECENTES");
    expect(nota).not.toContain("DOCUMENTOS ATIVOS");
    expect(nota).not.toContain("Valor mensal das linhas");
  });
});
