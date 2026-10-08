export function getCnpjDigits(value: string): string {
  // Mantido por compatibilidade com imports antigos. O campo de CNPJ agora é livre
  // e pode conter letras, números e pontuação.
  return value.trim();
}

export function formatCnpjInput(value: string): string {
  // Não aplica máscara nem limita quantidade de caracteres.
  return value;
}

export function isCompleteCnpj(value: string): boolean {
  // CNPJ deixou de ser validado por quantidade fixa de dígitos.
  return value.trim().length > 0;
}
