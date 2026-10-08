export const COMMISSIONS_FLAG = "commissions_enabled";

/** Retorna true se a flag estiver ativa (default: ativa quando não existe registro). */
export async function isModuleEnabled(supabase: any, chave: string, role?: string): Promise<boolean> {
  const { data } = await supabase.from("app_settings").select("valor").eq("chave", chave).maybeSingle();
  if (!data) return true;
  
  const config = data.valor;
  if (typeof config === "boolean") return config;
  
  if (config && typeof config === "object") {
    if (config.enabled === false) return false;
    if (role && Array.isArray(config.roles)) {
      return config.roles.includes(role);
    }
    return config.enabled !== false;
  }
  
  return config !== false;
}

export async function isAdminUser(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

/**
 * Verifica se o módulo está ativo e o usuário tem permissão de perfil.
 * Lança erro 403 se bloqueado.
 */
export async function ensureComissoesModule(supabase: any, userId: string) {
  // Busca o perfil principal do usuário
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  
  const role = roleRow?.role;

  if (!(await isModuleEnabled(supabase, COMMISSIONS_FLAG, role))) {
    const err = new Error("Você não tem acesso ao módulo de Comissões.");
    (err as any).status = 403;
    throw err;
  }
}
