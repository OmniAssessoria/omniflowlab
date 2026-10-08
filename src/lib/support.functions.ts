import { supabase } from "@/integrations/supabase/client";
import { supportStatusLabel, type SupportRequestStatus } from "@/lib/support-flow";
import type { SupportPriority } from "@/lib/support-priority";

export interface SupportSale {
  id: string;
  numero: string;
  operadora: string | null;
  cliente_razao_social: string | null;
  cliente_cnpj: string | null;
  consultor_id: string | null;
  consultor_nome: string | null;
  produto: string | null;
  tipo_pedido: string | null;
  prioridade: string | null;
  funil: string | null;
  etapa_id: string | null;
}

export interface SupportTicket {
  id: string;
  numero: string;
  etapa_suporte_id: string | null;
  status: string;
  criado_por: string;
  created_at: string;
  updated_at: string;
  resolvido_em: string | null;
}

export interface SupportCase {
  id: string;
  numero: string;
  venda_id: string | null;
  criado_por: string;
  criado_por_nome: string | null;
  motivo: string;
  prioridade: SupportPriority;
  status: SupportRequestStatus;
  ticket_id: string | null;
  card_criado_por: string | null;
  card_criado_em: string | null;
  concluido_por: string | null;
  concluido_em: string | null;
  created_at: string;
  updated_at: string;
  cliente_razao_social: string | null;
  cliente_nome: string | null;
  cliente_cnpj: string | null;
  cliente_email: string | null;
  cliente_telefone: string | null;
  etapa_inicial_id: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  assumido_em: string | null;
  venda: SupportSale | null;
  ticket: SupportTicket | null;
  status_label: string;
}

export interface SupportMessage {
  id: string;
  solicitacao_id: string;
  autor_id: string;
  autor_nome: string | null;
  autor_role: "consultor" | "closer" | "bko" | "admin";
  mensagem: string;
  anexos: unknown[];
  created_at: string;
}

export interface SupportEvent {
  id: string;
  solicitacao_id: string;
  ticket_id: string | null;
  tipo: string;
  descricao: string;
  user_id: string | null;
  user_nome: string | null;
  user_role: string | null;
  dados: Record<string, unknown>;
  created_at: string;
}

export interface SupportInformation {
  id: string;
  solicitacao_id: string;
  informacao: string;
  imagem_documento_id: string | null;
  created_by: string;
  created_by_nome: string;
  created_by_role: "consultor" | "closer" | "bko" | "admin";
  created_at: string;
}

export interface SupportDocument {
  id: string;
  solicitacao_id: string;
  titulo: string;
  arquivo_nome_original: string;
  storage_path: string;
  mime_type: string;
  tamanho_bytes: number;
  created_by: string;
  created_by_nome: string;
  created_by_role: "consultor" | "closer" | "bko" | "admin";
  created_at: string;
}

export interface LegacyTicket {
  id: string;
  numero: string;
  venda_id: string | null;
  titulo: string;
  descricao: string | null;
  categoria: string;
  prioridade: string;
  status: string;
  operadora: string | null;
  cliente_razao_social: string;
  cliente_cnpj: string | null;
  criado_por: string;
  atribuido_a: string | null;
  created_at: string;
  updated_at: string;
  resolvido_em: string | null;
}

function asAny() {
  return supabase as any;
}

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

