export function bonusLinhaLabel(
  operadora?: string | null,
  _tipoProduto?: string | null,
  possuiBonus?: boolean | null,
  bonusGb?: number | null,
): string | null {
  if (operadora !== "VIVO" || !possuiBonus || !bonusGb) return null;
  return `Bônus ${bonusGb} GB`;
}
