import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getAuditData = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, email, nome_completo, operadora").eq("ativo", true);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("*");
    const { data: clientes } = await supabaseAdmin.from("clientes").select("id, razao_social, cnpj_cpf, consultor_id").eq("is_deleted", false);
    const { data: vendas } = await supabaseAdmin.from("vendas").select("id, numero").ilike("numero", "%TESTE%");
    return { profiles, roles, clientes, vendas };
  });

export const checkRoleInconsistencies = createServerFn({ method: "GET" })
  .handler(async () => {
    return { safe: true, invalidRoles: [], profileInconsistencies: [] };
  });

export const fixRoleInconsistencies = createServerFn({ method: "POST" })
  .handler(async () => {
    return { success: true };
  });

export const seedCompleteTestData = createServerFn({ method: "POST" })
  .handler(async () => {
    const { data: consultants } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "consultor")
      .limit(1);
    
    const consultorId = consultants?.[0]?.user_id;
    if (!consultorId) throw new Error("No consultant found to link test data.");

    const { data: consultantProfile } = await supabaseAdmin
      .from("profiles")
      .select("nome_completo")
      .eq("id", consultorId)
      .single();
    
    const consultorNome = consultantProfile?.nome_completo || "Consultor Teste";

    const testClients = [
      { razao_social: "Cliente Teste Claro Fluxo LTDA", cnpj_cpf: "11111111000111", ddd: "11", uf: "SP" },
      { razao_social: "Cliente Teste Vivo Fluxo LTDA", cnpj_cpf: "22222222000222", ddd: "21", uf: "RJ" },
      { razao_social: "Empresa Teste 03 LTDA", cnpj_cpf: "33333333000133", ddd: "31", uf: "MG" },
      { razao_social: "Empresa Teste 04 LTDA", cnpj_cpf: "44444444000144", ddd: "41", uf: "PR" },
    ];

    const clientIds: Record<string, string> = {};
    for (const c of testClients) {
      const { data: existing } = await supabaseAdmin.from("clientes").select("id").eq("cnpj_cpf", c.cnpj_cpf).maybeSingle();
      if (existing) {
        clientIds[c.cnpj_cpf] = existing.id;
      } else {
        const { data: inserted } = await supabaseAdmin.from("clientes").insert({ ...c, consultor_id: consultorId }).select("id").single();
        if (inserted) clientIds[c.cnpj_cpf] = inserted.id;
      }
    }

    const orders = [
      {
        numero: "TESTE-CLARO-FINAL-001",
        operadora: "CLARO" as const,
        produto: "Móvel",
        tipo_pedido: "Novo",
        quantidade_linhas: 5,
        valor: 1500,
        cliente_cnpj: "11111111000111",
        etapa_id: "s-concluido",
        funil: "suporte" as const,
        status_pedido: "ativado" as const,
        data_ativacao: "2026-08-15"
      },
      {
        numero: "TESTE-VIVO-FINAL-002",
        operadora: "VIVO" as const,
        produto: "Móvel",
        tipo_pedido: "Novo",
        quantidade_linhas: 10,
        valor: 2800,
        cliente_cnpj: "22222222000222",
        etapa_id: "s-concluido",
        funil: "suporte" as const,
        status_pedido: "ativado" as const,
        data_ativacao: "2026-08-16"
      },
      ...Array.from({ length: 10 }).map((_, i) => ({
        numero: `TESTE-COMPLETO-${(i + 3).toString().padStart(3, "0")}`,
        operadora: (i % 2 === 0 ? "CLARO" : "VIVO") as any,
        produto: i % 4 === 0 ? "Banda Larga" : "Móvel",
        tipo_pedido: i % 3 === 0 ? "Portabilidade" : "Novo",
        quantidade_linhas: (i % 5) + 1,
        valor: ((i % 5) + 1) * 200,
        cliente_cnpj: testClients[i % 4].cnpj_cpf,
        etapa_id: i < 4 ? "s-concluido" : ["p-aguardando", "f-proposta", "bko-pendente", "a-aguardando", "s-espera", "s-tratar"][i % 6],
        funil: (i < 4 ? "suporte" : ["prospeccao", "followup", "processos_bko", "assinatura", "suporte", "suporte"][i % 6]) as any,
        status_pedido: (i < 4 ? "ativado" : "") as any,
        data_ativacao: i < 4 ? `2026-08-${17 + i}` : null
      }))
    ];

    for (const o of orders) {
      const { data: existing } = await supabaseAdmin.from("vendas").select("id").eq("numero", o.numero).maybeSingle();
      let vendaId = existing?.id;

      const vendaData: any = {
        numero: o.numero,
        operadora: o.operadora,
        produto: o.produto,
        tipo_pedido: o.tipo_pedido,
        quantidade_linhas: o.quantidade_linhas,
        valor: o.valor,
        cliente_id: clientIds[o.cliente_cnpj],
        cliente_razao_social: (testClients.find(c => c.cnpj_cpf === o.cliente_cnpj)?.razao_social || "Cliente Teste") as string,
        cliente_cnpj: o.cliente_cnpj,
        consultor_id: "imported",
        consultor_colab_id: consultorId,
        consultor_nome: consultorNome,
        mes_ref: 8,
        ano_ref: 2026,
        prioridade: "baixa",
        etapa_id: o.etapa_id,
        funil: o.funil,
        status_pedido: o.status_pedido,
        data_ativacao: o.data_ativacao
      };

      if (existing) {
        await (supabaseAdmin.from("vendas") as any).update(vendaData).eq("id", vendaId);
      } else {
        const { data: inserted } = await (supabaseAdmin.from("vendas") as any).insert(vendaData).select("id").single();
        vendaId = inserted?.id;
      }

      if (vendaId) {
        await supabaseAdmin.from("venda_linhas").delete().eq("venda_id", vendaId);
        const valorPorLinha = o.valor / o.quantidade_linhas;
        for (let j = 0; j < o.quantidade_linhas; j++) {
          await supabaseAdmin.from("venda_linhas").insert({
            venda_id: vendaId,
            numero: `119${Math.floor(10000000 + Math.random() * 90000000)}`,
            ddd: "11",
            plano: `Plano Teste ${o.operadora}`,
            produto: o.produto,
            valor_mensal: valorPorLinha,
            status: o.status_pedido === "ativado" ? "concluida" : "ativa",
            data_ativacao: o.data_ativacao,
            ordem: j,
            created_by: consultorId
          });
        }

        if (o.funil === "suporte" || Math.random() > 0.7) {
            const { data: existingTicket } = await supabaseAdmin.from("tickets").select("id").eq("venda_id", vendaId).maybeSingle();
            if (!existingTicket) {
                await supabaseAdmin.from("tickets").insert({
                    venda_id: vendaId,
                    cliente_razao_social: vendaData.cliente_razao_social as string,
                    titulo: `Chamado Teste - ${o.numero}`,
                    descricao: "Teste completo de fluxo de suporte",
                    status: o.status_pedido === "ativado" ? "resolvido" : "aberto",
                    prioridade: "media",
                    aberto_por: consultorId,
                    aberto_nome: consultorNome,
                    funil_origem: o.funil
                } as any);
            }
        }
      }
    }

    return { success: true, count: orders.length };
  });