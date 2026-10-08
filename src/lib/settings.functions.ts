import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COMMISSIONS_FLAG, isAdminUser, isModuleEnabled } from "./module-flags";

export const getComissoesEnabled = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return { enabled: await isModuleEnabled(context.supabase, COMMISSIONS_FLAG) };
  });

export const setComissoesEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { enabled: boolean; roles?: string[] }) => d)
  .handler(async ({ data, context }) => {
    if (!(await isAdminUser(context.supabase, context.userId))) throw new Error("Forbidden");

    const { data: currentSetting } = await context.supabase
      .from("app_settings")
      .select("valor")
      .eq("chave", COMMISSIONS_FLAG)
      .maybeSingle();

    const anterior = (currentSetting?.valor as any) || { enabled: true, roles: [] as string[] };
    const valorNovo = { enabled: data.enabled, roles: data.roles || [] };

    const { error } = await (context.supabase.from("app_settings") as any).upsert(
      { chave: COMMISSIONS_FLAG, valor: valorNovo, updated_by: context.userId, updated_at: new Date().toISOString() },
      { onConflict: "chave" },
    );
    if (error) throw new Error(error.message);

    const { data: prof } = await context.supabase
      .from("profiles")
      .select("nome_completo, email")
      .eq("id", context.userId)
      .maybeSingle();

    const roleMap: Record<string, string> = {
      admin: "Administrador",
      gestor: "Gestor",
      consultor: "Consultor",
    };

    const rolesFormatadas = (roles: string[]) => roles.length > 0 
      ? roles.map(r => roleMap[r] || r).join(", ") 
      : "Nenhum";

    const acaoDesc = data.enabled ? "ativado" : "desativado";
    const statusPrevio = anterior.enabled ? "Ativo" : "Inativo";
    const statusNovo = data.enabled ? "Ativo" : "Inativo";
    
    // Descrição detalhada conforme exemplo solicitado
    const descricao = `Módulo de Comissões ${acaoDesc}
Perfis liberados: ${rolesFormatadas(valorNovo.roles)}
Alterado por: ${(prof as any)?.nome_completo ?? "Administrador"}
Perfil: Administrador`;

    await (context.supabase.from("audit_logs") as any).insert({
      user_id: context.userId,
      user_email: (prof as any)?.email ?? null,
      acao: "config_modulo_comissoes",
      descricao: descricao,
      entidade: "app_settings",
      entidade_id: COMMISSIONS_FLAG,
      valor_anterior: anterior,
      valor_novo: valorNovo,
    });

    return { enabled: data.enabled };
  });
