import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getMonthOperationalWeeks, normalizeAcompanhamentoStatus } from "./acompanhamento";
import type {
  AcompanhamentoBootstrap,
  AcompanhamentoFonte,
  AcompanhamentoOperadora,
  AcompanhamentoRole,
  ConsultorAcompanhamento,
  RobotStatusOption,
} from "./acompanhamento.types";

async function ensureAcompanhamentoManager(supabase: any, userId: string): Promise<AcompanhamentoRole> {
  const { data: roleRows, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  const roles = new Set((roleRows ?? []).map((row: any) => String(row.role)));

  if (roles.has("admin")) return "admin";
  if (roles.has("gestor")) return "gestor";
  throw new Error("Forbidden: acompanhamento disponível apenas para Administrador e Gestor.");
}

function asNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

export const getAcompanhamentoBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    ano: z.number().int().min(2020).max(2100),
    mes: z.number().int().min(1).max(12),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const role = await ensureAcompanhamentoManager(db, context.userId);

    const [
      tiposResult,
      processoConfigResult,
      gruposResult,
      vinculosResult,
      statusManualResult,
      robotLogsResult,
      etapasResult,
      quadrosResult,
      regrasResult,
      metasMensaisResult,
      metasSemanaisResult,
      metasConsultoresResult,
      consultoresResult,
    ] = await Promise.all([
      db.from("tipos_pedido_catalogo")
        .select("id,nome,operadora,ativo")
        .eq("ativo", true)
        .order("operadora")
        .order("nome"),
      db.from("acompanhamento_configuracoes")
        .select("valor")
        .eq("chave", "processo_tipo_produto_v1")
        .maybeSingle(),
      db.from("acompanhamento_grupos")
        .select("*")
        .eq("ativo", true)
        .order("contexto")
        .order("ordem"),
      db.from("acompanhamento_tipo_vinculos")
        .select("*")
        .order("updated_at", { ascending: false }),
      db.from("status_comercial_operadoras")
        .select("status_id,operadora,nome,ativo")
        .eq("ativo", true)
        .order("operadora")
        .order("nome"),
      db.from("venda_robo_logs")
        .select("id,valor_novo,campo,campo_label,acao,origem,robo_nome,created_at")
        .not("valor_novo", "is", null)
        .order("created_at", { ascending: false })
        .limit(2000),
      db.from("pipeline_etapas")
        .select("id,nome,funil_id,ativo,ordem")
        .eq("ativo", true)
        .order("ordem"),
      db.from("acompanhamento_quadros")
        .select("*")
        .eq("ativo", true)
        .order("ordem"),
      db.from("acompanhamento_quadro_regras")
        .select("*")
        .order("created_at"),
      db.from("acompanhamento_metas_mensais")
        .select("*")
        .eq("ano", data.ano)
        .eq("mes", data.mes),
      db.from("acompanhamento_metas_semanais")
        .select("*")
        .eq("ano", data.ano)
        .eq("mes", data.mes)
        .order("semana"),
      db.from("acompanhamento_metas_consultores")
        .select("*")
        .eq("ano", data.ano)
        .eq("mes", data.mes)
        .order("quadro"),
      db.from("colaboradores")
        .select("user_id,nome_exibicao,ativo,is_deleted,deleted_at")
        .eq("funcao", "consultor")
        .eq("ativo", true)
        .eq("is_deleted", false)
        .is("deleted_at", null)
        .not("user_id", "is", null)
        .order("nome_exibicao"),
    ]);

    for (const result of [
      tiposResult,
      processoConfigResult,
      gruposResult,
      vinculosResult,
      statusManualResult,
      robotLogsResult,
      etapasResult,
      quadrosResult,
      regrasResult,
      metasMensaisResult,
      metasSemanaisResult,
      metasConsultoresResult,
      consultoresResult,
    ]) {
      if (result.error) throw new Error(result.error.message);
    }

    const activeConsultorIds = uniqueStrings((consultoresResult.data ?? []).map((row: any) => row.user_id));
    const historicalConsultorIds = uniqueStrings(
      (metasConsultoresResult.data ?? []).map((row: any) => row.consultor_id),
    );
    const allProfileIds = uniqueStrings([...activeConsultorIds, ...historicalConsultorIds]);

    const profilesResult = allProfileIds.length
      ? await db.from("profiles")
          .select("id,nome_completo,ativo")
          .in("id", allProfileIds)
          .order("nome_completo")
      : { data: [], error: null };

    if (profilesResult.error) throw new Error(profilesResult.error.message);

    const profiles = new Map<string, ConsultorAcompanhamento>(
      (profilesResult.data ?? []).map((row: any) => [
        row.id,
        {
          id: row.id,
          nome_completo: row.nome_completo ?? "Consultor",
          ativo: row.ativo !== false,
        },
      ]),
    );

    const collaboratorNames = new Map<string, string>(
      (consultoresResult.data ?? [])
        .filter((row: any) => row.user_id)
        .map((row: any) => [String(row.user_id), String(row.nome_exibicao ?? "Consultor")]),
    );

    const consultoresAtivos = activeConsultorIds
      .map(id => {
        const profile = profiles.get(id);
        return {
          id,
          nome_completo: profile?.nome_completo ?? collaboratorNames.get(id) ?? "Consultor",
          ativo: profile?.ativo !== false,
        } satisfies ConsultorAcompanhamento;
      })
      .filter(row => row.ativo)
      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));

    const consultoresHistoricos = historicalConsultorIds
      .filter(id => !consultoresAtivos.some(row => row.id === id))
      .map(id => {
        const profile = profiles.get(id);
        return {
          id,
          nome_completo: profile?.nome_completo ?? "Consultor histórico",
          ativo: profile?.ativo ?? false,
          historico: true,
        } satisfies ConsultorAcompanhamento;
      })
      .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));

    const robotByKey = new Map<string, RobotStatusOption>();
    for (const row of robotLogsResult.data ?? []) {
      const campo = `${row.campo ?? ""} ${row.campo_label ?? ""}`.toLowerCase();
      if (!campo.includes("status")) continue;

      const nome = String(row.valor_novo ?? "").trim();
      const normalizado = normalizeAcompanhamentoStatus(nome);
      if (!normalizado || robotByKey.has(normalizado)) continue;

      robotByKey.set(normalizado, {
        id: `robot:${normalizado}`,
        nome,
        normalizado,
        source: "status_robo",
        roboNome: row.robo_nome ?? null,
      });
    }

    const bootstrap: AcompanhamentoBootstrap = {
      role,
      classificacoesProcesso: {
        CLARO: Array.isArray(processoConfigResult.data?.valor?.CLARO) ? processoConfigResult.data.valor.CLARO : [],
        VIVO: Array.isArray(processoConfigResult.data?.valor?.VIVO) ? processoConfigResult.data.valor.VIVO : [],
      },
      ano: data.ano,
      mes: data.mes,
      semanas: getMonthOperationalWeeks(data.ano, data.mes),
      consultoresAtivos,
      consultoresHistoricos,
      tiposPedido: (tiposResult.data ?? []).map((row: any) => ({
        id: row.id,
        nome: row.nome,
        operadora: row.operadora as AcompanhamentoOperadora,
        ativo: row.ativo !== false,
      })),
      grupos: gruposResult.data ?? [],
      vinculosTipo: vinculosResult.data ?? [],
      statusManuais: (statusManualResult.data ?? []).map((row: any) => ({
        id: `${row.status_id}:${row.operadora}`,
        nome: row.nome,
        operadora: row.operadora as AcompanhamentoOperadora,
        ativo: row.ativo !== false,
        source: "status_manual" as const,
      })),
      statusRobo: Array.from(robotByKey.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      etapasPipeline: (etapasResult.data ?? []).map((row: any) => ({
        id: row.id,
        nome: row.nome,
        funil_id: row.funil_id,
        ativo: row.ativo !== false,
        source: "pipeline_etapa" as const,
      })),
      quadros: quadrosResult.data ?? [],
      regrasQuadros: regrasResult.data ?? [],
      metasMensais: (metasMensaisResult.data ?? []).map((row: any) => ({ ...row, valor: asNumber(row.valor) })),
      metasSemanais: (metasSemanaisResult.data ?? []).map((row: any) => ({ ...row, valor: asNumber(row.valor) })),
      metasConsultores: (metasConsultoresResult.data ?? []).map((row: any) => ({
        ...row,
        meta_semanal: asNumber(row.meta_semanal),
      })),
    };

    return bootstrap;
  });

