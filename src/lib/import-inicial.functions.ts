import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface PayloadCliente {
  cnpj: string;
  razao_social: string;
  uf: string | null;
  ddd: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  operadora: "CLARO" | "VIVO";
}
interface PayloadColab {
  nome_normalizado: string;
  nome_exibicao: string;
  funcao: string;
  operadora: "CLARO" | "VIVO";
}
interface PayloadVenda {
  arquivo: string;
  aba: string;
  linha: number;
  operadora: "CLARO" | "VIVO";
  mes_ref: number;
  ano_ref: number;
  numero: string;
  cnpj: string;
  razao_social: string;
  uf: string | null;
  ddd: string | null;
  contato: string | null;
  telefone: string | null;
  email: string | null;
  status: string | null;
  tipo_pedido: string | null;
  produto: string | null;
  quantidade_linhas: number;
  valor: number;
  consultor_nome: string | null;
  bko_nome: string | null;
  data_recebimento: string | null;
  data_preenchimento: string | null;
  data_envio: string | null;
  data_aceite: string | null;
  data_input: string | null;
  data_ativacao: string | null;
  data_portabilidade: string | null;
  data_entrega: string | null;
  status_portabilidade: string | null;
  cotacao: string | null;
  numero_pedido: string | null;
  nota_fiscal: string | null;
  cod_rastreio: string | null;
  serie: string | null;
  equipamentos: string | null;
  observacao: string | null;
  dados_originais: Record<string, unknown>;
  funil: "prospeccao" | "followup" | "assinatura" | "suporte";
  etapa_id: string;
}
interface PayloadCatalogo {
  status: { operadora: string; nome: string; descricao?: string | null; sla_horas?: number | null; cor?: string | null; tipo?: string | null }[];
  produtos: { operadora: string; nome: string }[];
  tipos: { operadora: string; nome: string }[];
}
interface PayloadErro {
  arquivo: string; aba: string; linha: number; coluna: string; valor: string; motivo: string;
}

