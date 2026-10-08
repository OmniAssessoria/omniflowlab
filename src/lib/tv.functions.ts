import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type TvAccessRole = "telespectador" | "gestor";

async function requireRole(context: any, allowed: TvAccessRole[]): Promise<TvAccessRole> {
  const userId = context?.userId as string | undefined;
  const supabase = context?.supabase;
  if (!userId || !supabase) throw new Error("Unauthorized");

  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;

  const roles = (data ?? []).map((row: any) => String(row.role));
  const matched = allowed.find((role) => roles.includes(role));
  if (matched) return matched;
  throw new Error("Forbidden");
}

function mapMetas(rows: any[]) {
  const metas: Record<string, { meta: number; sup: number; elite: number; ind: number }> = {};
  for (const row of rows ?? []) {
    const key = `${row.ano}-${String(row.mes).padStart(2, "0")}`;
    metas[key] = {
      meta: Number(row.meta ?? 0),
      sup: Number(row.super_meta ?? 0),
      elite: Number(row.meta_elite ?? 0),
      ind: Number(row.meta_individual ?? 0),
    };
  }
  return metas;
}

export const getTvSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: { context: any }) => {
    await requireRole(context, ["telespectador"]);
    const sb = context.supabase as any;
    const { data, error } = await sb.rpc("painel_tv_snapshot");
    if (error) throw error;

    const snapshot = data ?? {};
    return {
      equipe: String(snapshot.equipe ?? "Telecom"),
      fontes: Array.isArray(snapshot.fontes) ? snapshot.fontes : [],
      consultores: Array.isArray(snapshot.consultores) ? snapshot.consultores : [],
      contratos: Array.isArray(snapshot.contratos)
        ? snapshot.contratos.map((row: any) => ({ ...row, valor: Number(row.valor ?? 0) }))
        : [],
      metas: snapshot.metas && typeof snapshot.metas === "object" ? snapshot.metas : {},
      atualizado_em: String(snapshot.atualizado_em ?? new Date().toISOString()),
    };
  });

export const getTvMetas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: { context: any }) => {
    await requireRole(context, ["gestor"]);
    const sb = context.supabase as any;

    const { data, error } = await sb
      .from("painel_tv_metas")
      .select("ano,mes,meta,super_meta,meta_elite,meta_individual")
      .order("ano", { ascending: true })
      .order("mes", { ascending: true });

    if (error) throw error;

    return {
      metas: mapMetas(data ?? []),
      atualizado_em: new Date().toISOString(),
    };
  });

export const saveTvMetas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({
      mes: z.string().regex(/^\d{4}-\d{2}$/),
      meta: z.number().min(0),
      sup: z.number().min(0),
      elite: z.number().min(0),
      ind: z.number().min(0),
    }).refine((v) => v.meta <= v.sup && v.sup <= v.elite, {
      message: "A ordem deve ser Meta ≤ Super meta ≤ Meta elite.",
    }).parse(value),
  )
  .handler(async ({ data, context }: { data: any; context: any }) => {
    await requireRole(context, ["gestor"]);
    const sb = context.supabase as any;
    const [ano, mes] = String(data.mes).split("-").map(Number);

    const { error } = await sb.from("painel_tv_metas").upsert({
      ano,
      mes,
      meta: data.meta,
      super_meta: data.sup,
      meta_elite: data.elite,
      meta_individual: data.ind,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "ano,mes" });

    if (error) throw error;
    return { success: true };
  });
