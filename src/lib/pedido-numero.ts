export const NUMERO_PEDIDO_NAO_INFORMADO_OMN = "OMN-Não informado";
export const NUMERO_PEDIDO_NAO_INFORMADO_VND = "VND-Não informado";

export function formatNumeroPedido(
  numero: string | null | undefined,
  createdBy?: string | null,
) {
  const atual = String(numero ?? "").trim();
  if (atual) return atual;
  return createdBy ? NUMERO_PEDIDO_NAO_INFORMADO_OMN : NUMERO_PEDIDO_NAO_INFORMADO_VND;
}

export function isNumeroPedidoNaoInformado(value: string | null | undefined) {
  const atual = String(value ?? "").trim();
  return atual === NUMERO_PEDIDO_NAO_INFORMADO_OMN
    || atual === NUMERO_PEDIDO_NAO_INFORMADO_VND;
}

export function numeroPedidoPersistido(value: string | null | undefined) {
  const atual = String(value ?? "").trim();
  if (!atual || isNumeroPedidoNaoInformado(atual)) return null;
  return atual;
}
