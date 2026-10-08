import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type AppRole } from "./auth";

const SUPER_ADMIN_EMAIL = "pablomazinesantos@gmail.com";
const VALID_ROLES = ["admin", "gestor", "consultor", "bko", "closer", "telespectador"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

const roleSchema = z.enum(VALID_ROLES);

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function normEmail(email: string) {
  return email.trim().toLowerCase();
}

function permissoesFor(role: ValidRole): Record<string, boolean> {
  if (role === "admin") return { ver_claro: true, ver_vivo: true, ver_omni: true, ver_sensiveis: true, importar: true, exportar: true, editar_funis: true };
  if (role === "gestor") return { ver_claro: true, ver_vivo: true, ver_omni: true, ver_sensiveis: true, importar: false, exportar: true, editar_funis: false };
  if (role === "bko") return { ver_claro: true, ver_vivo: true, ver_omni: true, ver_sensiveis: true, importar: false, exportar: false, editar_funis: true };
  return { ver_claro: false, ver_vivo: false, ver_omni: false, ver_sensiveis: false, importar: false, exportar: false, editar_funis: false };
}

/** Perfil do usuário autenticado (para autorização no servidor). */
async function actorRole(userId: string): Promise<ValidRole | null> {
  const sb = await admin();
  const { data } = await sb.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r) => r.role as string).filter((r) => (VALID_ROLES as readonly string[]).includes(r));
  for (const r of VALID_ROLES) if (roles.includes(r)) return r;
  return null;
}

class Forbidden extends Error {
  constructor(msg = "403 Forbidden: você não tem permissão para esta ação.") {
    super(msg);
  }
}

async function requireAdminOrGestor(userId: string) {
  const role = await actorRole(userId);
  if (role !== "admin" && role !== "gestor") throw new Forbidden();
  return role;
}

/** Só admin cria qualquer perfil; gestor cria apenas consultor. */
function assertCanCreate(actor: ValidRole, target: ValidRole) {
  if (actor === "admin") return;
  if (actor === "gestor" && target === "consultor") return;
  throw new Forbidden("403 Forbidden: seu perfil não pode criar usuários com este perfil.");
}

/** Localiza usuário no Auth pelo e-mail (profiles primeiro, depois Auth Admin). */
async function findExistingByEmail(email: string) {
  const sb = await admin();
  const { data: prof } = await sb
    .from("profiles")
    .select("id, email, nome_completo, ativo, is_deleted")
    .ilike("email", email)
    .maybeSingle();
  if (prof) return { authId: prof.id, profile: prof };

  for (let page = 1; page <= 5; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    const found = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) return { authId: found.id, profile: null };
    if (users.length < 200) break;
  }
  return null;
}

/** Localiza o id da conta no serviço de contas apenas pelo e-mail. */
async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const sb = await admin();
  for (let page = 1; page <= 20; page++) {
    const { data } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    const found = users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (users.length < 200) break;
  }
  return null;
}


/** Garante profile + role + colaborador coerentes (idempotente). */
async function ensureLinks(opts: {
  userId: string;
  email: string;
  nome: string;
  role: ValidRole;
  operadora?: string | null;
  reactivate?: boolean;
}) {
  const sb = await admin();
  const { userId, email, nome, role, operadora, reactivate } = opts;

  const profilePayload: Record<string, unknown> = {
    id: userId,
    email,
    nome_completo: nome,
    operadora_default: role === "consultor" ? operadora ?? null : null,
    permissoes: permissoesFor(role),
    ativo: true,
    updated_at: new Date().toISOString(),
  };
  if (reactivate) {
    profilePayload.is_deleted = false;
    profilePayload.deleted_at = null;
    profilePayload.deleted_by = null;
    profilePayload.deleted_by_role = null;
    profilePayload.deletion_reason = null;
  }

  const { data: existing } = await sb.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (existing) {
    const { id: _ignore, ...update } = profilePayload as any;
    const { error } = await sb.from("profiles").update(update).eq("id", userId);
    if (error) throw new Error(`Falha ao atualizar perfil: ${error.message}`);
  } else {
    const { error } = await sb.from("profiles").insert(profilePayload as any);
    if (error) throw new Error(`Falha ao criar perfil: ${error.message}`);
  }

  // Perfil único por usuário
  await sb.from("user_roles").delete().eq("user_id", userId).neq("role", role as any);
  const { data: hasRole } = await sb.from("user_roles").select("id").eq("user_id", userId).eq("role", role as any).maybeSingle();
  if (!hasRole) {
    const { error } = await sb.from("user_roles").insert({ user_id: userId, role: role as any });
    if (error) throw new Error(`Falha ao vincular perfil: ${error.message}`);
  }

  // Colaborador (equipe) — trigger sincroniza, mas garantimos estado final
  const colabPayload: Record<string, unknown> = {
    user_id: userId,
    nome_exibicao: nome,
    nome_normalizado: nome.trim().toLowerCase(),
    funcao: role,
    ativo: true,
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
    deleted_by_role: null,
    deletion_reason: null,
    origem: "sync",
    updated_at: new Date().toISOString(),
  };
  const { data: colab } = await sb.from("colaboradores").select("id").eq("user_id", userId).maybeSingle();
  if (colab) {
    const { error } = await sb.from("colaboradores").update(colabPayload as any).eq("user_id", userId);
    if (error) throw new Error(`Falha ao sincronizar colaborador: ${error.message}`);
  } else {
    const { error } = await sb.from("colaboradores").insert(colabPayload as any);
    if (error) throw new Error(`Falha ao criar colaborador: ${error.message}`);
  }
}

