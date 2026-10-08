export function supportsBiometria(operadora: string | null | undefined): boolean {
  return String(operadora ?? "").toUpperCase() === "CLARO";
}

/**
 * A biometria pertence exclusivamente à CLARO.
 * Quando a operadora ainda não está definida, a regra permanece fechada por segurança.
 */
export function isStageAllowedForOperadora(
  etapaId: string,
  operadora: string | null | undefined,
): boolean {
  return supportsBiometria(operadora) || etapaId !== "a-biometria";
}
