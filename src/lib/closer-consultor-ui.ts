export type CloserClientOption = {
  id: string;
  razao_social: string;
  cnpj: string;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  origem_lead: string | null;
};

function normalizeSearch(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function filterCloserClientOptions(
  clientes: CloserClientOption[],
  search: string,
) {
  const term = normalizeSearch(search);
  if (!term) return clientes;

  return clientes.filter((cliente) =>
    [
      cliente.razao_social,
      cliente.cnpj,
      cliente.contato,
      cliente.telefone,
      cliente.email,
    ].some((value) => normalizeSearch(value).includes(term)),
  );
}

export function buildCloserClientPayload(input: {
  closerId: string;
  closerNome: string | null;
  razaoSocial: string;
  cnpj: string;
  contato: string;
  telefone: string;
  email: string;
}) {
  return {
    closer_id: input.closerId,
    closer_nome: input.closerNome,
    razao_social: input.razaoSocial.trim(),
    cnpj: input.cnpj.trim(),
    contato: input.contato.trim(),
    telefone: input.telefone.trim(),
    email: input.email.trim().toLowerCase(),
    origem_lead: "CADASTRO MANUAL",
  };
}

export function usaFluxoGuiadoNovoPedido(role: string | null | undefined) {
  return role === "consultor"
    || role === "closer"
    || role === "admin"
    || role === "bko";
}

function normalizeOnvoxValue(value: string | null | undefined) {
  return String(value ?? "").trim().toLocaleUpperCase("pt-BR");
}

export function onvoxProdutosPermitidos(tipoPedido: string | null | undefined) {
  const tipo = normalizeOnvoxValue(tipoPedido);
  if (tipo === "NOVO") return ["DID", "RAMAIS", "0800", "APARELHO"];
  if (tipo === "PORTABILIDADE" || tipo === "TT" || tipo === "PORTABILIDADE PF") return ["DID"];
  return ["DID"];
}

export function onvoxDidUsaNumero(
  tipoPedido: string | null | undefined,
  produto: string | null | undefined,
) {
  if (normalizeOnvoxValue(produto) !== "DID") return false;
  const tipo = normalizeOnvoxValue(tipoPedido);
  return tipo === "PORTABILIDADE" || tipo === "PORTABILIDADE PF";
}

export function onvoxQuantidadePersistida(
  produto: string | null | undefined,
  quantidade: string | number | null | undefined,
  tipoPedido?: string | null,
) {
  const produtoNormalizado = normalizeOnvoxValue(produto);
  if (onvoxDidUsaNumero(tipoPedido, produto)) return 1;
  if (produtoNormalizado !== "RAMAIS" && produtoNormalizado !== "DID") return 1;
  const parsed = Number(quantidade ?? 1);
  return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : 1;
}

export function onvoxValorTotalLinha(
  produto: string | null | undefined,
  quantidade: string | number | null | undefined,
  valorUnitario: string | number | null | undefined,
  valor: string | number | null | undefined,
) {
  const produtoNormalizado = normalizeOnvoxValue(produto);
  if (produtoNormalizado === "RAMAIS" || produtoNormalizado === "DID") {
    const qty = onvoxQuantidadePersistida(produto, quantidade);
    const unit = Number(String(valorUnitario ?? "0").replace(",", "."));
    return Number.isFinite(unit) ? qty * unit : 0;
  }

  const parsed = Number(String(valor ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatBrlInput(value: string | number | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed)) return "";
  return `R$ ${parsed.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function parseBrlInput(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return (Number(digits) / 100).toFixed(2);
}

export function somenteDigitosOnvox(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

export function somenteDigitosTake(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

export function takeApiTipoValido(value: string | null | undefined) {
  return value === "API OFICIAL" || value === "API NÃO OFICIAL";
}


export function somarReceitaCloser(
  pedidos: Array<{ receita_total: number | string | null | undefined }>,
) {
  return pedidos.reduce((total, pedido) => {
    const value = Number(pedido.receita_total ?? 0);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}
