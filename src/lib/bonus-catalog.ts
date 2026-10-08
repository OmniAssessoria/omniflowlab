export interface BonusCatalogOption {
  gb: number;
  ativo: boolean;
}

export function getSelectableBonusValues(
  items: BonusCatalogOption[],
  currentGb?: number | null,
): number[] {
  const values = new Set<number>();

  for (const item of items) {
    if (!item.ativo) continue;
    if (!Number.isInteger(item.gb) || item.gb <= 0) continue;
    values.add(item.gb);
  }

  if (Number.isInteger(currentGb) && Number(currentGb) > 0) {
    values.add(Number(currentGb));
  }

  return Array.from(values).sort((a, b) => a - b);
}
