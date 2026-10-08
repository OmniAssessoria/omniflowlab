export const LINHA_NAO_INFORMADO = "Não informado";

export function normalizeLinhaLabel(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (["chip de dados", "chip de cados"].includes(normalized)) return "chip dados";
  if (normalized === "microsoft 265") return "microsoft 365";
  return normalized;
}

type LinhaFieldProfile = {
  ddd: boolean;
  numero: boolean;
  plano: boolean;
  valor: boolean;
  valorSomenteExtra?: boolean;
  descricaoAdicional?: boolean;
};

const CLARO_PRODUTOS_POR_TIPO = new Map<string, string[]>([
  ["novo", ["Móvel", "Fixa", "Banda Larga", "Chip Dados", "Pacote de Dados", "M2M", "TV", "Aparelho", "Passaporte"]],
  ["renovacao", ["Móvel", "Aparelho"]],
  ["portado", ["Fixa", "Móvel", "SVA"]],
  ["portabilidade cruzada pf/pj", ["Móvel", "Aparelho"]],
  ["portabilidade pj/pj", ["Móvel", "Aparelho"]],
  ["transferencia de titularidade pf/pj pos", ["Móvel", "Aparelho"]],
  ["transferencia de titularidade pf/pj pre", ["Móvel", "Aparelho"]],
  ["transferencia de titularidade pj/pj", ["Móvel"]],
  ["sva", ["Aparelho", "Passaporte"]],
]);

const VIVO_PRODUTOS_POR_TIPO = new Map<string, string[]>([
  ["migracao plano", ["Móvel"]],
  ["migracao pre", ["Móvel"]],
  ["migracao pos", ["Móvel"]],
  ["novo", [
    "Móvel",
    "SIP",
    "Microsoft 365",
    "Link Dedicado",
    "Chip Dados",
    "Banda Larga",
    "Aluguel de Equipamentos",
    "TV",
    "VVN",
    "PABX",
    "M2M",
    "LDI",
    "IP Fixo",
    "Fixa",
    "Aparelho",
  ]],
  ["portabilidade pf/pj", ["Móvel"]],
  ["portabilidade pj/pj", ["Móvel"]],
  ["portado", ["SIP", "Móvel"]],
  ["sva", ["Aparelho", "Passaporte", "Microsoft 365"]],
]);

function claroFieldProfile(tipoPedido: string, produto: string): LinhaFieldProfile | null {
  const pedido = normalizeLinhaLabel(tipoPedido);
  const prod = normalizeLinhaLabel(produto);

  if (prod === "movel" && pedido === "transferencia de titularidade pj/pj") {
    return { ddd: true, numero: true, plano: false, valor: false };
  }

  if (
    prod === "movel"
    && [
      "novo",
      "renovacao",
      "portado",
      "portabilidade cruzada pf/pj",
      "portabilidade pj/pj",
      "transferencia de titularidade pf/pj pos",
      "transferencia de titularidade pf/pj pre",
    ].includes(pedido)
  ) {
    return { ddd: true, numero: pedido !== "novo", plano: true, valor: true };
  }

  if (prod === "fixa" && pedido === "novo") {
    return { ddd: true, numero: false, plano: false, valor: true };
  }

  if (prod === "fixa" && pedido === "portado") {
    return { ddd: true, numero: true, plano: false, valor: true };
  }

  if (prod === "banda larga" && pedido === "novo") {
    return { ddd: false, numero: false, plano: true, valor: true };
  }

  if (prod === "m2m" && pedido === "novo") {
    return { ddd: true, numero: false, plano: true, valor: true };
  }

  if (prod === "tv" && pedido === "novo") {
    return { ddd: false, numero: false, plano: true, valor: true };
  }

  if (prod === "chip dados" && pedido === "novo") {
    return { ddd: true, numero: false, plano: true, valor: true };
  }

  if (prod === "pacote de dados" && pedido === "novo") {
    return { ddd: false, numero: false, plano: true, valor: true };
  }

  if (prod === "sva" && pedido === "portado") {
    return { ddd: false, numero: false, plano: false, valor: false };
  }

  if (prod === "passaporte" && ["novo", "sva"].includes(pedido)) {
    return { ddd: false, numero: false, plano: false, valor: false };
  }

  if (
    prod === "aparelho"
    && [
      "novo",
      "sva",
      "renovacao",
      "portabilidade cruzada pf/pj",
      "portabilidade pj/pj",
      "transferencia de titularidade pf/pj pos",
      "transferencia de titularidade pf/pj pre",
    ].includes(pedido)
  ) {
    return {
      ddd: false,
      numero: false,
      plano: true,
      valor: true,
    };
  }

  return null;
}