export const gravarImportacaoInicial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    arquivos: string[];
    clientes: PayloadCliente[];
    colaboradores: PayloadColab[];
    catalogo: PayloadCatalogo;
    vendas: PayloadVenda[];
    erros: PayloadErro[];
  }) => d)
  .handler(async ({ data, context }) => {
    // só admin
    const { data: isAdm } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdm) throw new Error("Acesso restrito ao administrador");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Cria run
    const { data: runRow, error: runErr } = await supabaseAdmin
      .from("import_runs")
      .insert({
        user_id: context.userId,
        arquivos: data.arquivos as any,
        status: "em_andamento",
      })
      .select("id")
      .single();
    if (runErr) throw new Error("Falha ao registrar rodada: " + runErr.message);
    const runId = runRow.id as string;

    // 2. Catálogos (upsert por (operadora, nome))
    if (data.catalogo.status.length > 0) {
      const rows = dedupBy(
        data.catalogo.status.map(s => ({
          operadora: s.operadora, nome: s.nome,
          descricao: s.descricao ?? null, sla_horas: s.sla_horas ?? null,
          cor: s.cor ?? null, tipo: s.tipo ?? null, ativo: true,
        })),
        r => `${r.operadora}|${r.nome.toUpperCase()}`,
      );
      await supabaseAdmin.from("status_catalogo").upsert(rows, { onConflict: "operadora,nome", ignoreDuplicates: false });
    }
    if (data.catalogo.produtos.length > 0) {
      const rows = dedupBy(data.catalogo.produtos.map(p => ({ ...p, ativo: true })), r => `${r.operadora}|${r.nome.toUpperCase()}`);
      await supabaseAdmin.from("produtos_catalogo").upsert(rows, { onConflict: "operadora,nome" });
    }
    if (data.catalogo.tipos.length > 0) {
      const rows = dedupBy(data.catalogo.tipos.map(t => ({ ...t, ativo: true })), r => `${r.operadora}|${r.nome.toUpperCase()}`);
      await supabaseAdmin.from("tipos_pedido_catalogo").upsert(rows, { onConflict: "operadora,nome" });
    }

    // 3. Clientes — upsert por cnpj_cpf (quando existir); senão, lookup por razao+uf+ddd
    const clientesByCnpj = new Map<string, string>(); // cnpj -> id
    const clientesByKey = new Map<string, string>(); // razao|uf|ddd -> id
    const clientesAgrupados = dedupBy(
      data.clientes,
      c => c.cnpj || `_${c.razao_social}|${c.uf ?? ""}|${c.ddd ?? ""}`,
    );

    for (const batch of chunk(clientesAgrupados, 500)) {
      const withCnpj = batch.filter(c => c.cnpj);
      const noCnpj = batch.filter(c => !c.cnpj);

      if (withCnpj.length > 0) {
        const payload = withCnpj.map(c => ({
          cnpj_cpf: c.cnpj,
          razao_social: c.razao_social,
          uf: c.uf, ddd: c.ddd, contato: c.contato,
          telefone: c.telefone, email: c.email,
          operadoras: [c.operadora] as any,
        }));
        const { data: rows, error } = await supabaseAdmin
          .from("clientes")
          .upsert(payload, { onConflict: "cnpj_cpf" })
          .select("id, cnpj_cpf");
        if (error) throw new Error("Erro clientes: " + error.message);
        rows?.forEach(r => clientesByCnpj.set(r.cnpj_cpf!, r.id));
      }
      for (const c of noCnpj) {
        const lookupKey = `${c.razao_social}|${c.uf ?? ""}|${c.ddd ?? ""}`;
        const { data: ex } = await supabaseAdmin
          .from("clientes")
          .select("id")
          .eq("razao_social", c.razao_social)
          .eq("uf", c.uf ?? "")
          .eq("ddd", c.ddd ?? "")
          .maybeSingle();
        if (ex) { clientesByKey.set(lookupKey, ex.id); continue; }
        const { data: ins } = await supabaseAdmin
          .from("clientes")
          .insert({
            razao_social: c.razao_social, uf: c.uf, ddd: c.ddd,
            contato: c.contato, telefone: c.telefone, email: c.email,
            operadoras: [c.operadora] as any,
          })
          .select("id")
          .single();
        if (ins) clientesByKey.set(lookupKey, ins.id);
      }
    }

    // 4. Colaboradores
    const colabByKey = new Map<string, string>();
    const colabAgr = dedupBy(data.colaboradores, c => c.nome_normalizado);
    for (const batch of chunk(colabAgr, 500)) {
      const payload = batch.map(c => ({
        nome_normalizado: c.nome_normalizado,
        nome_exibicao: c.nome_exibicao,
        funcao: c.funcao,
        operadoras: [c.operadora] as any,
        ativo: true,
        origem: "importacao_inicial",
      }));
      const { data: rows, error } = await supabaseAdmin
        .from("colaboradores")
        .upsert(payload, { onConflict: "nome_normalizado" })
        .select("id, nome_normalizado");
      if (error) throw new Error("Erro colaboradores: " + error.message);
      rows?.forEach(r => colabByKey.set(r.nome_normalizado, r.id));
    }

    // 5. Vendas
    let totalIns = 0;
    let totalDup = 0;
    for (const batch of chunk(data.vendas, 250)) {
      const payload = batch.map(v => {
        const cid = v.cnpj
          ? clientesByCnpj.get(v.cnpj)
          : clientesByKey.get(`${v.razao_social}|${v.uf ?? ""}|${v.ddd ?? ""}`);
        const consId = v.consultor_nome ? colabByKey.get(normalizeColab(v.consultor_nome)) : null;
        const bkoId = v.bko_nome ? colabByKey.get(normalizeColab(v.bko_nome)) : null;
        return {
          numero: v.numero,
          operadora: v.operadora as any,
          mes_ref: v.mes_ref,
          ano_ref: v.ano_ref,
          cliente_razao_social: v.razao_social,
          cliente_cnpj: v.cnpj || "SEM-DOC",
          cliente_contato: v.contato,
          cliente_telefone: v.telefone,
          cliente_email: v.email,
          cliente_uf: v.uf,
          ddd: v.ddd,
          funil: v.funil as any,
          etapa_id: v.etapa_id,
          status: v.status,
          tipo_pedido: v.tipo_pedido,
          produto: v.produto,
          quantidade_linhas: v.quantidade_linhas,
          valor: v.valor,
          consultor_nome: v.consultor_nome,
          bko_nome: v.bko_nome,
          data_recebimento: v.data_recebimento,
          data_preenchimento: v.data_preenchimento,
          data_envio: v.data_envio,
          data_aceite: v.data_aceite,
          data_input: v.data_input,
          data_ativacao: v.data_ativacao,
          data_portabilidade: v.data_portabilidade,
          data_entrega: v.data_entrega,
          status_portabilidade: v.status_portabilidade,
          cotacao: v.cotacao,
          numero_pedido: v.numero_pedido,
          nota_fiscal: v.nota_fiscal,
          cod_rastreio: v.cod_rastreio,
          serie: v.serie,
          equipamentos: v.equipamentos,
          observacao: v.observacao,
          dados_originais: v.dados_originais as any,
          arquivo_origem: v.arquivo,
          aba_origem: v.aba,
          linha_origem: v.linha,
          cliente_id: cid ?? null,
          consultor_colab_id: consId ?? null,
          bko_colab_id: bkoId ?? null,
          created_by: context.userId,
        };
      });
      const { error, count } = await supabaseAdmin
        .from("vendas")
        .upsert(payload, { onConflict: "operadora,cliente_cnpj,mes_ref,ano_ref,numero", count: "exact" });
      if (error) {
        // grava erro mas continua
        await supabaseAdmin.from("import_erros").insert(
          batch.map(v => ({
            run_id: runId, arquivo: v.arquivo, aba: v.aba, linha: v.linha,
            coluna: "(batch)", valor: v.numero, motivo: error.message,
          })),
        );
      } else {
        totalIns += count ?? payload.length;
      }
    }

    // 6. Erros de importação
    if (data.erros.length > 0) {
      const rows = data.erros.map(e => ({ ...e, run_id: runId }));
      for (const b of chunk(rows, 500)) {
        await supabaseAdmin.from("import_erros").insert(b);
      }
    }

    const totais = {
      arquivos: data.arquivos,
      clientes: clientesAgrupados.length,
      colaboradores: colabAgr.length,
      vendas_recebidas: data.vendas.length,
      vendas_gravadas: totalIns,
      vendas_duplicadas: Math.max(0, data.vendas.length - totalIns),
      catalogo_status: data.catalogo.status.length,
      catalogo_produtos: data.catalogo.produtos.length,
      catalogo_tipos: data.catalogo.tipos.length,
      erros: data.erros.length,
    };
    totalDup = totais.vendas_duplicadas;

    await supabaseAdmin.from("import_runs").update({ status: "concluido", totais: totais as any }).eq("id", runId);
    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      acao: "import_inicial",
      descricao: `Importação inicial: ${totais.vendas_gravadas} vendas, ${totais.clientes} clientes, ${totais.colaboradores} colaboradores`,
      entidade: "import_run",
      entidade_id: runId,
      valor_novo: totais as any,
    });

    return { runId, totais };
  });

function dedupBy<T>(arr: T[], keyFn: (x: T) => string): T[] {
  const m = new Map<string, T>();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, x);
  }
  return Array.from(m.values());
}
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
function normalizeColab(nome: string): string {
  return nome
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, " ").trim();
}
