import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureComissoesModule } from "./module-flags";

// ============== METAS MENSAIS ==============
export const listMetas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("metas_mensais")
      .select("*, profiles:consultor_id(nome_completo)")
      .order("data_inicio", { ascending: false });
    return data ?? [];
  });

export const salvarMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string; nome: string; mes_ref: number; ano_ref: number;
    data_inicio: string; data_fim: string; valor_meta: number;
    consultor_id: string; operadora?: string | null; produto?: string | null;
    status?: string; observacao?: string | null;
  }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    const { data: a } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!a) {
      const { data: g } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "gestor" });
      if (!g) throw new Error("Forbidden");
    }
    const payload: any = {
      nome: data.nome, mes_ref: data.mes_ref, ano_ref: data.ano_ref,
      data_inicio: data.data_inicio, data_fim: data.data_fim,
      valor_meta: data.valor_meta, consultor_id: data.consultor_id,
      operadora: data.operadora ?? null, produto: data.produto ?? null,
      status: data.status ?? "em_andamento", observacao: data.observacao ?? null,
    };
    if (data.id) {
      const { error } = await (context.supabase.from("metas_mensais") as any).update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    payload.criado_por = context.userId;
    const { data: row, error } = await (context.supabase.from("metas_mensais") as any).insert(payload).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removerMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await context.supabase.from("metas_mensais").delete().eq("id", data.id);
    return { ok: true };
  });

export const listMinhasMetas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await ensureComissoesModule(context.supabase, context.userId);
    } catch (err: any) {
      if (err.status === 403) return [];
      throw err;
    }
    const { data } = await context.supabase
      .from("metas_mensais")
      .select("*")
      .eq("consultor_id", context.userId)
      .order("data_inicio", { ascending: false });
    return data ?? [];
  });


async function ensureAdminOrGestor(supabase: any, userId: string) {
  const { data: a } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (a) return;
  const { data: g } = await supabase.rpc("has_role", { _user_id: userId, _role: "gestor" });
  if (!g) throw new Error("Forbidden");
}

export const listFechamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("comissao_fechamentos")
      .select("*")
      .order("ano", { ascending: false })
      .order("mes", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getFechamento = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    const { data: f } = await context.supabase
      .from("comissao_fechamentos")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    const { data: itens } = await context.supabase
      .from("comissao_itens")
      .select("*, vendas(numero, cliente_razao_social, operadora), profiles:consultor_id(nome_completo)")
      .eq("fechamento_id", data.id)
      .order("valor_comissao", { ascending: false });
    return { fechamento: f, itens: itens ?? [] };
  });

export const criarFechamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ano: number; mes: number }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("comissao_fechamentos")
      .insert({ ano: data.ano, mes: data.mes })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const fecharPeriodo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("comissao_fechamentos")
      .update({ status: "fechado", fechado_por: context.userId, fechado_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const marcarPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("comissao_fechamentos")
      .update({ status: "pago", pago_em: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const ajustarItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; ajuste_manual?: number; observacao?: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    const patch: { ajuste_manual?: number; observacao?: string } = {};
    if (typeof data.ajuste_manual === "number") patch.ajuste_manual = data.ajuste_manual;
    if (data.observacao !== undefined) patch.observacao = data.observacao;
    const { error } = await context.supabase.from("comissao_itens").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMinhasComissoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      await ensureComissoesModule(context.supabase, context.userId);
    } catch (err: any) {
      if (err.status === 403) return [];
      throw err;
    }
    const { data, error } = await context.supabase
      .from("comissao_itens")
      .select("*, vendas(numero, cliente_razao_social, operadora), comissao_fechamentos(ano, mes, status)")
      .eq("consultor_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listRegras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    const { data } = await context.supabase
      .from("comissao_regras")
      .select("*, profiles:consultor_id(nome_completo)")
      .order("vigencia_inicio", { ascending: false });
    return data ?? [];
  });

export const salvarRegra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    nome: string;
    consultor_id?: string | null;
    operadora?: string | null;
    produto?: string | null;
    tipo_pedido?: string | null;
    valor_min?: number;
    valor_max?: number | null;
    percentual: number;
    bonus_fixo?: number;
    vigencia_inicio: string;
    vigencia_fim?: string | null;
    ativo?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    const payload = {
      nome: data.nome,
      consultor_id: data.consultor_id || null,
      operadora: data.operadora || null,
      produto: data.produto || null,
      tipo_pedido: data.tipo_pedido || null,
      valor_min: data.valor_min ?? 0,
      valor_max: data.valor_max ?? null,
      percentual: data.percentual,
      bonus_fixo: data.bonus_fixo ?? 0,
      vigencia_inicio: data.vigencia_inicio,
      vigencia_fim: data.vigencia_fim ?? null,
      ativo: data.ativo ?? true,
    };
    if (data.id) {
      const { error } = await context.supabase.from("comissao_regras").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("comissao_regras").insert(payload);
      if (error) throw new Error(error.message);
    }

    // Reaplica a regra a comissões pendentes (pendente_regra / pendente_confirmacao) que casarem
    const { data: pendentes } = await context.supabase
      .from("comissao_itens")
      .select("id, venda_id, status, vendas!inner(consultor_id, operadora, produto, tipo_pedido, valor)")
      .in("status", ["pendente_regra", "pendente_confirmacao"]);

    let recalculadas = 0;
    for (const it of (pendentes ?? []) as any[]) {
      const v = it.vendas;
      if (!v) continue;
      if (payload.consultor_id && payload.consultor_id !== v.consultor_id) continue;
      if (payload.operadora && payload.operadora !== v.operadora) continue;
      if (payload.produto && payload.produto !== v.produto) continue;
      if (payload.tipo_pedido && payload.tipo_pedido !== v.tipo_pedido) continue;
      const valorVenda = Number(v.valor ?? 0);
      if (valorVenda < (payload.valor_min ?? 0)) continue;
      if (payload.valor_max != null && valorVenda > payload.valor_max) continue;

      const { data: calc } = await (context.supabase.rpc as any)("calc_comissao_venda", { _venda_id: it.venda_id });
      const r = Array.isArray(calc) ? calc[0] : calc;
      if (!r || !r.regra_id) continue;

      const novoValor = Number(r.valor ?? 0);
      const novoStatus = it.status === "pendente_regra" ? "pendente_confirmacao" : it.status;
      const { error: upErr } = await (context.supabase.from("comissao_itens") as any).update({
        regra_id: r.regra_id,
        percentual_aplicado: r.percentual,
        bonus_fixo: r.bonus,
        valor_comissao: novoValor,
        sem_regra: false,
        status: novoStatus,
      }).eq("id", it.id);
      if (upErr) continue;
      recalculadas++;

      await context.supabase.from("venda_historico").insert({
        venda_id: it.venda_id,
        tipo: "observacao",
        descricao: `Comissão recalculada após edição de regra "${payload.nome}" — Valor: R$ ${novoValor.toFixed(2)}`,
        user_id: context.userId,
        user_nome: "Sistema (regra atualizada)",
      });
    }

    return { ok: true, recalculadas };
  });