function vivoFieldProfile(tipoPedido: string, produto: string): LinhaFieldProfile | null {
  const pedido = normalizeLinhaLabel(tipoPedido);
  const prod = normalizeLinhaLabel(produto);

  if (
    prod === "movel"
    && [
      "migracao plano",
      "migracao pre",
      "migracao pos",
      "novo",
      "portabilidade pf/pj",
      "portabilidade pj/pj",
      "portado",
    ].includes(pedido)
  ) {
    return { ddd: true, numero: pedido !== "novo", plano: true, valor: true };
  }

  if (prod === "sip" && ["novo", "portado"].includes(pedido)) {
    return { ddd: true, numero: true, plano: false, valor: true };
  }

  if (prod === "microsoft 365" && pedido === "novo") {
    return { ddd: false, numero: false, plano: false, valor: true };
  }

  if (prod === "microsoft 365" && pedido === "sva") {
    return { ddd: false, numero: false, plano: false, valor: true, descricaoAdicional: true };
  }

  if (prod === "link dedicado" && pedido === "novo") {
    return { ddd: false, numero: false, plano: false, valor: true };
  }

  if (prod === "chip dados" && pedido === "novo") {
    return { ddd: true, numero: false, plano: true, valor: true };
  }

  if (prod === "banda larga" && pedido === "novo") {
    return { ddd: false, numero: false, plano: true, valor: true };
  }

  if (prod === "aluguel de equipamentos" && pedido === "novo") {
    return { ddd: false, numero: false, plano: false, valor: true, descricaoAdicional: true };
  }

  if (prod === "tv" && pedido === "novo") {
    return { ddd: false, numero: false, plano: true, valor: true };
  }

  if (prod === "vvn" && pedido === "novo") {
    return { ddd: false, numero: false, plano: false, valor: true, descricaoAdicional: true };
  }

  if (prod === "pabx" && pedido === "novo") {
    return { ddd: false, numero: false, plano: false, valor: true, descricaoAdicional: true };
  }

  if (prod === "m2m" && pedido === "novo") {
    return { ddd: true, numero: true, plano: true, valor: true };
  }

  if (prod === "ldi" && pedido === "novo") {
    return { ddd: false, numero: false, plano: false, valor: true, descricaoAdicional: true };
  }

  if (prod === "ip fixo" && pedido === "novo") {
    return { ddd: false, numero: false, plano: false, valor: true, descricaoAdicional: true };
  }

  if (prod === "fixa" && pedido === "novo") {
    return { ddd: true, numero: false, plano: false, valor: true };
  }

  if (prod === "aparelho" && ["novo", "sva"].includes(pedido)) {
    return {
      ddd: false,
      numero: false,
      plano: true,
      valor: true,
    };
  }

  if (prod === "passaporte" && pedido === "sva") {
    return { ddd: false, numero: false, plano: false, valor: false };
  }

  return null;
}

function produtosPermitidos(
  mapa: Map<string, string[]>,
  tipoPedido: string | null | undefined,
): string[] | null {
  const pedido = normalizeLinhaLabel(tipoPedido);
  if (!pedido || pedido === normalizeLinhaLabel(LINHA_NAO_INFORMADO)) return null;
  return mapa.get(pedido) ?? [];
}

function permiteProduto(
  mapa: Map<string, string[]>,
  tipoPedido: string | null | undefined,
  produto: string | null | undefined,
): boolean {
  if (!produto || normalizeLinhaLabel(produto) === normalizeLinhaLabel(LINHA_NAO_INFORMADO)) return true;
  const permitidos = produtosPermitidos(mapa, tipoPedido);
  if (permitidos === null) return true;
  const prod = normalizeLinhaLabel(produto);
  return permitidos.some(item => normalizeLinhaLabel(item) === prod);
}

export function produtosClaroPermitidos(tipoPedido: string | null | undefined) {
  return produtosPermitidos(CLARO_PRODUTOS_POR_TIPO, tipoPedido);
}

export function produtosVivoPermitidos(tipoPedido: string | null | undefined) {
  return produtosPermitidos(VIVO_PRODUTOS_POR_TIPO, tipoPedido);
}

export function claroPermiteProduto(
  tipoPedido: string | null | undefined,
  produto: string | null | undefined,
) {
  return permiteProduto(CLARO_PRODUTOS_POR_TIPO, tipoPedido, produto);
}

export function vivoPermiteProduto(
  tipoPedido: string | null | undefined,
  produto: string | null | undefined,
) {
  return permiteProduto(VIVO_PRODUTOS_POR_TIPO, tipoPedido, produto);
}

export function operadoraPermiteProduto(
  operadora: string | null | undefined,
  tipoPedido: string | null | undefined,
  produto: string | null | undefined,
) {
  const op = normalizeLinhaLabel(operadora);
  if (op === "claro") return claroPermiteProduto(tipoPedido, produto);
  if (op === "vivo") return vivoPermiteProduto(tipoPedido, produto);
  return true;
}

export function tipoPedidoPossuiMovel(
  operadora: string | null | undefined,
  tipoPedido: string | null | undefined,
) {
  const op = normalizeLinhaLabel(operadora);
  const permitidos = op === "claro"
    ? produtosClaroPermitidos(tipoPedido)
    : op === "vivo"
      ? produtosVivoPermitidos(tipoPedido)
      : null;

  return Boolean(permitidos?.some(item => normalizeLinhaLabel(item) === "movel"));
}

