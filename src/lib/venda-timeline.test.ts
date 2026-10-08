import { describe, expect, test } from "bun:test";
import { buildVendaTimeline } from "./venda-timeline";

const structure = {
  funis: [
    { id: "processos_bko", nome: "Processos BKO" },
    { id: "assinatura", nome: "Assinatura" },
  ],
  etapas: [
    { id: "bko-montar", nome: "Montar Pedido", funil_id: "processos_bko" },
    { id: "a-assinado", nome: "Contrato Assinado - Claro", funil_id: "assinatura" },
  ],
};

describe("buildVendaTimeline", () => {
  test("mescla todas as fontes e ordena do evento mais recente para o mais antigo", () => {
    const items = buildVendaTimeline({
      vendaHistorico: [{
        id: "h1", created_at: "2026-09-17T10:00:00Z", tipo: "criacao", campo: null,
        valor_anterior: null, valor_novo: null, descricao: "Venda criada", user_nome: "Natalia",
      }],
      statusComercial: [{
        id: "s1", venda_id: "v1", status_id: "st1", status_nome_snapshot: "AUDITORIA",
        user_id: "u1", user_nome: "Mariana", user_role: "bko", observacao: "Conferência documental",
        operadora_snapshot: "VIVO", sla_horas_snapshot: 72, sla_inicio_em: "2026-09-17T11:00:00Z",
        sla_metade_em: null, sla_limite_em: null, created_at: "2026-09-17T11:00:00Z",
      }],
      observacoes: [{
        id: "o1", venda_id: "v1", texto: "Cliente confirmou os dados", autor_nome: "Pablo",
        autor_perfil: "admin", created_at: "2026-09-17T12:00:00Z", tag_nome_snapshot: "Cliente",
      }],
      notaVersoes: [{
        id: "n1", venda_id: "v1", tipo: "manual", conteudo: "Nota atualizada pelo administrativo",
        user_nome: "Pablo", created_at: "2026-09-17T13:00:00Z",
      }],
      documentos: [{
        id: "d1", venda_id: "v1", titulo: "Contrato", arquivo_nome_original: "contrato.pdf",
        created_by_nome: "Mariana", created_at: "2026-09-17T14:00:00Z", deleted_at: null, deleted_by_nome: null,
      }],
      erros: [{
        id: "e1", erro_nome: "Cadastro divergente", observacao: "CPF inválido", created_at: "2026-09-17T15:00:00Z",
        created_by_nome: "Mariana", resolvido: false, resolvido_em: null, resolvido_por_nome: null,
      }],
      suporteSolicitacoes: [{
        id: "req1", numero: "SOL-2026-000001", motivo: "Validar ativação", prioridade: "alta",
        criado_por_nome: "Pablo", created_at: "2026-09-17T16:00:00Z",
      }],
      suporteEventos: [{
        id: "se1", solicitacao_id: "req1", tipo: "card_criado", descricao: "Card de atendimento criado.",
        user_nome: "Mariana", user_role: "bko", dados: {}, created_at: "2026-09-17T16:30:00Z",
      }],
      suporteMensagens: [{
        id: "sm1", solicitacao_id: "req1", autor_nome: "Pablo", autor_role: "consultor",
        mensagem: "Segue retorno do cliente", anexos: [], created_at: "2026-09-17T17:00:00Z",
      }],
      suporteInformacoes: [{
        id: "si1", solicitacao_id: "req1", informacao: "Protocolo 123", created_by_nome: "Mariana",
        created_by_role: "bko", created_at: "2026-09-17T17:30:00Z",
      }],
      suporteDocumentos: [{
        id: "sd1", solicitacao_id: "req1", titulo: "Protocolo", arquivo_nome_original: "protocolo.pdf",
        created_by_nome: "Mariana", created_by_role: "bko", created_at: "2026-09-17T18:00:00Z",
        deleted_at: null, deleted_by_nome: null,
      }],
    }, structure);

    expect(items).toHaveLength(11);
    expect(items[0].source).toBe("suporte_documento");
    expect(items.at(-1)?.source).toBe("pedido");
    expect(items.map(i => i.createdAt)).toEqual([...items.map(i => i.createdAt)].sort().reverse());
  });

  test("consolida movimentação de funil e etapa no mesmo instante em um único evento amigável", () => {
    const at = "2026-09-17T12:48:44.320681Z";
    const items = buildVendaTimeline({
      vendaHistorico: [
        {
          id: "mov", created_at: at, tipo: "funil", campo: "movimentacao_pipeline",
          valor_anterior: "processos_bko / bko-montar", valor_novo: "assinatura / a-assinado",
          descricao: "Movimentação manual confirmada no Pipeline.", user_nome: "Mariana",
        },
        {
          id: "funil", created_at: at, tipo: "funil", campo: "funil", valor_anterior: "processos_bko",
          valor_novo: "assinatura", descricao: "Funil: processos_bko → assinatura", user_nome: "Mariana",
        },
        {
          id: "etapa", created_at: at, tipo: "etapa", campo: "etapa_id", valor_anterior: "bko-montar",
          valor_novo: "a-assinado", descricao: "Etapa: bko-montar → a-assinado", user_nome: "Mariana",
        },
      ],
    }, structure);

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Pedido movido no Pipeline");
    expect(items[0].previous).toBe("Processos BKO / Montar Pedido");
    expect(items[0].next).toBe("Assinatura / Contrato Assinado - Claro");
  });

  test("mostra histórico de status comercial com status anterior, SLA e observação", () => {
    const items = buildVendaTimeline({
      statusComercial: [
        {
          id: "new", venda_id: "v1", status_id: "2", status_nome_snapshot: "FB - PENDÊNCIA COMERCIAL",
          user_id: "u1", user_nome: "Mariana", user_role: "bko", observacao: "Aguardando ajuste",
          operadora_snapshot: "CLARO", sla_horas_snapshot: 24, sla_inicio_em: null, sla_metade_em: null,
          sla_limite_em: null, created_at: "2026-09-17T12:44:12Z",
        },
        {
          id: "old", venda_id: "v1", status_id: "1", status_nome_snapshot: "AVA - TRAMITANDO CLARO",
          user_id: "u1", user_nome: "Mariana", user_role: "bko", observacao: null,
          operadora_snapshot: "CLARO", sla_horas_snapshot: null, sla_inicio_em: null, sla_metade_em: null,
          sla_limite_em: null, created_at: "2026-09-17T12:16:55Z",
        },
      ],
    }, structure);

    const newest = items[0];
    expect(newest.title).toBe("Status Comercial alterado");
    expect(newest.previous).toBe("AVA - TRAMITANDO CLARO");
    expect(newest.next).toBe("FB - PENDÊNCIA COMERCIAL");
    expect(newest.description).toContain("SLA: 24h");
    expect(newest.description).toContain("Aguardando ajuste");
  });

  test("evita duplicar documento e solicitação de suporte já representados por suas fontes próprias", () => {
    const items = buildVendaTimeline({
      vendaHistorico: [
        {
          id: "hd", created_at: "2026-09-17T12:00:00Z", tipo: "campo", campo: "documento_pedido",
          valor_anterior: null, valor_novo: "d1", descricao: "Documento adicionado: Contrato.", user_nome: "Mariana",
        },
        {
          id: "hs", created_at: "2026-09-17T13:00:01Z", tipo: "observacao", campo: null,
          valor_anterior: null, valor_novo: null,
          descricao: "Solicitação de suporte req1 criada sem mover o pedido: Validar ativação", user_nome: "Pablo",
        },
      ],
      documentos: [{
        id: "d1", venda_id: "v1", titulo: "Contrato", arquivo_nome_original: "contrato.pdf",
        created_by_nome: "Mariana", created_at: "2026-09-17T12:00:00Z", deleted_at: null, deleted_by_nome: null,
      }],
      suporteSolicitacoes: [{
        id: "req1", numero: "SOL-2026-000001", motivo: "Validar ativação", prioridade: "alta",
        criado_por_nome: "Pablo", created_at: "2026-09-17T13:00:00Z",
      }],
    }, structure);

    expect(items.filter(i => i.source === "documento")).toHaveLength(1);
    expect(items.filter(i => i.source === "suporte_solicitacao")).toHaveLength(1);
    expect(items).toHaveLength(2);
  });

  test("registra edição de observação como evento separado sem perder a criação", () => {
    const items = buildVendaTimeline({
      observacoes: [{
        id: "o-edit", venda_id: "v1", texto: "Texto revisado", autor_nome: "Pablo", autor_perfil: "admin",
        created_at: "2026-09-17T12:00:00Z", updated_at: "2026-09-17T12:05:00Z", tag_nome_snapshot: "Interno",
      }],
    }, structure);

    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Observação editada · Interno");
    expect(items[0].createdAt).toBe("2026-09-17T12:05:00Z");
    expect(items[1].title).toBe("Observação · Interno");
  });
});
