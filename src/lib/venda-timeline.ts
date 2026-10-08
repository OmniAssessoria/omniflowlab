export type TimelineSource =
  | "pedido"
  | "pipeline"
  | "status_comercial"
  | "observacao"
  | "nota"
  | "documento"
  | "erro"
  | "suporte_solicitacao"
  | "suporte_evento"
  | "suporte_mensagem"
  | "suporte_informacao"
  | "suporte_documento";

export type TimelineTone = "omni" | "info" | "success" | "warning" | "destructive" | "purple" | "muted-foreground";

export interface TimelineItem {
  id: string;
  source: TimelineSource;
  createdAt: string;
  title: string;
  description?: string | null;
  userName?: string | null;
  userRole?: string | null;
  previous?: string | null;
  next?: string | null;
  tone: TimelineTone;
  badge?: string | null;
}

export interface PipelineStructureForTimeline {
  funis?: Array<{ id: string; nome: string }>;
  etapas?: Array<{ id: string; nome: string; funil_id?: string | null; funil?: string | null }>;
}

export interface VendaTimelineSources {
  vendaHistorico?: any[];
  statusComercial?: any[];
  observacoes?: any[];
  notaVersoes?: any[];
  documentos?: any[];
  erros?: any[];
  suporteSolicitacoes?: any[];
  suporteEventos?: any[];
  suporteMensagens?: any[];
  suporteInformacoes?: any[];
  suporteDocumentos?: any[];
}