async function hydrateSupportCases(rows: any[]): Promise<SupportCase[]> {
  if (!rows.length) return [];

  const vendaIds = uniq(rows.map(row => row.venda_id));
  const ticketIds = uniq(rows.map(row => row.ticket_id));

  const [vendasResult, ticketsResult] = await Promise.all([
    vendaIds.length
      ? asAny().from("vendas")
          .select("id, numero, operadora, cliente_razao_social, cliente_cnpj, consultor_id, consultor_nome, produto, tipo_pedido, prioridade, funil, etapa_id")
          .in("id", vendaIds)
      : Promise.resolve({ data: [], error: null }),
    ticketIds.length
      ? asAny().from("tickets")
          .select("id, numero, etapa_suporte_id, status, criado_por, created_at, updated_at, resolvido_em")
          .in("id", ticketIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (vendasResult.error) throw new Error(vendasResult.error.message);
  if (ticketsResult.error) throw new Error(ticketsResult.error.message);

  const vendas = new Map<string, SupportSale>((vendasResult.data ?? []).map((row: SupportSale) => [row.id, row]));
  const tickets = new Map<string, SupportTicket>((ticketsResult.data ?? []).map((row: SupportTicket) => [row.id, row]));

  return rows.map(row => {
    const ticket = row.ticket_id ? tickets.get(row.ticket_id) ?? null : null;
    return {
      ...row,
      venda: row.venda_id ? vendas.get(row.venda_id) ?? null : null,
      ticket,
      status_label: supportStatusLabel(row.status, Boolean(ticket)),
    } as SupportCase;
  });
}

export async function getSupportCases(): Promise<SupportCase[]> {
  const { data, error } = await asAny()
    .from("suporte_solicitacoes")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return hydrateSupportCases(data ?? []);
}

export async function getSupportCaseDetail(id: string): Promise<{
  supportCase: SupportCase | null;
  messages: SupportMessage[];
  events: SupportEvent[];
  informations: SupportInformation[];
  documents: SupportDocument[];
}> {
  const { data: row, error } = await asAny()
    .from("suporte_solicitacoes")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return { supportCase: null, messages: [], events: [], informations: [], documents: [] };

  const [hydrated, messagesResult, eventsResult, informationsResult, documentsResult] = await Promise.all([
    hydrateSupportCases([row]),
    asAny().from("suporte_mensagens").select("*").eq("solicitacao_id", id).order("created_at", { ascending: true }),
    asAny().from("suporte_eventos").select("*").eq("solicitacao_id", id).order("created_at", { ascending: false }),
    asAny().from("suporte_informacoes").select("*").eq("solicitacao_id", id).order("created_at", { ascending: false }),
    asAny().from("suporte_documentos").select("id, solicitacao_id, titulo, arquivo_nome_original, storage_path, mime_type, tamanho_bytes, created_by, created_by_nome, created_by_role, created_at").eq("solicitacao_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
  ]);

  if (messagesResult.error) throw new Error(messagesResult.error.message);
  if (eventsResult.error) throw new Error(eventsResult.error.message);
  if (informationsResult.error) throw new Error(informationsResult.error.message);
  if (documentsResult.error) throw new Error(documentsResult.error.message);

  return {
    supportCase: hydrated[0] ?? null,
    messages: (messagesResult.data ?? []) as SupportMessage[],
    events: (eventsResult.data ?? []) as SupportEvent[],
    informations: (informationsResult.data ?? []) as SupportInformation[],
    documents: (documentsResult.data ?? []) as SupportDocument[],
  };
}

export async function createSupportRequest(
  vendaId: string,
  motivo: string,
  prioridade: SupportPriority,
): Promise<string> {
  const { data, error } = await asAny().rpc("criar_solicitacao_suporte", {
    p_venda_id: vendaId,
    p_motivo: motivo.trim(),
    p_prioridade: prioridade,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function createStandaloneSupport(input: {
  clienteRazaoSocial: string;
  clienteCnpj: string;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone: string;
  motivo: string;
  prioridade: SupportPriority;
  etapaInicialId: "s-espera" | "s-prevendas";
}): Promise<string> {
  const { data, error } = await asAny().rpc("criar_suporte_avulso_v2", {
    p_cliente_razao_social: input.clienteRazaoSocial.trim(),
    p_cliente_cnpj: input.clienteCnpj.trim(),
    p_cliente_nome: input.clienteNome.trim(),
    p_cliente_email: input.clienteEmail.trim(),
    p_cliente_telefone: input.clienteTelefone.trim(),
    p_motivo: input.motivo.trim(),
    p_prioridade: input.prioridade,
    p_etapa_inicial_id: input.etapaInicialId,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function assumeSupportCase(solicitacaoId: string): Promise<void> {
  const { error } = await asAny().rpc("assumir_atendimento_suporte", {
    p_solicitacao_id: solicitacaoId,
  });
  if (error) throw new Error(error.message);
}

export async function addSupportInformation(input: {
  solicitacaoId: string;
  informacao: string;
  imagemDocumentoId?: string | null;
  userId: string;
  userNome: string;
  userRole: "consultor" | "closer" | "bko" | "admin";
}): Promise<string> {
  const informacao = input.informacao.trim() || (input.imagemDocumentoId ? "Imagem anexada ao atendimento." : "");
  if (!informacao) return "";

  const { data, error } = await asAny()
    .from("suporte_informacoes")
    .insert({
      solicitacao_id: input.solicitacaoId,
      informacao,
      imagem_documento_id: input.imagemDocumentoId ?? null,
      created_by: input.userId,
      created_by_nome: input.userNome,
      created_by_role: input.userRole,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return String(data?.id ?? "");
}

export async function updateSupportInformation(input: {
  informationId: string;
  informacao: string;
  createdBy?: string | null;
}): Promise<void> {
  const informacao = input.informacao.trim();
  if (!informacao) throw new Error("A informação não pode ficar vazia.");

  let query = asAny()
    .from("suporte_informacoes")
    .update({ informacao })
    .eq("id", input.informationId);

  if (input.createdBy) query = query.eq("created_by", input.createdBy);

  const { data, error } = await query
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Você não tem permissão para editar esta informação.");
}

export async function deleteSupportInformation(input: {
  informationId: string;
  createdBy?: string | null;
}): Promise<void> {
  let query = asAny()
    .from("suporte_informacoes")
    .delete()
    .eq("id", input.informationId);

  if (input.createdBy) query = query.eq("created_by", input.createdBy);

  const { data, error } = await query
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Você não tem permissão para excluir esta informação.");
}

export async function reclassifySupportPriority(
  solicitacaoId: string,
  prioridade: SupportPriority,
): Promise<void> {
  const { error } = await asAny().rpc("reclassificar_prioridade_suporte", {
    p_solicitacao_id: solicitacaoId,
    p_prioridade: prioridade,
  });
  if (error) throw new Error(error.message);
}

export async function createSupportCard(solicitacaoId: string): Promise<string> {
  const { data, error } = await asAny().rpc("criar_card_suporte", {
    p_solicitacao_id: solicitacaoId,
  });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function moveSupportCard(solicitacaoId: string, etapaId: string): Promise<void> {
  const { error } = await asAny().rpc("mover_card_suporte", {
    p_solicitacao_id: solicitacaoId,
    p_etapa_id: etapaId,
  });
  if (error) throw new Error(error.message);
}

export async function resolveSupportCase(solicitacaoId: string): Promise<void> {
  const { error } = await asAny().rpc("resolver_solicitacao_suporte", {
    p_solicitacao_id: solicitacaoId,
  });
  if (error) throw new Error(error.message);
}

export async function reopenSupportCase(solicitacaoId: string): Promise<void> {
  const { error } = await asAny().rpc("reabrir_solicitacao_suporte", {
    p_solicitacao_id: solicitacaoId,
  });
  if (error) throw new Error(error.message);
}

export async function deleteStandaloneSupport(solicitacaoId: string): Promise<void> {
  const { error } = await asAny().rpc("excluir_suporte_avulso", {
    p_solicitacao_id: solicitacaoId,
  });
  if (error) throw new Error(error.message);
}

export async function sendSupportMessage(input: {
  solicitacaoId: string;
  autorId: string;
  autorNome: string;
  autorRole: "consultor" | "bko" | "admin";
  mensagem: string;
}): Promise<void> {
  const mensagem = input.mensagem.trim();
  if (!mensagem) return;

  const { error } = await asAny().from("suporte_mensagens").insert({
    solicitacao_id: input.solicitacaoId,
    autor_id: input.autorId,
    autor_nome: input.autorNome,
    autor_role: input.autorRole,
    mensagem,
  });
  if (error) throw new Error(error.message);
}

export async function markSupportRead(solicitacaoId: string, userId: string): Promise<void> {
  const { error } = await asAny().from("suporte_leituras").upsert({
    solicitacao_id: solicitacaoId,
    user_id: userId,
    last_read_at: new Date().toISOString(),
  }, { onConflict: "solicitacao_id,user_id" });
  if (error) throw new Error(error.message);
}

export async function getSupportUnreadMap(userId: string, solicitacaoIds: string[]): Promise<Record<string, boolean>> {
  if (!solicitacaoIds.length) return {};
  const [{ data: messages, error: messageError }, { data: reads, error: readError }] = await Promise.all([
    asAny().from("suporte_mensagens")
      .select("solicitacao_id, created_at")
      .in("solicitacao_id", solicitacaoIds)
      .order("created_at", { ascending: false }),
    asAny().from("suporte_leituras")
      .select("solicitacao_id, last_read_at")
      .eq("user_id", userId)
      .in("solicitacao_id", solicitacaoIds),
  ]);
  if (messageError) throw new Error(messageError.message);
  if (readError) throw new Error(readError.message);

  const latest: Record<string, string> = {};
  for (const row of messages ?? []) {
    if (!latest[row.solicitacao_id]) latest[row.solicitacao_id] = row.created_at;
  }
  const lastRead: Record<string, string> = {};
  for (const row of reads ?? []) lastRead[row.solicitacao_id] = row.last_read_at;

  return Object.fromEntries(solicitacaoIds.map(id => {
    const messageAt = latest[id];
    const readAt = lastRead[id];
    const unread = Boolean(messageAt && (!readAt || new Date(messageAt).getTime() > new Date(readAt).getTime()));
    return [id, unread];
  }));
}

export async function getLegacyTickets(): Promise<LegacyTicket[]> {
  const { data, error } = await asAny()
    .from("tickets")
    .select("id, numero, venda_id, titulo, descricao, categoria, prioridade, status, operadora, cliente_razao_social, cliente_cnpj, criado_por, atribuido_a, created_at, updated_at, resolvido_em")
    .is("solicitacao_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LegacyTicket[];
}

export async function getWaitingSupportRequestCount(): Promise<number> {
  const { count, error } = await asAny()
    .from("suporte_solicitacoes")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "aguardando_criacao");
  if (error) throw new Error(error.message);
  return count ?? 0;
}