export const removerRegra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    await context.supabase.from("comissao_regras").delete().eq("id", data.id);
    return { ok: true };
  });

export const aplicarRegraEmComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: string; regra_id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    const { data: prof } = await context.supabase.from("profiles").select("nome_completo").eq("id", context.userId).maybeSingle();
    const nome = (prof as any)?.nome_completo ?? "Gestor";

    const { data: item } = await context.supabase
      .from("comissao_itens").select("id, venda_id, base_calculo, status").eq("id", data.item_id).maybeSingle();
    if (!item) throw new Error("Comissão não encontrada");

    const { data: regra } = await context.supabase
      .from("comissao_regras").select("id, nome, percentual, bonus_fixo, ativo").eq("id", data.regra_id).maybeSingle();
    if (!regra) throw new Error("Regra não encontrada");

    const base = Number((item as any).base_calculo ?? 0);
    const pct = Number((regra as any).percentual ?? 0);
    const bonus = Number((regra as any).bonus_fixo ?? 0);
    const valor = Math.round((base * pct / 100 + bonus) * 100) / 100;

    const novoStatus = (item as any).status === "pendente_regra" ? "pendente_confirmacao" : (item as any).status;
    const { error } = await (context.supabase.from("comissao_itens") as any).update({
      regra_id: regra.id, percentual_aplicado: pct, bonus_fixo: bonus, valor_comissao: valor,
      sem_regra: false, status: novoStatus,
    }).eq("id", data.item_id);
    if (error) throw new Error(error.message);

    await context.supabase.from("venda_historico").insert({
      venda_id: (item as any).venda_id, tipo: "observacao",
      descricao: `Regra de comissão aplicada manualmente: "${(regra as any).nome}" — ${pct.toFixed(2)}% — Valor: R$ ${valor.toFixed(2)}`,
      user_id: context.userId, user_nome: nome,
    });

    return { ok: true, valor, percentual: pct };
  });

// ============== AUTOMAÇÃO: Comissões pendentes (Ativado 100%) ==============


