import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  allPermissionKeys,
  defaultPermissionState,
  type IndividualPermissionRole,
} from "./permission-matrix";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function rolesFor(userId: string) {
  const sb = await admin();
  const { data, error } = await sb.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(row => String(row.role));
}

async function assertPermissionAdministrator(userId: string) {
  const roles = await rolesFor(userId);
  if (!roles.includes("admin") && !roles.includes("bko")) {
    throw new Error("403: somente Admin ou BKO pode administrar permissões individuais.");
  }
  return roles.includes("admin") ? "admin" : "bko";
}

async function targetRole(userId: string): Promise<IndividualPermissionRole> {
  const roles = await rolesFor(userId);
  if (roles.includes("gestor")) return "gestor";
  if (roles.includes("consultor")) return "consultor";
  throw new Error("A configuração individual existe somente para Gestor e Consultor.");
}

export const getIndividualPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }: { data: { userId: string }; context: any }) => {
    await assertPermissionAdministrator(context.userId as string);
    const role = await targetRole(data.userId);
    const sb = await admin();

    const { data: profile, error } = await sb
      .from("profiles")
      .select("id,nome_completo,email,ativo,permissoes")
      .eq("id", data.userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!profile) throw new Error("Usuário não encontrado.");

    const defaults = defaultPermissionState(role);
    const stored = (profile.permissoes ?? {}) as Record<string, boolean>;
    const effective: Record<string, boolean> = { ...defaults };

    for (const key of allPermissionKeys(role)) {
      if (typeof stored[key] === "boolean") effective[key] = stored[key];
    }

    return {
      user: {
        id: profile.id,
        nome: profile.nome_completo,
        email: profile.email,
        ativo: profile.ativo,
        role,
      },
      permissions: effective,
      defaults,
    };
  });

export const saveIndividualPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      userId: z.string().uuid(),
      permissions: z.record(z.string(), z.boolean()),
    }).parse(input),
  )
  .handler(async ({ data, context }: { data: { userId: string; permissions: Record<string, boolean> }; context: any }) => {
    const actorId = context.userId as string;
    const actorRole = await assertPermissionAdministrator(actorId);
    const role = await targetRole(data.userId);
    const allowedKeys = new Set(allPermissionKeys(role));
    const sb = await admin();

    const [{ data: target, error: targetError }, { data: actor, error: actorError }] = await Promise.all([
      sb.from("profiles").select("id,nome_completo,email,permissoes").eq("id", data.userId).maybeSingle(),
      sb.from("profiles").select("id,nome_completo,email").eq("id", actorId).maybeSingle(),
    ]);
    if (targetError) throw new Error(targetError.message);
    if (actorError) throw new Error(actorError.message);
    if (!target) throw new Error("Usuário não encontrado.");

    const defaults = defaultPermissionState(role);
    const currentRaw = (target.permissoes ?? {}) as Record<string, boolean>;
    const currentEffective: Record<string, boolean> = { ...defaults };

    for (const key of allowedKeys) {
      if (typeof currentRaw[key] === "boolean") currentEffective[key] = currentRaw[key];
    }

    const nextRaw: Record<string, boolean> = { ...currentRaw };
    const changes: Array<{ key: string; before: boolean; after: boolean }> = [];

    for (const key of allowedKeys) {
      const next = typeof data.permissions[key] === "boolean" ? data.permissions[key] : currentEffective[key];
      if (next !== currentEffective[key]) changes.push({ key, before: currentEffective[key], after: next });
      nextRaw[key] = next;
    }

    if (changes.length === 0) {
      return { success: true, changes: 0 };
    }

    const { error: updateError } = await sb
      .from("profiles")
      .update({ permissoes: nextRaw, updated_at: new Date().toISOString() })
      .eq("id", data.userId);
    if (updateError) throw new Error(updateError.message);

    const auditRows = changes.map(change => ({
      user_id: actorId,
      user_email: actor?.email ?? null,
      acao: "permission_individual_update",
      descricao: `${target.nome_completo ?? target.email ?? data.userId} | ${change.key} | ${change.before ? "TRUE" : "FALSE"} -> ${change.after ? "TRUE" : "FALSE"} | alterado por ${actor?.nome_completo ?? actorRole}`,
      entidade: "profile_permission",
      entidade_id: data.userId,
      valor_anterior: { permission_key: change.key, enabled: change.before },
      valor_novo: { permission_key: change.key, enabled: change.after },
    }));

    const { error: auditError } = await sb.from("audit_logs").insert(auditRows as any);
    if (auditError) {
      // A configuração foi salva; falha de auditoria não pode ser silenciosa.
      throw new Error(`Permissões salvas, mas a auditoria falhou: ${auditError.message}`);
    }

    return { success: true, changes: changes.length };
  });