export function linhaDescricaoAdicionalLabel({
  operadora,
  produto,
  tipoPedido,
}: {
  operadora: string | null | undefined;
  produto: string | null | undefined;
  tipoPedido: string | null | undefined;
}): string | null {
  if (normalizeLinhaLabel(operadora) !== "vivo") return null;
  const profile = vivoFieldProfile(tipoPedido ?? "", produto ?? "");
  if (!profile?.descricaoAdicional) return null;

  const prod = normalizeLinhaLabel(produto);
  if (prod === "aluguel de equipamentos") return "Descrição do equipamento";
  if (prod === "microsoft 365") return "Descrição Microsoft 365";
  if (prod === "vvn") return "Descrição VVN";
  if (prod === "pabx") return "Descrição PABX";
  if (prod === "ldi") return "Descrição LDI";
  if (prod === "ip fixo") return "Descrição IP Fixo";
  return "Descrição";
}

export function linhaPermiteOperadoraDoadora({
  operadora,
  tipoPedido,
}: {
  operadora: string | null | undefined;
  tipoPedido: string | null | undefined;
}) {
  const op = normalizeLinhaLabel(operadora);
  const pedido = normalizeLinhaLabel(tipoPedido);

  if (
    op === "claro"
    && [
      "transferencia de titularidade pf/pj pos",
      "transferencia de titularidade pf/pj pre",
      "transferencia de titularidade pj/pj",
    ].includes(pedido)
  ) {
    return false;
  }

  if (op === "vivo" && ["migracao pre", "migracao pos"].includes(pedido)) {
    return false;
  }

  return true;
}

export type LinhaCampoRules = {
  produtoFixa: boolean;
  produtoMovel: boolean;
  produtoBandaLarga: boolean;
  produtoAparelho: boolean;
  produtoPassaporte: boolean;
  pedidoNovo: boolean;
  pedidoPortado: boolean;
  bloqueiaDdd: boolean;
  bloqueiaNumero: boolean;
  bloqueiaPlano: boolean;
  bloqueiaValor: boolean;
  valorSomenteExtra: boolean;
  descricaoAdicional: boolean;
  valorPadrao: number | null;
};

export function getLinhaCampoRules({
  operadora,
  produto,
  tipoPedido,
}: {
  operadora: string | null | undefined;
  produto: string | null | undefined;
  tipoPedido: string | null | undefined;
}): LinhaCampoRules {
  const op = normalizeLinhaLabel(operadora);
  const prod = normalizeLinhaLabel(produto);
  const pedido = normalizeLinhaLabel(tipoPedido);

  const produtoFixa = prod === "fixa";
  const produtoMovel = prod === "movel";
  const produtoBandaLarga = prod === "banda larga";
  const produtoAparelho = prod === "aparelho" || prod === "aparelhos";
  const produtoPassaporte = prod === "passaporte";
  const pedidoNovo = pedido === "novo";
  const pedidoPortado = pedido === "portado";

  const profile = op === "claro"
    ? claroFieldProfile(tipoPedido ?? "", produto ?? "")
    : op === "vivo"
      ? vivoFieldProfile(tipoPedido ?? "", produto ?? "")
      : null;

  if (profile) {
    return {
      produtoFixa,
      produtoMovel,
      produtoBandaLarga,
      produtoAparelho,
      produtoPassaporte,
      pedidoNovo,
      pedidoPortado,
      bloqueiaDdd: !profile.ddd,
      bloqueiaNumero: !profile.numero,
      bloqueiaPlano: !profile.plano,
      bloqueiaValor: !profile.valor,
      valorSomenteExtra: Boolean(profile.valorSomenteExtra),
      descricaoAdicional: Boolean(profile.descricaoAdicional),
      valorPadrao: null,
    };
  }

  return {
    produtoFixa,
    produtoMovel,
    produtoBandaLarga,
    produtoAparelho,
    produtoPassaporte,
    pedidoNovo,
    pedidoPortado,
    bloqueiaDdd: produtoBandaLarga,
    bloqueiaNumero: produtoBandaLarga || (pedidoNovo && (produtoFixa || produtoMovel)),
    bloqueiaPlano: produtoFixa && (pedidoNovo || pedidoPortado),
    bloqueiaValor: false,
    valorSomenteExtra: false,
    descricaoAdicional: false,
    valorPadrao: null,
  };
}

export function linhaRulePatch(
  rules: LinhaCampoRules,
  currentValue?: number | null,
  opts?: { applyDefaultValue?: boolean },
) {
  return {
    ...(rules.bloqueiaDdd ? { ddd: null } : {}),
    ...(rules.bloqueiaNumero ? { numero: null } : {}),
    ...(rules.bloqueiaPlano
      ? {
          plano: LINHA_NAO_INFORMADO,
          plano_catalogo_id: null,
          plano_oferta_id: null,
        }
      : {}),
    ...(rules.bloqueiaValor ? { valor_mensal: 0 } : {}),
    ...(opts?.applyDefaultValue && rules.valorPadrao != null && Number(currentValue ?? 0) === 0
      ? { valor_mensal: rules.valorPadrao }
      : {}),
  };
}
