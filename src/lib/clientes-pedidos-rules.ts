export type FilterOption = [string, string];

export function pedidoProdutoVisivelEmMeusPedidos(produto: string | null | undefined) {
  const normalizado = String(produto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  return normalizado !== "APARELHO";
}

export type PedidoStatusTimelineEvent = {
  nome?: string | null;
  createdAt?: string | null;
  origem: "manual" | "robo";
  label?: string | null;
  slaHoras?: number | null;
  slaInicioEm?: string | null;
};

export function pedidoStatusMaisRecente(
  manual: PedidoStatusTimelineEvent | null | undefined,
  robo: PedidoStatusTimelineEvent | null | undefined,
  statusPedido: PedidoStatusTimelineEvent | null | undefined = null,
) {
  const eventos = [manual, robo, statusPedido].filter(
    (item): item is PedidoStatusTimelineEvent => Boolean(item?.nome),
  );
  if (eventos.length === 0) return null;

  return eventos.reduce((maisRecente, atual) => {
    const tempoAtual = atual.createdAt
      ? new Date(atual.createdAt).getTime()
      : Number.NEGATIVE_INFINITY;
    const tempoMaisRecente = maisRecente.createdAt
      ? new Date(maisRecente.createdAt).getTime()
      : Number.NEGATIVE_INFINITY;

    // Em empate, a fonte acrescentada por último prevalece. Isso faz o
    // status_pedido real da venda vencer o log duplicado do mesmo evento.
    return Number.isFinite(tempoAtual) && tempoAtual >= tempoMaisRecente
      ? atual
      : maisRecente;
  });
}

export type MeusPedidosMesLike = {
  status?: string | null;
  dataAtivacao?: string | null;
  dataPreenchimento?: string | null;
};

function normalizeMonthStatus(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(MV|FB|AVA)\s*-\s*/, "")
    .trim();
}

function isStatusCancelado(value: string | null | undefined) {
  const status = normalizeMonthStatus(value);
  return status === "CANCELADO"
    || status.startsWith("TROCA NEGADO CANCELADO");
}

function parseIsoDateParts(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
  };
}

function mesReferenciaDireta(value: string | null | undefined) {
  const data = parseIsoDateParts(value);
  return data ? { year: data.year, month: data.month } : null;
}

export function meusPedidosMesReferencia(pedido: MeusPedidosMesLike) {
  // Regra principal e independente de status:
  // se existe Data de Ativação, ela define integralmente a competência.
  const ativacao = mesReferenciaDireta(pedido.dataAtivacao);
  if (ativacao) return ativacao;

  // Única exceção para pedidos sem ativação:
  // cancelados não ficam no mês atual; usam a Data de Preenchimento.
  if (isStatusCancelado(pedido.status)) {
    return mesReferenciaDireta(pedido.dataPreenchimento);
  }

  // Todos os demais pedidos sem ativação continuam abertos no mês atual.
  return null;
}

function correspondeReferencia(
  referencia: { year: number; month: number },
  mes: string,
  ano: string,
) {
  if (ano !== "todos" && referencia.year !== Number(ano)) return false;
  if (mes !== "todos" && referencia.month !== Number(mes)) return false;
  return true;
}

function filtroApontaParaMesAtual(mes: string, ano: string, hoje: Date) {
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  if (mes !== "todos" && Number(mes) !== mesAtual) return false;
  if (ano !== "todos" && Number(ano) !== anoAtual) return false;
  return true;
}

export function meusPedidosCorrespondeMesAno(
  pedido: MeusPedidosMesLike,
  mes: string,
  ano: string,
  hoje = new Date(),
) {
  if (mes === "todos" && ano === "todos") return true;

  const referencia = meusPedidosMesReferencia(pedido);
  if (referencia) {
    return correspondeReferencia(referencia, mes, ano);
  }

  // Sem Data de Ativação e não cancelado: permanece no mês atual.
  if (!isStatusCancelado(pedido.status) && filtroApontaParaMesAtual(mes, ano, hoje)) {
    return true;
  }

  return false;
}

function normalizeStatusFilterKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR");
}

export function statusFiltroSelecionadosDisponiveis(
  available: string[],
  selected: string[],
  manual: boolean,
) {
  if (!manual) return [...available];

  const selectedKeys = new Set(selected.map(normalizeStatusFilterKey));
  return available.filter(option => selectedKeys.has(normalizeStatusFilterKey(option)));
}

export function statusFiltroCorresponde(
  status: string | null | undefined,
  selected: string[],
  manual: boolean,
) {
  if (!manual) return true;
  if (!status) return false;

  const key = normalizeStatusFilterKey(status);
  return selected.some(option => normalizeStatusFilterKey(option) === key);
}

export const SLA_FILTER_OPTIONS: FilterOption[] = [
  ["todos", "Todos os prazos"],
  ["verde", "No prazo"],
  ["laranja", "Atenção"],
  ["vermelho", "Fora do prazo"],
];

export type PipelineFunilLike = {
  id: string;
  nome: string;
  ativo: boolean;
  participa_fluxo_comercial: boolean;
  ordem: number;
};

export function visibleCommercialFunnels(funis: PipelineFunilLike[]): FilterOption[] {
  return [
    ["todos", "Todos"],
    ...funis
      .filter(funil => funil.ativo && funil.participa_fluxo_comercial)
      .sort((a, b) => a.ordem - b.ordem)
      .map(funil => [funil.id, funil.nome] as FilterOption),
  ];
}

export function pedidoTableColumns(_comissoesVisible: boolean): string[] {
  return [
    "SLA",
    "Cliente",
    "CNPJ/CPF",
    "Op.",
    "Status",
    "Consultor",
    "Biometria",
    "Tipo Pedido",
    "Tipo Produto",
    "Qtd.",
    "Valor",
    "Ult. Alteração",
    "Recebimento",
    "Preenchimento",
    "Envio",
    "Aceite",
    "Ativação",
    "Ações",
  ];
}

export type CompletionDateVenda = {
  dataRecebimento?: string | null;
  dataPreenchimento?: string | null;
  dataAceite?: string | null;
  dataInput?: string | null;
  dataAtivacao?: string | null;
  dataPortabilidade?: string | null;
  dataEntrega?: string | null;
};

// Regra global de conclusão, válida para pedidos antigos e novos.
// Portabilidade e Entrega/Instalação são opcionais.
const REQUIRED_COMPLETION_DATES = [
  ["dataRecebimento", "Recebimento"],
  ["dataPreenchimento", "Preenchimento"],
  ["dataAceite", "Aceite"],
  ["dataInput", "Input"],
  ["dataAtivacao", "Ativação"],
] as const;

export function missingRequiredCompletionDates(venda: CompletionDateVenda): string[] {
  return REQUIRED_COMPLETION_DATES
    .filter(([key]) => !venda[key])
    .map(([, label]) => label);
}