async function auditLog(entry: {
  userId: string;
  acao: string;
  descricao: string;
  entidadeId?: string;
  valorNovo?: Record<string, unknown>;
}) {
  const sb = await admin();
  await sb.from("audit_logs").insert({
    user_id: entry.userId,
    acao: entry.acao,
    descricao: entry.descricao,
    entidade: "profile",
    entidade_id: entry.entidadeId ?? null,
    valor_novo: (entry.valorNovo ?? null) as any,
  });
}

async function auditLogSafely(entry: {
  userId: string;
  acao: string;
  descricao: string;
  entidadeId?: string;
  valorNovo?: Record<string, unknown>;
}) {
  try {
    await auditLog(entry);
    return null;
  } catch (e: any) {
    console.warn("[auditLogSafely] auditoria ignorada:", e?.message || e);
    return "Usuário criado, mas auditoria não registrada.";
  }
}

// ----------------------------------------------------------------------------
// Diagnóstico e fallback do Auth
// ----------------------------------------------------------------------------

/** Extrai o máximo de detalhe possível de um erro do Supabase Auth. */
export function formatAuthError(err: unknown): string {
  if (err == null) return "erro desconhecido (nenhum detalhe retornado)";
  if (typeof err === "string") return err.trim() || "erro desconhecido";

  const e = err as Record<string, any>;
  const parts: string[] = [];
  const push = (label: string, value: unknown) => {
    if (value === undefined || value === null) return;
    const text = typeof value === "string" ? value.trim() : String(value);
    if (!text || text === "{}") return;
    parts.push(`${label}=${text}`);
  };

  push("message", e.message);
  push("name", e.name);
  push("status", e.status ?? e.statusCode);
  push("code", e.code ?? e.error_code);
  push("details", e.details);
  push("hint", e.hint);
  push("error_description", e.error_description ?? e.msg);
  if (e.cause) push("cause", e.cause?.message ?? String(e.cause));

  let raw = "";
  try {
    raw = JSON.stringify(e, Object.getOwnPropertyNames(e));
  } catch {
    raw = "";
  }
  if (raw && raw !== "{}" && raw.length < 1200) parts.push(`raw=${raw}`);
  if (typeof e.stack === "string" && e.stack) parts.push(`stack=${e.stack.split("\n").slice(0, 3).join(" | ")}`);

  return parts.length ? parts.join(" · ") : "erro sem detalhes retornado pelo serviço de contas";
}

/**
 * Cria o usuário chamando diretamente a API Admin do Auth (server-side).
 * Usado como fallback quando o SDK admin falha sem detalhes.
 * Nunca toca na sessão do administrador logado.
 */
async function createAuthUserViaRest(payload: {
  email: string;
  password: string;
  nome: string;
  role: ValidRole;
}): Promise<{ id: string } | { error: string }> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return { error: "credencial administrativa do backend indisponível no servidor" };

  try {
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: payload.email,
        password: payload.password,
        email_confirm: true,
        user_metadata: { nome_completo: payload.nome, role: payload.role },
      }),
    });
    const text = await res.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    if (!res.ok) {
      const detail = body ? formatAuthError(body) : text.slice(0, 500);
      return { error: `HTTP ${res.status} ${detail || res.statusText}` };
    }
    const id = body?.id ?? body?.user?.id;
    if (!id) return { error: "o serviço de contas não retornou o identificador do usuário" };
    return { id: String(id) };
  } catch (e) {
    return { error: formatAuthError(e) };
  }
}


