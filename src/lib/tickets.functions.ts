import { supabase } from "@/integrations/supabase/client";

const PERFIS_COM_VISAO_TOTAL = new Set(["admin", "administrador", "gestor", "bko"]);
const STATUS_ENCERRADOS = new Set(["resolvido", "fechado"]);

type OrigemChamado = "ticket" | "venda_suporte";

type TicketInput = { role: string; userId: string };
type TicketDetailInput = { ticketId: string; userId: string; role: string };
type AssumeInput = { ticketId: string; userId: string; role: string };

type Wrapped<T> = T | { data: T };

type TicketRow = Record<string, any> & {
  id: string;
  venda_id?: string | null;
  criado_por?: string | null;
  atribuido_a?: string | null;
  status?: string | null;
};

type VendaSuporteRow = Record<string, any> & {
  id: string;
  numero?: string | null;
  operadora?: string | null;
  cliente_razao_social?: string | null;
  cliente_cnpj?: string | null;
  consultor_id?: string | null;
  consultor_nome?: string | null;
  bko_id?: string | null;
  bko_colab_id?: string | null;
  prioridade?: string | null;
  etapa_id?: string | null;
  produto?: string | null;
  tipo_pedido?: string | null;
  observacao?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  proxima_acao_data?: string | null;
};

function unwrap<T>(input: Wrapped<T>): T {
  return (input as { data?: T }).data ?? (input as T);
}

function normalizarPerfil(role: string) {
  return String(role || "").trim().toLowerCase();
}

function isPerfilComVisaoTotal(role: string) {
  return PERFIS_COM_VISAO_TOTAL.has(normalizarPerfil(role));
}

function getPedidoConsultorId(ticket: TicketRow, vendasPorId: Map<string, VendaSuporteRow>) {
  if (!ticket.venda_id) return null;
  return vendasPorId.get(ticket.venda_id)?.consultor_id ?? null;
}

function consultorPodeVer(ticket: TicketRow, userId: string, vendasPorId: Map<string, VendaSuporteRow>) {
  const pedidoConsultorId = getPedidoConsultorId(ticket, vendasPorId);

  if (ticket.venda_id) {
    return pedidoConsultorId === userId || ticket.criado_por === userId;
  }

  return ticket.criado_por === userId;
}

function ordenarChamados<T extends { created_at?: string | null }>(chamados: T[]) {
  return [...chamados].sort((a, b) => {
    const ad = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bd = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bd - ad;
  });
}

function numeroVendaSuporte(venda: VendaSuporteRow) {
  return venda.numero ? `SUP-${venda.numero}` : `SUP-${String(venda.id).slice(0, 8)}`;
}