function slugLabel(value?: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  return raw
    .replace(/^[a-z]+-/, "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => {
      const low = part.toLowerCase();
      if (low === "bko") return "BKO";
      if (low === "omni") return "OMNI";
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function createLabels(structure: PipelineStructureForTimeline) {
  const funis = new Map((structure.funis ?? []).map(f => [f.id, f.nome]));
  const etapas = new Map((structure.etapas ?? []).map(e => [e.id, e.nome]));
  return {
    funil: (id?: string | null) => funis.get(String(id ?? "")) ?? slugLabel(id),
    etapa: (id?: string | null) => etapas.get(String(id ?? "")) ?? slugLabel(id),
  };
}

function splitDestination(value?: string | null): { funil?: string; etapa?: string } {
  const raw = String(value ?? "").trim();
  if (!raw) return {};
  const parts = raw.split("/").map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { funil: parts[0], etapa: parts.slice(1).join("/").trim() };
  return { etapa: raw };
}

function truncate(value?: string | null, max = 220): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function joinDescription(parts: Array<string | null | undefined>): string | null {
  const cleaned = parts.map(p => String(p ?? "").trim()).filter(Boolean);
  return cleaned.length ? cleaned.join(" · ") : null;
}

function supportNumberMap(rows: any[]) {
  return new Map(rows.map(row => [String(row.id), String(row.numero ?? row.id)]));
}

function normalizeVendaHistorico(
  rows: any[],
  structure: PipelineStructureForTimeline,
  documentos: any[],
  suporteSolicitacoes: any[],
): TimelineItem[] {
  const labels = createLabels(structure);
  const docIds = new Set(documentos.map(d => String(d.id)));
  const supportIds = suporteSolicitacoes.map(s => String(s.id));
  const movementTimes = new Set(
    rows.filter(row => row?.campo === "movimentacao_pipeline").map(row => String(row.created_at)),
  );

  const result: TimelineItem[] = [];
  for (const row of rows) {
    const createdAt = String(row.created_at);
    const campo = row.campo == null ? null : String(row.campo);
    const tipo = String(row.tipo ?? "campo");
    const descricao = String(row.descricao ?? "").trim();

    if ((campo === "funil" || campo === "etapa_id") && movementTimes.has(createdAt)) continue;
    if (campo === "documento_pedido" && row.valor_novo && docIds.has(String(row.valor_novo))) continue;
    if (supportIds.some(id => descricao.includes(id) && /solicita[cç][aã]o de suporte/i.test(descricao))) continue;

    if (campo === "movimentacao_pipeline") {
      const from = splitDestination(row.valor_anterior);
      const to = splitDestination(row.valor_novo);
      result.push({
        id: `pedido:${row.id}`,
        source: "pipeline",
        createdAt,
        title: "Pedido movido no Pipeline",
        description: truncate(descricao),
        userName: row.user_nome ?? null,
        previous: `${labels.funil(from.funil)} / ${labels.etapa(from.etapa)}`,
        next: `${labels.funil(to.funil)} / ${labels.etapa(to.etapa)}`,
        tone: "purple",
        badge: "PIPELINE",
      });
      continue;
    }

    if (campo === "etapa_id") {
      result.push({
        id: `pedido:${row.id}`,
        source: "pipeline",
        createdAt,
        title: "Etapa alterada",
        description: truncate(descricao),
        userName: row.user_nome ?? null,
        previous: labels.etapa(row.valor_anterior),
        next: labels.etapa(row.valor_novo),
        tone: "purple",
        badge: "PIPELINE",
      });
      continue;
    }

    if (campo === "funil") {
      result.push({
        id: `pedido:${row.id}`,
        source: "pipeline",
        createdAt,
        title: "Funil alterado",
        description: truncate(descricao),
        userName: row.user_nome ?? null,
        previous: labels.funil(row.valor_anterior),
        next: labels.funil(row.valor_novo),
        tone: "purple",
        badge: "PIPELINE",
      });
      continue;
    }

    const title =
      tipo === "criacao" ? "Pedido criado" :
      campo === "concluido_em" ? (row.valor_novo ? "Pedido comercial concluído" : "Pedido comercial reaberto") :
      tipo === "valor" || campo === "valor" ? "Valor do pedido alterado" :
      campo === "documento_pedido" ? "Documento do pedido alterado" :
      tipo === "consultor" ? "Consultor alterado" :
      tipo === "bko" ? "BKO alterado" :
      tipo === "observacao" ? "Registro operacional" :
      campo ? `${slugLabel(campo)} alterado` : "Registro do pedido";

    const tone: TimelineTone =
      tipo === "criacao" ? "warning" :
      campo === "concluido_em" && row.valor_novo ? "success" :
      tipo === "valor" ? "success" :
      tipo === "consultor" || tipo === "bko" ? "info" :
      tipo === "observacao" ? "omni" : "muted-foreground";

    result.push({
      id: `pedido:${row.id}`,
      source: "pedido",
      createdAt,
      title,
      description: truncate(descricao),
      userName: row.user_nome ?? null,
      previous: row.valor_anterior ?? null,
      next: row.valor_novo ?? null,
      tone,
      badge: "PEDIDO",
    });
  }
  return result;
}

function normalizeStatus(rows: any[]): TimelineItem[] {
  const ordered = [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return ordered.map((row, index) => {
    const previous = index > 0 ? ordered[index - 1]?.status_nome_snapshot ?? null : null;
    const sla = row.sla_horas_snapshot != null ? `SLA: ${row.sla_horas_snapshot}h` : null;
    return {
      id: `status:${row.id}`,
      source: "status_comercial" as const,
      createdAt: String(row.created_at),
      title: previous ? "Status Comercial alterado" : "Status Comercial definido",
      description: joinDescription([
        row.observacao ? truncate(row.observacao) : null,
        sla,
        row.operadora_snapshot ? `Operadora: ${row.operadora_snapshot}` : null,
      ]),
      userName: row.user_nome ?? null,
      userRole: row.user_role ?? null,
      previous,
      next: row.status_nome_snapshot ?? null,
      tone: "omni" as const,
      badge: "STATUS COMERCIAL",
    };
  });
}

function normalizeObservacoes(rows: any[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const row of rows) {
    const suffix = row.tag_nome_snapshot ? ` · ${row.tag_nome_snapshot}` : "";
    items.push({
      id: `obs:${row.id}:created`,
      source: "observacao",
      createdAt: String(row.created_at),
      title: row.tag_nome_snapshot ? `Observação${suffix}` : "Observação adicionada",
      description: truncate(row.texto),
      userName: row.autor_nome ?? null,
      userRole: row.autor_perfil ?? null,
      tone: "omni",
      badge: "OBSERVAÇÃO",
    });

    const createdMs = new Date(row.created_at).getTime();
    const updatedMs = row.updated_at ? new Date(row.updated_at).getTime() : createdMs;
    if (Number.isFinite(updatedMs) && updatedMs - createdMs > 1000) {
      items.push({
        id: `obs:${row.id}:updated`,
        source: "observacao",
        createdAt: String(row.updated_at),
        title: `Observação editada${suffix}`,
        description: truncate(row.texto),
        userName: row.autor_nome ?? null,
        userRole: row.autor_perfil ?? null,
        tone: "omni",
        badge: "OBSERVAÇÃO",
      });
    }
  }
  return items;
}

function normalizeNotas(rows: any[]): TimelineItem[] {
  return rows.map(row => ({
    id: `nota:${row.id}`,
    source: "nota" as const,
    createdAt: String(row.created_at),
    title: row.tipo === "manual"
      ? "Nota do pedido salva manualmente"
      : row.tipo === "auto"
        ? "Nota automática regenerada"
        : "Versão da nota registrada",
    description: truncate(row.conteudo, 180),
    userName: row.user_nome ?? null,
    tone: "purple" as const,
    badge: "NOTA",
  }));
}

function normalizeDocuments(
  rows: any[],
  source: "documento" | "suporte_documento",
  supportNumbers?: Map<string, string>,
): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const row of rows) {
    const supportPrefix = source === "suporte_documento" && row.solicitacao_id
      ? `${supportNumbers?.get(String(row.solicitacao_id)) ?? "Suporte"} · `
      : "";
    items.push({
      id: `${source}:${row.id}:created`,
      source,
      createdAt: String(row.created_at),
      title: source === "documento" ? "Documento do pedido adicionado" : "Documento adicionado ao Suporte",
      description: `${supportPrefix}${row.titulo || "Documento"}${row.arquivo_nome_original ? ` (${row.arquivo_nome_original})` : ""}`,
      userName: row.created_by_nome ?? null,
      userRole: row.created_by_role ?? null,
      tone: "info",
      badge: source === "documento" ? "DOCUMENTO" : "SUPORTE",
    });
    if (row.deleted_at) {
      items.push({
        id: `${source}:${row.id}:deleted`,
        source,
        createdAt: String(row.deleted_at),
        title: source === "documento" ? "Documento do pedido excluído" : "Documento do Suporte excluído",
        description: `${supportPrefix}${row.titulo || "Documento"}${row.arquivo_nome_original ? ` (${row.arquivo_nome_original})` : ""}`,
        userName: row.deleted_by_nome ?? null,
        tone: "destructive",
        badge: source === "documento" ? "DOCUMENTO" : "SUPORTE",
      });
    }
  }
  return items;
}

function normalizeErros(rows: any[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const row of rows) {
    items.push({
      id: `erro:${row.id}:created`,
      source: "erro",
      createdAt: String(row.created_at),
      title: `Erro registrado${row.erro_nome ? ` · ${row.erro_nome}` : ""}`,
      description: truncate(row.observacao),
      userName: row.created_by_nome ?? null,
      tone: "destructive",
      badge: "ERRO",
    });
    if (row.resolvido && row.resolvido_em) {
      items.push({
        id: `erro:${row.id}:resolved`,
        source: "erro",
        createdAt: String(row.resolvido_em),
        title: `Erro resolvido${row.erro_nome ? ` · ${row.erro_nome}` : ""}`,
        description: truncate(row.observacao),
        userName: row.resolvido_por_nome ?? null,
        tone: "success",
        badge: "ERRO",
      });
    }
  }
  return items;
}

function normalizeSupport(sources: VendaTimelineSources): TimelineItem[] {
  const requests = sources.suporteSolicitacoes ?? [];
  const requestNumbers = supportNumberMap(requests);
  const items: TimelineItem[] = [];

  for (const row of requests) {
    items.push({
      id: `support-request:${row.id}`,
      source: "suporte_solicitacao",
      createdAt: String(row.created_at),
      title: `Solicitação de Suporte criada · ${row.numero ?? "Sem número"}`,
      description: joinDescription([
        truncate(row.motivo),
        row.prioridade ? `Prioridade: ${slugLabel(row.prioridade)}` : null,
      ]),
      userName: row.criado_por_nome ?? null,
      tone: "warning",
      badge: "SUPORTE",
    });
  }

  for (const row of sources.suporteEventos ?? []) {
    if (row.tipo === "solicitacao_criada") continue;
    const numero = requestNumbers.get(String(row.solicitacao_id));
    items.push({
      id: `support-event:${row.id}`,
      source: "suporte_evento",
      createdAt: String(row.created_at),
      title: `${numero ? `${numero} · ` : ""}${supportEventTitle(row.tipo)}`,
      description: truncate(row.descricao),
      userName: row.user_nome ?? null,
      userRole: row.user_role ?? null,
      tone: row.tipo === "concluido" ? "success" : row.tipo === "reaberto" ? "warning" : "info",
      badge: "SUPORTE",
    });
  }

  for (const row of sources.suporteMensagens ?? []) {
    const numero = requestNumbers.get(String(row.solicitacao_id));
    const anexos = Array.isArray(row.anexos) ? row.anexos.length : 0;
    items.push({
      id: `support-message:${row.id}`,
      source: "suporte_mensagem",
      createdAt: String(row.created_at),
      title: `${numero ? `${numero} · ` : ""}Mensagem no Suporte`,
      description: joinDescription([truncate(row.mensagem), anexos ? `${anexos} anexo(s)` : null]),
      userName: row.autor_nome ?? null,
      userRole: row.autor_role ?? null,
      tone: "info",
      badge: "SUPORTE",
    });
  }

  for (const row of sources.suporteInformacoes ?? []) {
    const numero = requestNumbers.get(String(row.solicitacao_id));
    items.push({
      id: `support-info:${row.id}`,
      source: "suporte_informacao",
      createdAt: String(row.created_at),
      title: `${numero ? `${numero} · ` : ""}Informação operacional adicionada`,
      description: truncate(row.informacao),
      userName: row.created_by_nome ?? null,
      userRole: row.created_by_role ?? null,
      tone: "omni",
      badge: "SUPORTE",
    });
  }

  items.push(...normalizeDocuments(sources.suporteDocumentos ?? [], "suporte_documento", requestNumbers));
  return items;
}

function supportEventTitle(tipo?: string | null): string {
  switch (tipo) {
    case "card_criado": return "Card de atendimento criado";
    case "etapa_alterada": return "Etapa do Suporte alterada";
    case "concluido": return "Atendimento de Suporte concluído";
    case "reaberto": return "Atendimento de Suporte reaberto";
    case "responsavel_assumiu": return "Atendimento assumido";
    default: return slugLabel(tipo || "Evento do Suporte");
  }
}

export function buildVendaTimeline(
  sources: VendaTimelineSources,
  structure: PipelineStructureForTimeline = {},
): TimelineItem[] {
  const documentos = sources.documentos ?? [];
  const suporteSolicitacoes = sources.suporteSolicitacoes ?? [];
  const items: TimelineItem[] = [
    ...normalizeVendaHistorico(sources.vendaHistorico ?? [], structure, documentos, suporteSolicitacoes),
    ...normalizeStatus(sources.statusComercial ?? []),
    ...normalizeObservacoes(sources.observacoes ?? []),
    ...normalizeNotas(sources.notaVersoes ?? []),
    ...normalizeDocuments(documentos, "documento"),
    ...normalizeErros(sources.erros ?? []),
    ...normalizeSupport(sources),
  ];

  return items.sort((a, b) => {
    const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return diff || a.id.localeCompare(b.id);
  });
}
