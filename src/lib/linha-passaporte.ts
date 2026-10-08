import { normalizeLinhaLabel } from "@/lib/linha-campos-regras";

export const PASSAPORTE_VIVO_PRODUTOS = [
  "VIVO TRAVEL AMÉRICAS",
  "VIVO TRAVEL EUROPA",
  "VIVO TRAVEL MUNDO",
] as const;

export const PASSAPORTE_CLARO_PRODUTOS = [
  "CLARO PASSAPORTE AMÉRICAS",
  "CLARO PASSAPORTE EUROPA",
  "CLARO PASSAPORTE MUNDO TOTAL",
] as const;

const CLARO_TIPOS_COM_MOVEL = [
  "novo",
  "renovacao",
  "portado",
  "portabilidade cruzada pf/pj",
  "portabilidade pj/pj",
];

const VIVO_TIPOS_COM_PASSAPORTE_NO_MOVEL = [
  "migracao plano",
  "migracao pre",
  "migracao pos",
  "novo",
];

export function linhaPermitePassaporte({
  operadora,
  produto,
  tipoPedido,
}: {
  operadora: string | null | undefined;
  produto: string | null | undefined;
  tipoPedido: string | null | undefined;
}) {
  const op = normalizeLinhaLabel(operadora);
  const prod = normalizeLinhaLabel(produto);
  const pedido = normalizeLinhaLabel(tipoPedido);

  if (op === "vivo") {
    return (
      (prod === "movel" && VIVO_TIPOS_COM_PASSAPORTE_NO_MOVEL.includes(pedido))
      || (prod === "passaporte" && pedido === "sva")
    );
  }

  if (op === "claro") {
    return (
      (prod === "movel" && CLARO_TIPOS_COM_MOVEL.includes(pedido))
      || (prod === "passaporte" && ["novo", "sva"].includes(pedido))
    );
  }

  return false;
}

export function isProdutoPassaporteVivo(nome: string | null | undefined) {
  const value = normalizeLinhaLabel(nome);
  return PASSAPORTE_VIVO_PRODUTOS.some(item => normalizeLinhaLabel(item) === value)
    || value.startsWith("vivo travel")
    || value.startsWith("vivo passaporte");
}

export function isProdutoPassaporteClaro(nome: string | null | undefined) {
  const value = normalizeLinhaLabel(nome);
  return PASSAPORTE_CLARO_PRODUTOS.some(item => normalizeLinhaLabel(item) === value)
    || value.startsWith("claro passaporte");
}

export function isProdutoPassaporteAdicional(nome: string | null | undefined) {
  return isProdutoPassaporteVivo(nome) || isProdutoPassaporteClaro(nome);
}
