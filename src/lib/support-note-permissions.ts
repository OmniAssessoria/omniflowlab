export function podeGerenciarNotaSuporte(
  role: string | null | undefined,
  userId: string | null | undefined,
  createdBy: string | null | undefined,
) {
  if (role === "admin" || role === "bko") return true;
  return role === "consultor" && Boolean(userId) && userId === createdBy;
}
