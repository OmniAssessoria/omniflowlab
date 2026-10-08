import { normalizedDisplayKey } from "@/lib/display-normalization";

export function usesScopedTipoProdutoRename(table: string): boolean {
  return table === "tipos_pedido_catalogo";
}

export function produtoExigeEndereco(produtos: Array<string | null | undefined>): boolean {
  return produtos.some(produto => {
    const key = normalizedDisplayKey(produto);
    return key === "FIXA" || key === "BANDA LARGA";
  });
}