export const saveMetaMensal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    ano: z.number().int().min(2020).max(2100),
    mes: z.number().int().min(1).max(12),
    grupo: z.enum(["np_fixa", "outros"]),
    valor: z.number().min(0),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await ensureAcompanhamentoManager(db, context.userId);

    const { data: row, error } = await db.from("acompanhamento_metas_mensais")
      .upsert({
        ano: data.ano,
        mes: data.mes,
        grupo: data.grupo,
        valor: data.valor,
        updated_by: context.userId,
      }, { onConflict: "ano,mes,grupo" })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const saveMetaSemanal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    ano: z.number().int().min(2020).max(2100),
    mes: z.number().int().min(1).max(12),
    semana: z.number().int().min(1).max(5),
    grupo: z.enum(["novo_importado", "renovacao"]),
    valor: z.number().min(0),
    origem: z.enum(["automatico", "manual"]).default("manual"),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await ensureAcompanhamentoManager(db, context.userId);

    const { data: row, error } = await db.from("acompanhamento_metas_semanais")
      .upsert({
        ...data,
        updated_by: context.userId,
      }, { onConflict: "ano,mes,semana,grupo" })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const saveMetaConsultor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    ano: z.number().int().min(2020).max(2100),
    mes: z.number().int().min(1).max(12),
    quadro: z.enum(["enviados", "assinados"]),
    consultorId: z.string().uuid(),
    metaSemanal: z.number().min(0),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await ensureAcompanhamentoManager(db, context.userId);

    const { data: consultor, error: consultorError } = await db.from("colaboradores")
      .select("user_id,ativo,is_deleted,deleted_at")
      .eq("user_id", data.consultorId)
      .eq("funcao", "consultor")
      .eq("ativo", true)
      .eq("is_deleted", false)
      .is("deleted_at", null)
      .maybeSingle();

    if (consultorError) throw new Error(consultorError.message);
    if (!consultor) throw new Error("Consultor ativo não encontrado.");

    const { data: row, error } = await db.from("acompanhamento_metas_consultores")
      .upsert({
        ano: data.ano,
        mes: data.mes,
        quadro: data.quadro,
        consultor_id: data.consultorId,
        meta_semanal: data.metaSemanal,
        updated_by: context.userId,
      }, { onConflict: "ano,mes,quadro,consultor_id" })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const saveTipoVinculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    tipoPedidoId: z.string().uuid(),
    grupoId: z.string().uuid(),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await ensureAcompanhamentoManager(db, context.userId);

    const [{ data: tipo, error: tipoError }, { data: grupo, error: grupoError }] = await Promise.all([
      db.from("tipos_pedido_catalogo").select("id,operadora").eq("id", data.tipoPedidoId).maybeSingle(),
      db.from("acompanhamento_grupos").select("id,contexto,operadora").eq("id", data.grupoId).maybeSingle(),
    ]);

    if (tipoError) throw new Error(tipoError.message);
    if (grupoError) throw new Error(grupoError.message);
    if (!tipo || !grupo) throw new Error("Tipo de pedido ou grupo não encontrado.");
    if (grupo.operadora && grupo.operadora !== tipo.operadora) {
      throw new Error("O grupo escolhido pertence a outra operadora.");
    }

    const { data: siblingGroups, error: siblingError } = await db.from("acompanhamento_grupos")
      .select("id")
      .eq("contexto", grupo.contexto);

    if (siblingError) throw new Error(siblingError.message);
    const siblingIds = (siblingGroups ?? []).map((row: any) => row.id);

    if (siblingIds.length) {
      const { error: deleteError } = await db.from("acompanhamento_tipo_vinculos")
        .delete()
        .eq("tipo_pedido_id", data.tipoPedidoId)
        .in("grupo_id", siblingIds);
      if (deleteError) throw new Error(deleteError.message);
    }

    const { data: row, error } = await db.from("acompanhamento_tipo_vinculos")
      .insert({
        tipo_pedido_id: data.tipoPedidoId,
        grupo_id: data.grupoId,
        classificado_por: context.userId,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTipoVinculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await ensureAcompanhamentoManager(db, context.userId);
    const { error } = await db.from("acompanhamento_tipo_vinculos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ruleSchema = z.object({
  operadora: z.enum(["CLARO", "VIVO"]).nullable(),
  fonte: z.enum(["status_manual", "status_robo", "pipeline_etapa"]),
  referenciaId: z.string().nullable().optional(),
  valorOriginal: z.string().trim().min(1),
});

export const saveQuadroRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({
    quadroId: z.string().uuid(),
    rules: z.array(ruleSchema).max(200),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    await ensureAcompanhamentoManager(db, context.userId);

    const { data: quadro, error: quadroError } = await db.from("acompanhamento_quadros")
      .select("id")
      .eq("id", data.quadroId)
      .maybeSingle();
    if (quadroError) throw new Error(quadroError.message);
    if (!quadro) throw new Error("Quadro não encontrado.");

    const { error: deleteError } = await db.from("acompanhamento_quadro_regras")
      .delete()
      .eq("quadro_id", data.quadroId);
    if (deleteError) throw new Error(deleteError.message);

    if (!data.rules.length) return { ok: true, count: 0 };

    const payload = data.rules.map(rule => ({
      quadro_id: data.quadroId,
      operadora: rule.operadora,
      fonte: rule.fonte as AcompanhamentoFonte,
      referencia_id: rule.referenciaId ?? null,
      valor_original: rule.valorOriginal.trim(),
      valor_normalizado: normalizeAcompanhamentoStatus(rule.valorOriginal),
      ativo: true,
      updated_by: context.userId,
    }));

    const { error: insertError } = await db.from("acompanhamento_quadro_regras").insert(payload);
    if (insertError) throw new Error(insertError.message);
    return { ok: true, count: payload.length };
  });
