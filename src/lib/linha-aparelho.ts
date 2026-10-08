export type LinhaBusinessField =
  | "nome_aparelho"
  | "ddd"
  | "numero"
  | "produto"
  | "tipo_produto"
  | "plano"
  | "valor";

function normalizeTipoProduto(value?: string | null): string {
  return (value ?? "").trim().toLocaleLowerCase("pt-BR");
}

export function isTipoProdutoAparelho(value?: string | null): boolean {
  return ["aparelho", "aparelhos"].includes(normalizeTipoProduto(value));
}

export function linhaBusinessFields(value?: string | null): LinhaBusinessField[] {
  if (isTipoProdutoAparelho(value)) {
    return ["nome_aparelho", "produto", "tipo_produto", "valor"];
  }
  return ["ddd", "numero", "produto", "tipo_produto", "plano", "valor"];
}