// ----------------------------------------------------------------------------
// Listagem
// ----------------------------------------------------------------------------

export const listUsuarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: { context: any }) => {
    await requireAdminOrGestor(context.userId as string);
    const sb = await admin();

    const { data: profiles, error } = await sb
      .from("profiles")
      .select("id, email, nome_completo, operadora_default, ativo, must_change_password, permissoes, last_login_at, is_deleted, deleted_at")
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("nome_completo");
    if (error) throw new Error(error.message);

    const { data: roles } = await sb.from("user_roles").select("user_id, role");
    const { data: colabs } = await sb.from("colaboradores").select("user_id, is_deleted");

    const list = (profiles ?? [])
      .filter((p) => !p.deleted_at)
      .map((p) => {
        const userRoles = (roles ?? []).filter((r) => r.user_id === p.id).map((r) => String(r.role));
        const validRoles = userRoles.filter((r) => (VALID_ROLES as readonly string[]).includes(r));
        const colab = (colabs ?? []).find((c) => c.user_id === p.id);
        return {
          ...p,
          permissoes: (p.permissoes ?? {}) as Record<string, boolean>,
          roles: validRoles,
          is_super_admin: (p.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL,
          inconsistencias: [
            validRoles.length === 0 ? "sem perfil válido" : null,
            userRoles.length > validRoles.length ? "perfil inválido" : null,
            !colab || colab.is_deleted ? "sem vínculo na Equipe" : null,
          ].filter(Boolean) as string[],
        };
      });

    return list;
  });

// ----------------------------------------------------------------------------
// Criação / reativação
// ----------------------------------------------------------------------------

export const criarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6, "A senha precisa ter no mínimo 6 caracteres"),
        nome: z.string().min(3),
        role: roleSchema,
        operadora: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const actorId = context.userId as string;
    const actor = await requireAdminOrGestor(actorId);
    const role = data.role as ValidRole;
    assertCanCreate(actor, role);

    const email = normEmail(data.email);
    const nome = String(data.nome).trim();
    const operadora = role === "consultor" ? data.operadora ?? null : null;
    if (role === "consultor" && !operadora) {
      throw new Error("Informe a operadora vinculada para o perfil Consultor.");
    }

    const sb = await admin();

    const existing = await findExistingByEmail(email);

    // Reaproveita/repara um cadastro existente (perfil inativo, excluído ou sem vínculos).
    async function reaproveitar(authId: string) {
      const { error: pwError } = await sb.auth.admin.updateUserById(authId, {
        password: data.password,
        email_confirm: true,
        user_metadata: { nome_completo: nome },
      });
      // Se a senha for recusada (ex.: senha fraca), a reativação prossegue com a senha antiga
      let senhaAviso: string | null = null;
      if (pwError) {
        const { error: metaError } = await sb.auth.admin.updateUserById(authId, {
          email_confirm: true,
          user_metadata: { nome_completo: nome },
        });
        if (metaError) throw new Error(`Falha ao reativar acesso: ${metaError.message}`);
        senhaAviso = `Perfil reativado, mas a senha informada foi recusada (${pwError.message}). A senha anterior continua válida — use "Trocar senha" para definir uma nova.`;
      }

      await ensureLinks({ userId: authId, email, nome, role, operadora, reactivate: true });
      const reativarAviso = await auditLogSafely({
        userId: actorId,
        acao: "user_reactivate",
        descricao: `Usuário reativado: ${email} (${role})`,
        entidadeId: authId,
        valorNovo: { email, role },
      });
      return { id: authId, reativado: true, aviso: senhaAviso ?? reativarAviso };
    }

    if (existing) {
      const isActive = existing.profile ? existing.profile.ativo && !existing.profile.is_deleted : false;
      if (isActive) throw new Error("Este e-mail já está cadastrado e ativo.");
      return await reaproveitar(existing.authId);
    }

    let userId: string | null = null;
    let sdkErro: string | null = null;
    let jaCadastrado = false;

    try {
      const { data: authUser, error: authError } = await sb.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { nome_completo: nome, role },
      });
      if (authError) {
        sdkErro = formatAuthError(authError);
        if (/already|exists|registered|duplicate/i.test(sdkErro)) jaCadastrado = true;
      } else if (authUser?.user?.id) {
        userId = authUser.user.id;
      } else {
        sdkErro = "o serviço de contas não retornou o identificador do usuário";
      }
    } catch (e: any) {
      sdkErro = formatAuthError(e);
      if (/already|exists|registered|duplicate/i.test(sdkErro)) jaCadastrado = true;
    }

    // A conta existe no serviço de contas, mas não foi encontrada acima (perfil ausente
    // ou lista paginada): localiza o id real e repara os vínculos em vez de falhar.
    if (!userId && jaCadastrado) {
      const authId = await findAuthUserIdByEmail(email);
      if (authId) return await reaproveitar(authId);
      throw new Error(
        "Este e-mail já está cadastrado no serviço de contas, mas não foi possível localizar o cadastro para reaproveitá-lo. Use outro e-mail ou peça a exclusão definitiva do anterior.",
      );
    }

    if (!userId) {
      console.warn("[criarUsuario] SDK admin.createUser falhou, tentando fallback REST:", sdkErro);
      const fallback = await createAuthUserViaRest({ email, password: data.password, nome, role });
      if ("error" in fallback) {
        if (/already|exists|registered|duplicate/i.test(fallback.error)) {
          const authId = await findAuthUserIdByEmail(email);
          if (authId) return await reaproveitar(authId);
        }
        throw new Error(
          `Falha ao criar usuário no Auth: ${sdkErro ?? "erro sem detalhes"} | fallback: ${fallback.error}`,
        );
      }
      userId = fallback.id;
    }



    await ensureLinks({ userId, email, nome, role, operadora, reactivate: true });
    const auditoriaAviso = await auditLogSafely({
      userId: actorId,
      acao: "user_create",
      descricao: `Usuário criado: ${email} (${role})`,
      entidadeId: userId,
      valorNovo: { email, role },
    });

    return { id: userId, reativado: false, aviso: auditoriaAviso };
  });

