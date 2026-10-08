export type CedentePessoaTipo = "PF" | "PJ";

export type CedenteCadastroInput = {
  tipoPessoa: CedentePessoaTipo;
  documento: string;
  razaoSocial: string;
  nome: string;
  email: string;
  telefone: string;
};

function digits(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

export function cedenteTipoPorDocumento(documento: string | null | undefined): CedentePessoaTipo {
  return digits(documento).length === 11 ? "PF" : "PJ";
}

export function validarCedenteCadastro(input: CedenteCadastroInput): string | null {
  const documento = digits(input.documento);
  const nome = input.nome.trim();
  const email = input.email.trim();
  const telefone = digits(input.telefone);

  if (input.tipoPessoa === "PF") {
    if (documento.length !== 11) return "Informe um CPF com 11 dígitos.";
    if (nome.length < 2) return "Informe o Nome Completo do Cedente.";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Informe um e-mail válido para o Cedente.";
    if (telefone.length < 10 || telefone.length > 11) return "Informe um telefone de contato válido.";
    return null;
  }

  if (documento.length !== 14) return "Informe um CNPJ com 14 dígitos.";
  if (!input.razaoSocial.trim()) return "Informe a Razão Social do Cedente.";
  if (nome.length < 2) return "Informe o Nome do Cedente.";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Informe um e-mail válido para o Cedente.";
  return null;
}

export function montarPayloadCedente(input: CedenteCadastroInput) {
  const tipoPessoa = input.tipoPessoa;
  return {
    cnpj_cpf: digits(input.documento),
    razao_social: tipoPessoa === "PJ" ? input.razaoSocial.trim() : null,
    nome: input.nome.trim(),
    email: input.email.trim(),
    telefone: tipoPessoa === "PF" ? digits(input.telefone) : null,
  };
}