export const listComissoesPendentes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("comissao_itens")
      .select("*, vendas(id, numero, cliente_razao_social, operadora, produto, tipo_pedido, quantidade_linhas, valor, consultor_nome, data_ativacao, status_pedido), profiles:consultor_id(nome_completo), metas_mensais:meta_id(id, nome, status, valor_meta, valor_vendido, data_inicio, data_fim)")
      .in("status", ["pendente_confirmacao", "pendente_regra"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listComissoesAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("comissao_itens")
      .select("*, vendas(id, numero, cliente_razao_social, operadora, produto, tipo_pedido, quantidade_linhas, valor, consultor_nome, data_ativacao, status_pedido), profiles:consultor_id(nome_completo), metas_mensais:meta_id(id, nome, status, valor_meta, valor_vendido, data_inicio, data_fim)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const confirmarComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; observacao?: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    const { data: prof } = await context.supabase.from("profiles").select("nome_completo").eq("id", context.userId).maybeSingle();
    const nome = (prof as any)?.nome_completo ?? "Gestor";

    const { data: item, error: e1 } = await context.supabase
      .from("comissao_itens")
      .select("id, venda_id, valor_comissao, status, sem_regra, base_calculo, percentual_aplicado, meta_id")
      .eq("id", data.id).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!item) throw new Error("Comissão não encontrada");
    const st = (item as any).status;
    if (st === "confirmada" || st === "paga") throw new Error("Esta comissão já foi confirmada.");
    if ((item as any).sem_regra) throw new Error("Cadastre a regra de comissão antes de confirmar.");

    const patch: any = {
      status: "confirmada",
      confirmada_por: context.userId,
      confirmada_por_nome: nome,
      confirmada_em: new Date().toISOString(),
    };
    if (data.observacao) patch.observacao = data.observacao;

    const { error: e2 } = await (context.supabase.from("comissao_itens") as any).update(patch).eq("id", data.id);
    if (e2) throw new Error(e2.message);

    await context.supabase.from("venda_historico").insert({
      venda_id: (item as any).venda_id,
      tipo: "observacao",
      descricao: `Comissão confirmada — Gestor: ${nome} — Valor: R$ ${Number((item as any).valor_comissao || 0).toFixed(2)}` + (data.observacao ? ` — Obs: ${data.observacao}` : ""),
      user_id: context.userId,
      user_nome: nome,
    });
    return { ok: true };
  });

export const cancelarComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; motivo?: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    await ensureAdminOrGestor(context.supabase, context.userId);
    const { data: prof } = await context.supabase.from("profiles").select("nome_completo").eq("id", context.userId).maybeSingle();
    const nome = (prof as any)?.nome_completo ?? "Gestor";

    const { data: item } = await context.supabase
      .from("comissao_itens").select("id, venda_id, status").eq("id", data.id).maybeSingle();
    if (!item) throw new Error("Comissão não encontrada");
    if ((item as any).status === "paga") throw new Error("Não é possível cancelar uma comissão já paga.");

    const { error } = await (context.supabase.from("comissao_itens") as any).update({
      status: "cancelada",
      observacao: data.motivo ? `Cancelada: ${data.motivo}` : "Cancelada pelo gestor",
    }).eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("venda_historico").insert({
      venda_id: (item as any).venda_id,
      tipo: "observacao",
      descricao: `Comissão CANCELADA — Gestor: ${nome}${data.motivo ? ` — Motivo: ${data.motivo}` : ""}`,
      user_id: context.userId,
      user_nome: nome,
    });
    return { ok: true };
  });

export const listComissoesByUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { consultor_id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    const { data: a } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!a && context.userId !== data.consultor_id) {
       const { data: g } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "gestor" });
       if (!g) throw new Error("Forbidden");
    }
    const { data: list } = await context.supabase
      .from("comissao_itens")
      .select("*, vendas(numero, cliente_razao_social, operadora, produto)")
      .eq("consultor_id", data.consultor_id)
      .order("created_at", { ascending: false });
    return list ?? [];
  });

export const getComissaoByVenda = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { venda_id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("comissao_itens").select("*").eq("venda_id", data.venda_id).maybeSingle();
    return row;
  });

export const excluirComissao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; motivo: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureComissoesModule(context.supabase, context.userId);
    
    // 1. Validar permissão (Apenas Admin por enquanto, conforme pedido)
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) {
       throw new Response("Você não tem permissão para excluir comissões.", { status: 403 });
    }

    // 2. Buscar detalhes para auditoria e log
    const { data: comissao } = await context.supabase
      .from("comissao_itens")
      .select("*, vendas(numero, cliente_razao_social), profiles:consultor_id(nome_completo)")
      .eq("id", data.id)
      .maybeSingle();
      
    if (!comissao) throw new Error("Comissão não encontrada");

    const { data: prof } = await context.supabase.from("profiles").select("nome_completo").eq("id", context.userId).maybeSingle();
    const nomeExcluidor = (prof as any)?.nome_completo ?? "Administrador";

    // 3. Exclusão lógica (assumindo que as colunas existem ou falhará graciosamente se precisarmos de migração)
    // De acordo com o pedido, preencher deleted_at, deleted_by, etc.
    // Se a tabela não tiver essas colunas, o update falhará. Vou assumir que precisamos da migração.
    const { error: deleteErr } = await context.supabase
      .from("comissao_itens")
      .update({
        status: "cancelada", // Usando status cancelada como fallback se is_deleted não existir
        observacao: `EXCLUÍDA: ${data.motivo}`,
        // Colunas de auditoria lógica sugeridas
        deleted_at: new Date().toISOString(),
        deleted_by: context.userId,
        deletion_reason: data.motivo
      } as any)
      .eq("id", data.id);

    if (deleteErr) throw new Error(deleteErr.message);

    // 4. Auditoria na venda
    await context.supabase.from("venda_historico").insert({
      venda_id: comissao.venda_id,
      tipo: "observacao",
      descricao: `Comissão EXCLUÍDA (Removida dos totais) — Motivo: ${data.motivo} — Por: ${nomeExcluidor}`,
      user_id: context.userId,
      user_nome: nomeExcluidor,
    });

    return { ok: true };
  });