// ----------------------------------------------------------------------------
// Atualização
// ----------------------------------------------------------------------------

export const atualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nome: z.string().min(3).optional(),
        role: roleSchema.optional(),
        operadora: z.string().optional().nullable(),
        ativo: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const actorId = context.userId as string;
    const actor = await requireAdminOrGestor(actorId);
    const sb = await admin();

    const { data: target } = await sb
      .from("profiles")
      .select("id, email, nome_completo, operadora_default")
      .eq("id", data.id)
      .maybeSingle();
    if (!target) throw new Error("Usuário não encontrado.");

    const isSuper = (target.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL;
    if (isSuper && (data.ativo === false || (data.role && data.role !== "admin"))) {
      throw new Error("Este é o Administrador principal do sistema e não pode ser excluído.");
    }

    const currentRole = (await actorRole(data.id)) ?? "consultor";
    const role = (data.role ?? currentRole) as ValidRole;
    if (data.role && data.role !== currentRole) assertCanCreate(actor, role);

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.nome !== undefined) update.nome_completo = data.nome;
    if (data.ativo !== undefined) update.ativo = data.ativo;
    if (data.role !== undefined) update.permissoes = permissoesFor(role);
    if (data.role !== undefined || data.operadora !== undefined) {
      update.operadora_default = role === "consultor" ? data.operadora ?? target.operadora_default ?? null : null;
    }

    const { error } = await sb.from("profiles").update(update as any).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.role) {
      await sb.from("user_roles").delete().eq("user_id", data.id).neq("role", role as any);
      const { data: hasRole } = await sb.from("user_roles").select("id").eq("user_id", data.id).eq("role", role as any).maybeSingle();
      if (!hasRole) {
        const { error: rErr } = await sb.from("user_roles").insert({ user_id: data.id, role: role as any });
        if (rErr) throw new Error(rErr.message);
      }
      await sb.from("colaboradores").update({ funcao: role, updated_at: new Date().toISOString() }).eq("user_id", data.id);
    }
    if (data.nome !== undefined || data.ativo !== undefined) {
      await sb
        .from("colaboradores")
        .update({
          ...(data.nome !== undefined ? { nome_exibicao: data.nome, nome_normalizado: String(data.nome).trim().toLowerCase() } : {}),
          ...(data.ativo !== undefined ? { ativo: data.ativo } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", data.id);
    }

    await auditLog({
      userId: actorId,
      acao: "user_update",
      descricao: `Usuário atualizado: ${target.email}`,
      entidadeId: data.id,
      valorNovo: { nome: data.nome, role: data.role, ativo: data.ativo },
    });

    return { success: true };
  });

// ----------------------------------------------------------------------------
// Senha
// ----------------------------------------------------------------------------

export const resetarSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        newPassword: z.string().min(6, "A senha precisa ter no mínimo 6 caracteres"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const actorId = context.userId as string;
    await requireAdminOrGestor(actorId);
    const sb = await admin();

    const { error } = await sb.auth.admin.updateUserById(data.id, { password: data.newPassword });
    if (error) throw new Error(error.message);

    await auditLog({
      userId: actorId,
      acao: "user_password_reset",
      descricao: "Senha redefinida pelo administrador",
      entidadeId: data.id,
    });
    return { success: true };
  });

