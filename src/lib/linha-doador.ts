export function hasDoador(doador: unknown): boolean {
  return Boolean(doador);
}

export function doadorLinhaLabel(
  doador: { nome_completo?: string | null } | null | undefined,
): string | null {
  return doador ? "Doador" : null;
}
