import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    mes: z.number(),
    ano: z.number(),
    ambiente: z.enum(["GERAL", "CLARO", "VIVO"]).optional().default("GERAL"),
  }).parse(data))
  .handler(async ({ data, context }) => {
    // 1. Verificar autenticação e permissões
    // O auth-attacher injeta o token, mas para segurança real no serverFn,
    // precisamos extrair as roles do usuário logado.
    // TanStack Start context contém o request headers se o middleware estiver configurado.
    
    const { supabase, userId } = context as any;
    if (!userId || !supabase) {
      throw new Error("Unauthorized");
    }

    // Explicitly check for an active profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, ativo")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error("Unauthorized: Profile not found");
    }

    if (!profile.ativo) {
      throw new Error("Unauthorized: User is inactive");
    }

    // Buscar o papel do usuário
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    
    if (rolesError) {
      throw new Error("Unauthorized: Could not fetch user roles");
    }
    
    const roleList = roles?.map((r: any) => r.role) || [];
    const isAdmin = roleList.includes("admin");
    const isGestor = roleList.includes("gestor");
    const isConsultor = roleList.includes("consultor");
    const isBko = roleList.includes("bko");

    if (roleList.length === 0) {
      throw new Error("Unauthorized: No valid role assigned");
    }

    if (isBko) {
      throw new Error("Forbidden: BKO users cannot access commercial dashboard");
    }

    // 2. Definir filtros de escopo
    let query = supabase.from("vendas").select("*").is("deleted_at", null).is("is_deleted", false);

    if (isConsultor && !isAdmin && !isGestor) {
      query = query.eq("consultor_id", userId);
    }

    if (data.ambiente !== "GERAL") {
      query = query.eq("operadora", data.ambiente);
    }

    const { data: vendas, error } = await query.order("created_at", { ascending: false });
    
    if (error) throw error;

    // 3. Buscar nomes dos colaboradores se for admin/gestor para o ranking
    let colaboradoresMap = new Map();
    if (isAdmin || isGestor) {
      const { data: users } = await supabase
        .from("profiles")
        .select("id, nome_completo");
      users?.forEach((u: any) => colaboradoresMap.set(u.id, u.nome_completo));
    }

    return {
      vendas: vendas || [],
      colaboradores: Object.fromEntries(colaboradoresMap),
      role: isAdmin ? "admin" : isGestor ? "gestor" : "consultor"
    };
  });