// ----------------------------------------------------------------------------
// Exclusão lógica
// ----------------------------------------------------------------------------

export const deleteColaborador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().min(1, "Informe o motivo da exclusão"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { id, reason } = data;
    const actorId = context.userId as string;

    if ((await actorRole(actorId)) !== "admin") {
      throw new Forbidden("403 Forbidden: apenas Administradores podem excluir colaboradores.");
    }

    const sb = await admin();
    const { data: actorProfile } = await sb.from("profiles").select("nome_completo").eq("id", actorId).maybeSingle();

    // deleted_by referencia auth.users.id -> usamos o id do administrador autenticado
    const { data: rpcResult, error } = await sb.rpc("delete_colaborador_transacional", {
      p_colaborador_id: id,
      p_user_id: actorId,
      p_user_name: actorProfile?.nome_completo || "Administrador",
      p_user_role: "admin",
      p_reason: reason,
    });

    if (error) {
      console.error("[deleteColaborador] falha", { id, actorId, error });
      throw new Error(error.message || "Não foi possível excluir o colaborador.");
    }

    const res = rpcResult as any;
    if (!res?.success) throw new Error(res?.message || "Não foi possível excluir o colaborador.");

    return { success: true, message: res.message || "Colaborador excluído com sucesso." };
  });

// ----------------------------------------------------------------------------
// Auditoria / login
// ----------------------------------------------------------------------------

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ limit: z.number().optional() }).parse(data ?? {}))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    await requireAdminOrGestor(context.userId as string);
    const sb = await admin();
    const { data: logs, error } = await sb
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data?.limit || 100);
    if (error) throw new Error(error.message);
    return logs;
  });

export const registrarLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), email: z.string().email() }).parse(data),
  )
  .handler(async ({ data }: { data: any }) => {
    try {
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.warn("SUPABASE_SERVICE_ROLE_KEY ausente, ignorando registro_login (graceful fallback)");
        return { skipped: true, reason: "missing_service_role_key" };
      }
      const sb = await admin();
      await sb.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", data.userId);
      await sb.from("audit_logs").insert({
        user_id: data.userId,
        user_email: data.email,
        acao: "login",
        descricao: "Login realizado",
        entidade: "auth",
        entidade_id: data.userId,
      });
      return { success: true };
    } catch (e: any) {
      console.warn("Erro ignorado ao registrar login:", e?.message || e);
      return { skipped: true, reason: "error_ignored" };
    }
  });

export const seedInitialUsers = createServerFn({ method: "POST" }).handler(async () => ({ success: true }));

export const concluirTrocaSenha = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data }: { data: any }) => {
    const sb = await admin();
    await sb.from("profiles").update({ must_change_password: false }).eq("id", data.userId);
    return { success: true };
  });

export const atualizarColaborador = atualizarUsuario;
export const resetarSenhaColaborador = resetarSenha;

export const getColaboradoresBKO = createServerFn({ method: "GET" }).handler(async () => {
  const sb = await admin();
  const { data: roles } = await sb.from("user_roles").select("user_id").eq("role", "bko");
  if (!roles || roles.length === 0) return [];
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, nome_completo")
    .in("id", roles.map((r) => r.user_id))
    .eq("ativo", true)
    .or("is_deleted.is.null,is_deleted.eq.false");
  return profiles || [];
});

export type { AppRole };