function tituloVendaSuporte(venda: VendaSuporteRow) {
  const etapa = String(venda.etapa_id || "s-espera").replace(/^s-/, "");
  const etapaLabel = etapa
    .split(/[-_]/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
  return `Suporte do pedido${etapaLabel ? ` · ${etapaLabel}` : ""}`;
}

function mapTicket(ticket: TicketRow, vendasPorId: Map<string, VendaSuporteRow>) {
  return {
    ...ticket,
    tipo_origem: "ticket" as OrigemChamado,
    pedido_consultor_id: getPedidoConsultorId(ticket, vendasPorId),
    created_at: ticket.created_at || new Date().toISOString(),
  };
}

function mapVendaSuporte(venda: VendaSuporteRow) {
  return {
    id: venda.id,
    tipo_origem: "venda_suporte" as OrigemChamado,
    numero: numeroVendaSuporte(venda),
    titulo: tituloVendaSuporte(venda),
    descricao: venda.observacao ?? null,
    categoria: "Suporte",
    prioridade: venda.prioridade || "media",
    status: venda.bko_id ? "em_atendimento" : "aberto",
    operadora: venda.operadora ?? null,
    cliente_razao_social: venda.cliente_razao_social || "Cliente não informado",
    cliente_cnpj: venda.cliente_cnpj ?? null,
    venda_id: venda.id,
    atribuido_a: venda.bko_id ?? null,
    criado_por: venda.consultor_id || "",
    created_at: venda.updated_at || venda.created_at || new Date().toISOString(),
    updated_at: venda.updated_at || venda.created_at || new Date().toISOString(),
    resolvido_em: null,
    sla_due_at: null,
    pedido_consultor_id: venda.consultor_id ?? null,
    produto: venda.produto ?? null,
    tipo_pedido: venda.tipo_pedido ?? null,
  };
}

async function buscarVendasPorIds(ids: string[]) {
  const limpos = Array.from(new Set(ids.filter(Boolean)));
  if (!limpos.length) return new Map<string, VendaSuporteRow>();

  const { data } = await (supabase.from("vendas") as any)
    .select("id, consultor_id, consultor_nome, cliente_razao_social, cliente_cnpj")
    .in("id", limpos);

  return new Map(((data ?? []) as VendaSuporteRow[]).map(v => [v.id, v]));
}

async function buscarVendasEmSuporte() {
  const { data, error } = await (supabase.from("vendas") as any)
    .select("id, numero, operadora, cliente_razao_social, cliente_cnpj, funil, etapa_id, status_pedido, prioridade, produto, tipo_pedido, consultor_id, consultor_nome, bko_id, bko_colab_id, observacao, created_at, updated_at, proxima_acao_data")
    .eq("funil", "suporte")
    .is("deleted_at", null)
    .or("is_deleted.is.null,is_deleted.eq.false");

  if (error) throw new Error(error.message);

  return ((data ?? []) as VendaSuporteRow[]).filter(v => {
    const etapa = String(v.etapa_id || "").toLowerCase();
    const statusPedido = String(v.status_pedido || "").toLowerCase();
    if (etapa === "s-concluido") return false;
    if (statusPedido === "cancelado" || statusPedido === "reprovado") return false;
    return true;
  });
}

export async function getTickets(input: Wrapped<TicketInput>) {
  const { userId } = unwrap(input);
  const role = normalizarPerfil(unwrap(input).role);

  const { data: ticketsData, error: ticketsError } = await (supabase.from("tickets") as any)
    .select("*")
    .is("deleted_at", null);

  if (ticketsError) throw new Error(ticketsError.message);

  const tickets = (ticketsData ?? []) as TicketRow[];
  const vendaIdsDosTickets = tickets.map(t => t.venda_id).filter(Boolean) as string[];
  const [vendasPorId, vendasEmSuporte] = await Promise.all([
    buscarVendasPorIds(vendaIdsDosTickets),
    buscarVendasEmSuporte(),
  ]);

  const vendaIdsComTicketAtivo = new Set(
    tickets
      .filter(t => !STATUS_ENCERRADOS.has(String(t.status || "")))
      .map(t => t.venda_id)
      .filter(Boolean) as string[],
  );

  const ticketsMapeados = tickets.map(t => mapTicket(t, vendasPorId));
  const vendasSemTicket = vendasEmSuporte
    .filter(v => !vendaIdsComTicketAtivo.has(v.id))
    .map(mapVendaSuporte);

  const todos = [...ticketsMapeados, ...vendasSemTicket];
  const visiveis = role === "consultor"
    ? todos.filter(chamado => consultorPodeVer(chamado as TicketRow, userId, vendasPorId))
    : isPerfilComVisaoTotal(role)
      ? todos
      : [];

  return ordenarChamados(visiveis);
}

async function getNomeUsuario(userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("nome_completo, email")
    .eq("id", userId)
    .maybeSingle();

  return profile?.nome_completo || profile?.email || "BKO";
}

async function registrarHistorico(vendaId: string | null | undefined, descricao: string, userId: string, nome: string) {
  if (!vendaId) return;
  await supabase.from("venda_historico").insert({
    venda_id: vendaId,
    tipo: "observacao",
    descricao,
    user_id: userId,
    user_nome: nome,
  } as any);
}

async function criarTicketDaVenda(venda: VendaSuporteRow, userId: string) {
  const numero = `TK-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const payload = {
    id: venda.id,
    numero,
    venda_id: venda.id,
    titulo: `Suporte - ${venda.cliente_razao_social || venda.numero || "Pedido"}`,
    descricao: venda.observacao || "Chamado gerado automaticamente a partir do funil Suporte.",
    categoria: "Suporte",
    prioridade: venda.prioridade || "media",
    status: "em_atendimento",
    operadora: venda.operadora ?? null,
    cliente_razao_social: venda.cliente_razao_social || "Cliente não informado",
    cliente_cnpj: venda.cliente_cnpj ?? null,
    criado_por: venda.consultor_id || userId,
    atribuido_a: userId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await (supabase.from("tickets") as any)
    .insert(payload)
    .select("*")
    .maybeSingle();

  return { data: data as TicketRow | null, error };
}

export async function assumeTicket(input: Wrapped<AssumeInput>) {
  const { ticketId, userId } = unwrap(input);
  const role = normalizarPerfil(unwrap(input).role);

  if (role !== "bko") {
    throw new Error("403: Somente BKO pode assumir chamados.");
  }

  const nome = await getNomeUsuario(userId);

  const { data: ticketExistente, error: ticketSelectError } = await (supabase.from("tickets") as any)
    .select("*")
    .eq("id", ticketId)
    .is("deleted_at", null)
    .maybeSingle();

  if (ticketSelectError) throw new Error(ticketSelectError.message);

  if (ticketExistente) {
    const { error: updError } = await (supabase.from("tickets") as any)
      .update({
        atribuido_a: userId,
        status: "em_atendimento",
        updated_at: new Date().toISOString(),
      })
      .eq("id", ticketId);

    if (updError) throw new Error(updError.message);

    await registrarHistorico(
      ticketExistente.venda_id,
      `Chamado ${ticketExistente.numero} assumido por ${nome} em ${new Date().toLocaleString("pt-BR")}`,
      userId,
      nome,
    );

    return { success: true, ticketId };
  }

  const { data: venda, error: vendaError } = await (supabase.from("vendas") as any)
    .select("id, numero, operadora, cliente_razao_social, cliente_cnpj, funil, etapa_id, prioridade, produto, tipo_pedido, consultor_id, consultor_nome, bko_id, bko_colab_id, observacao, created_at, updated_at")
    .eq("id", ticketId)
    .eq("funil", "suporte")
    .maybeSingle();

  if (vendaError) throw new Error(vendaError.message);
  if (!venda) throw new Error("Chamado não encontrado.");

  await (supabase.from("vendas") as any)
    .update({ bko_id: userId, updated_at: new Date().toISOString() })
    .eq("id", venda.id);

  const { data: ticketCriado } = await criarTicketDaVenda(venda as VendaSuporteRow, userId);
  const numero = ticketCriado?.numero || numeroVendaSuporte(venda as VendaSuporteRow);

  await registrarHistorico(
    venda.id,
    `Chamado ${numero} assumido por ${nome} em ${new Date().toLocaleString("pt-BR")}`,
    userId,
    nome,
  );

  return { success: true, ticketId: ticketCriado?.id || venda.id };
}

export async function getTicketDetail(input: Wrapped<TicketDetailInput>) {
  const { ticketId, userId } = unwrap(input);
  const role = normalizarPerfil(unwrap(input).role);

  const { data: ticket, error } = await (supabase.from("tickets") as any)
    .select("*")
    .eq("id", ticketId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (ticket) {
    const vendasPorId = await buscarVendasPorIds(ticket.venda_id ? [ticket.venda_id] : []);
    const row = mapTicket(ticket as TicketRow, vendasPorId);

    if (role === "consultor" && !consultorPodeVer(row as TicketRow, userId, vendasPorId)) {
      throw new Error("403: Você não tem permissão para acessar este chamado.");
    }

    if (role !== "consultor" && !isPerfilComVisaoTotal(role)) {
      throw new Error("403: Você não tem permissão para acessar este chamado.");
    }

    return row;
  }

  const { data: venda, error: vendaError } = await (supabase.from("vendas") as any)
    .select("id, numero, operadora, cliente_razao_social, cliente_cnpj, funil, etapa_id, prioridade, produto, tipo_pedido, consultor_id, consultor_nome, bko_id, bko_colab_id, observacao, created_at, updated_at")
    .eq("id", ticketId)
    .eq("funil", "suporte")
    .maybeSingle();

  if (vendaError) throw new Error(vendaError.message);
  if (!venda) throw new Error("Chamado não encontrado.");

  const row = mapVendaSuporte(venda as VendaSuporteRow);

  if (role === "consultor" && row.pedido_consultor_id !== userId && row.criado_por !== userId) {
    throw new Error("403: Você não tem permissão para acessar este chamado.");
  }

  if (role !== "consultor" && !isPerfilComVisaoTotal(role)) {
    throw new Error("403: Você não tem permissão para acessar este chamado.");
  }

  return row;
}
