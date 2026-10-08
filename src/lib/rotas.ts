/** Função única para montar a rota da ficha do cliente. */
export function buildClientProfileUrl(clienteId: string) {
  return `/clientes/${clienteId}`;
}

/** Props tipadas para navegação/Link até a ficha do cliente. */
export function clientProfileNavOptions(clienteId: string) {
  return { to: "/clientes/$id" as const, params: { id: clienteId } };
}

/** Rota padronizada para detalhe do pedido. */
export function buildVendaDetailUrl(vendaId: string) {
  return { to: "/vendas/$id" as const, params: { id: vendaId } };
}
