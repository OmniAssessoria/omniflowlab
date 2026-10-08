const TIPOS_PEDIDO_COM_CEDENTE = new Set([
  "MIGRACAO PRE",
  "MIGRACAO POS",
  "MIGRACAO PLANO",
  "TRANSFERENCIA DE TITULARIDADE PF/PJ POS",
  "TRANSFERENCIA DE TITULARIDADE PF/PJ PRE",
  "TRANSFERENCIA DE TITULARIDADE PJ/PJ",
  "PORTABILIDADE CRUZADA PF/PJ",
  "PORTABILIDADE PF/PJ",
  "PORTABILIDADE PJ/PJ",
]);

export function normalizarTipoPedidoParaRegra(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function tipoPedidoExigeCedente(value: string | string[] | null | undefined) {
  const values = Array.isArray(value) ? value : [value];
  return values.some(item => TIPOS_PEDIDO_COM_CEDENTE.has(normalizarTipoPedidoParaRegra(item)));
}

export const TIPOS_PEDIDO_CEDENTE_LABELS = [
  "Migração Pré",
  "Migração Pós",
  "Migração Plano",
  "Transferência de Titularidade PF/PJ Pós",
  "Transferência de Titularidade PF/PJ Pré",
  "Transferência de Titularidade PJ/PJ",
  "Portabilidade Cruzada PF/PJ",
  "Portabilidade PF/PJ",
  "Portabilidade PJ/PJ",
] as const;


const TIPOS_PEDIDO_CEDENTE_SOMENTE_CPF = new Set([
  "MIGRACAO PRE",
  "MIGRACAO POS",
  "PORTABILIDADE PF/PJ",
]);

export function tipoPedidoCedenteSomenteCpf(value: string | string[] | null | undefined) {
  const values = (Array.isArray(value) ? value : [value])
    .map(normalizarTipoPedidoParaRegra)
    .filter(item => TIPOS_PEDIDO_COM_CEDENTE.has(item));

  return values.length > 0
    && values.every(item => TIPOS_PEDIDO_CEDENTE_SOMENTE_CPF.has(item));
}

const TIPOS_PEDIDO_CEDENTE_COM_RAZAO_SOCIAL = new Set([
  "TRANSFERENCIA DE TITULARIDADE PJ/PJ",
  "PORTABILIDADE PJ/PJ",
]);

export function tipoPedidoCedenteExigeRazaoSocial(value: string | string[] | null | undefined) {
  const values = Array.isArray(value) ? value : [value];
  return values.some(item => TIPOS_PEDIDO_CEDENTE_COM_RAZAO_SOCIAL.has(normalizarTipoPedidoParaRegra(item)));
}
