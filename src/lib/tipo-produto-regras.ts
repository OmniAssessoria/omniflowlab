export interface TipoProdutoRegra {
  operadora?: string | null;
  permite_bonus?: boolean | null;
  permite_doador?: boolean | null;
}

export function podeAdicionarBonusTipoProduto(
  regra?: TipoProdutoRegra | null,
): boolean {
  return regra?.operadora === "VIVO" && regra?.permite_bonus === true;
}

export function podeAdicionarDoadorTipoProduto(
  regra?: TipoProdutoRegra | null,
): boolean {
  return regra?.permite_doador === true;
}

export function deveExibirBonusTipoProduto(
  regra: TipoProdutoRegra | null | undefined,
  possuiBonus?: boolean | null,
  bonusGb?: number | null,
): boolean {
  return podeAdicionarBonusTipoProduto(regra) || (possuiBonus === true && Number(bonusGb) > 0);
}

export function deveExibirDoadorTipoProduto(
  regra: TipoProdutoRegra | null | undefined,
  temDoador: boolean,
): boolean {
  return podeAdicionarDoadorTipoProduto(regra) || temDoador;
}
