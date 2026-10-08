import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, CheckCircle2, ExternalLink, History, LifeBuoy, Loader2,
  MessageCircle, RefreshCw, Send, Sparkles, User as UserIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSmartBack } from "@/lib/navigation-memory";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SupportPriorityBadge, SupportPrioritySelect } from "@/components/support-priority-ui";
import { SupportOperationalPanel } from "@/components/support-operational-panel";
import { canReclassifySupportPriority, type SupportPriority } from "@/lib/support-priority";
import { buildVendaDetailUrl } from "@/lib/rotas";
import { getEtapa } from "@/lib/mock-data";
import {
  createSupportCard,
  getSupportCaseDetail,
  markSupportRead,
  reopenSupportCase,
  reclassifySupportPriority,
  resolveSupportCase,
  sendSupportMessage,
  type SupportCase,
  type SupportEvent,
  type SupportMessage,
} from "@/lib/support.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/suporte/$id")({
  component: SupportDetail,
});

interface LegacyMessage {
  id: string;
  ticket_id: string;
  autor_id: string;
  autor_nome: string | null;
  mensagem: string;
  interna: boolean;
  created_at: string;
}

function SupportDetail() {
  const { id } = Route.useParams();
  const { user, profile, primaryRole } = useAuth();
  const voltarPaginaAnterior = useSmartBack("/suporte");
  const [supportCase, setSupportCase] = useState<SupportCase | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [events, setEvents] = useState<SupportEvent[]>([]);
  const [legacyTicket, setLegacyTicket] = useState<any>(null);
  const [legacyMessages, setLegacyMessages] = useState<LegacyMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [working, setWorking] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isBko = primaryRole === "bko";
  const isAdmin = primaryRole === "admin";
  const isCloser = primaryRole === "closer";
  const canOperate = isBko || isAdmin;
  const canReclassify = canReclassifySupportPriority(primaryRole);
  const canChat = canOperate || primaryRole === "consultor";

  const load = useCallback(async () => {
    if (!user?.id || !primaryRole) return;
    try {
      const detail = await getSupportCaseDetail(id);
      if (detail.supportCase) {
        setSupportCase(detail.supportCase);
        setMessages(detail.messages);
        setEvents(detail.events);
        setLegacyTicket(null);
        setLegacyMessages([]);
        setAccessDenied(false);
        await markSupportRead(id, user.id);
        return;
      }

      if (isCloser) {
        setSupportCase(null);
        setLegacyTicket(null);
        setLegacyMessages([]);
        setAccessDenied(true);
        return;
      }

      const { getTicketDetail } = await import("@/lib/tickets.functions");
      const ticket = await getTicketDetail({ data: { ticketId: id, userId: user.id, role: primaryRole } });
      setLegacyTicket(ticket);
      setSupportCase(null);
      const { data } = await supabase.from("ticket_mensagens").select("*")
        .eq("ticket_id", id).order("created_at", { ascending: true });
      setLegacyMessages((data ?? []) as LegacyMessage[]);
      setAccessDenied(false);
    } catch (error: any) {
      const message = String(error?.message ?? "");
      console.error("Erro ao carregar atendimento", error);
      if (message.includes("403")) {
        setAccessDenied(true);
      } else {
        toast.error(message || "Erro ao carregar atendimento");
      }
      setSupportCase(null);
      setLegacyTicket(null);
    } finally {
      setLoading(false);
    }
  }, [id, user?.id, primaryRole, isCloser]);

  useEffect(() => {
    if (!user?.id || !primaryRole) return;
    void load();
    const channel = supabase
      .channel(`support-detail-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "suporte_solicitacoes", filter: `id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "suporte_mensagens", filter: `solicitacao_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "suporte_eventos", filter: `solicitacao_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_mensagens", filter: `ticket_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, user?.id, primaryRole, load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, legacyMessages.length]);

  async function reclassifyPriority(priority: SupportPriority) {
    if (!supportCase || !canReclassify || supportCase.status === "concluido" || working) return;
    setWorking(true);
    try {
      await reclassifySupportPriority(supportCase.id, priority);
      toast.success(`Prioridade alterada para ${priority === "urgente" ? "Urgente" : "A tratar"}`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível alterar a prioridade");
    } finally {
      setWorking(false);
    }
  }

  async function createCard() {
    if (!supportCase || !canOperate || working) return;
    setWorking(true);
    try {
      await createSupportCard(supportCase.id);
      toast.success("Card criado em Suportes em Espera");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível criar o card");
    } finally {
      setWorking(false);
    }
  }

  async function resolveCase() {
    if (!supportCase || !canOperate || working) return;
    setWorking(true);
    try {
      await resolveSupportCase(supportCase.id);
      toast.success(supportCase.ticket_id ? "Atendimento concluído" : "Solicitação resolvida na triagem");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível concluir");
    } finally {
      setWorking(false);
    }
  }

  async function reopenCase() {
    if (!supportCase || !canOperate || working) return;
    setWorking(true);
    try {
      await reopenSupportCase(supportCase.id);
      toast.success(supportCase.ticket_id
        ? "Atendimento reaberto em Suportes em Espera"
        : "Solicitação reaberta e aguardando criação do atendimento");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível reabrir");
    } finally {
      setWorking(false);
    }
  }

  async function sendMessage() {
    const body = text.trim();
    if (!body || !user?.id || !canChat || working) return;
    setWorking(true);
    try {
      if (supportCase) {
        await sendSupportMessage({
          solicitacaoId: supportCase.id,
          autorId: user.id,
          autorNome: profile?.nome_completo ?? user.email ?? "Usuário",
          autorRole: isAdmin ? "admin" : isBko ? "bko" : "consultor",
          mensagem: body,
        });
        await markSupportRead(supportCase.id, user.id);
      } else if (legacyTicket) {
        const { error } = await supabase.from("ticket_mensagens").insert({
          ticket_id: legacyTicket.id,
          autor_id: user.id,
          autor_nome: profile?.nome_completo ?? user.email ?? "Usuário",
          mensagem: body,
          interna: false,
        });
        if (error) throw error;
      }
      setText("");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível enviar a mensagem");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;

  if (accessDenied) {
    return (
      <div className="p-6 space-y-3">
        <button type="button" onClick={voltarPaginaAnterior} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="size-3" /> Voltar
        </button>
        <div className="rounded-xl border border-border bg-card p-5">
          <h1 className="font-display font-semibold">Atendimento indisponível</h1>
          <p className="text-sm text-muted-foreground mt-1">Você não tem permissão para acessar este atendimento.</p>
        </div>
      </div>
    );
  }

  if (!supportCase && !legacyTicket) throw notFound();

  if (legacyTicket) {
    return (
      <LegacyDetail
        ticket={legacyTicket}
        messages={legacyMessages}
        userId={user?.id ?? ""}
        canChat={canChat}
        text={text}
        setText={setText}
        sendMessage={sendMessage}
        working={working}
        scrollRef={scrollRef}
      />
    );
  }

  const item = supportCase!;
  const waiting = item.status === "aguardando_criacao";
  const done = item.status === "concluido";
  const stage = item.ticket?.etapa_suporte_id ? getEtapa(item.ticket.etapa_suporte_id) : null;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button type="button" onClick={voltarPaginaAnterior} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="size-3" /> Voltar
        </button>
        {item.venda_id && (
          <Link
            {...buildVendaDetailUrl(item.venda_id)}
            search={{ suporte: undefined, etapaSuporte: undefined }}
            className="inline-flex items-center gap-2 rounded-lg bg-omni text-black px-3 py-2 text-xs font-bold hover:bg-omni-glow"
          >
            <ExternalLink className="size-3.5" /> Ver pedido completo
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-[10px] text-muted-foreground">{item.numero}</span>
                  {item.ticket?.numero && <span className="font-mono text-[10px] text-muted-foreground">· {item.ticket.numero}</span>}
                  <StatusBadge item={item} />
                  <SupportPriorityBadge priority={item.prioridade} />
                </div>
                <h1 className="text-xl font-display font-bold flex items-center gap-2">
                  <LifeBuoy className="size-5 text-omni" />
                  {item.venda?.cliente_razao_social || item.cliente_razao_social || item.cliente_nome || "Atendimento de suporte"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {item.venda ? `Pedido ${item.venda.numero} · ${item.venda.operadora || "—"}` : `Suporte avulso · ${item.cliente_cnpj || "CNPJ não informado"}`}
                  {stage?.nome ? ` · ${stage.nome}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {canReclassify && !done && (
                  <SupportPrioritySelect
                    value={item.prioridade}
                    onChange={priority => void reclassifyPriority(priority)}
                    disabled={working}
                  />
                )}
                {canOperate && (<>
                  {waiting && (
                    <Button onClick={() => void createCard()} disabled={working} className="bg-omni text-black hover:bg-omni-glow gap-2">
                      {working ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                      Criar card de atendimento
                    </Button>
                  )}
                  {!done && (
                    <Button variant="outline" onClick={() => void resolveCase()} disabled={working} className="gap-2">
                      <CheckCircle2 className="size-3.5" /> Resolver solicitação
                    </Button>
                  )}
                  {done && (
                    <Button variant="outline" onClick={() => void reopenCase()} disabled={working} className="gap-2">
                      <RefreshCw className="size-3.5" /> Reabrir
                    </Button>
                  )}
                </>)}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-surface-1 p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Motivo / descrição original</div>
              <p className="text-sm whitespace-pre-wrap">{item.motivo}</p>
            </div>

            {isCloser && (
              <div className="mt-3 rounded-lg border border-omni/25 bg-omni/5 p-3 text-xs text-muted-foreground">
                Acompanhamento somente leitura. BKO e Admin recebem, respondem e operam este suporte.
              </div>
            )}

            {done && (
              <div className="mt-3 text-xs text-muted-foreground rounded-lg border border-success/20 bg-success/5 p-3">
                O atendimento está concluído, mas a conversa continua aberta. Novas mensagens geram notificação e não reabrem o atendimento automaticamente.
              </div>
            )}
          </section>

          <SupportOperationalPanel
            solicitacaoId={item.id}
            responsavelId={item.responsavel_id}
            responsavelNome={item.responsavel_nome}
            concluido={done}
            onChanged={load}
          />

          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-1 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold text-sm flex items-center gap-2"><MessageCircle className="size-4 text-omni" /> Conversa</h2>
                <p className="text-[10px] text-muted-foreground">O mesmo chat acompanha a solicitação antes e depois da criação do card.</p>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{messages.length} mensagem(ns)</span>
            </div>

            <div ref={scrollRef} className="p-4 space-y-3 max-h-[520px] overflow-y-auto">
              {messages.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {isCloser ? "Nenhuma atualização do atendimento até o momento." : "Nenhuma mensagem ainda. A conversa já está disponível."}
                </div>
              )}
              {messages.map(message => (
                <ChatMessage key={message.id} message={message} currentUserId={user?.id ?? ""} />
              ))}
            </div>

            {canChat && (
              <div className="border-t border-border p-3 bg-surface-1">
                <Textarea
                  value={text}
                  onChange={event => setText(event.target.value)}
                  placeholder={canOperate ? "Responder ao atendimento…" : "Enviar mensagem para o BKO…"}
                  rows={3}
                  onKeyDown={event => {
                    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault();
                      void sendMessage();
                    }
                  }}
                />
                <div className="flex items-center justify-between gap-2 mt-2">
                  <span className="text-[10px] text-muted-foreground">Ctrl/Cmd + Enter para enviar</span>
                  <Button onClick={() => void sendMessage()} disabled={working || !text.trim()} size="sm" className="gap-2 bg-omni text-black hover:bg-omni-glow">
                    <Send className="size-3.5" /> Enviar
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-display font-semibold text-sm mb-3">{item.venda_id ? "Pedido vinculado" : "Cliente do suporte"}</h2>
            {item.venda_id ? (
              <>
                <InfoRow label="Pedido" value={item.venda?.numero || "—"} />
                <InfoRow label="Consultor" value={item.venda?.consultor_nome || item.criado_por_nome || "—"} />
                <InfoRow label="Produto" value={item.venda?.produto || "—"} />
                <InfoRow label="Tipo" value={item.venda?.tipo_pedido || "—"} />
                <InfoRow label="Funil atual" value={item.venda?.funil || "—"} />
                <InfoRow label="Etapa atual" value={item.venda?.etapa_id || "—"} />
                <Link
                  {...buildVendaDetailUrl(item.venda_id)}
                  search={{ suporte: undefined, etapaSuporte: undefined }}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-omni/40 bg-omni/10 text-omni px-3 py-2 text-xs font-semibold hover:bg-omni/15"
                >
                  <ExternalLink className="size-3.5" /> Ver pedido completo
                </Link>
              </>
            ) : (
              <>
                <InfoRow label="Razão Social" value={item.cliente_razao_social || item.cliente_nome || "—"} />
                <InfoRow label="CNPJ" value={item.cliente_cnpj || "—"} />
                <InfoRow label="Contato" value={item.cliente_nome || "—"} />
                <InfoRow label="Telefone" value={item.cliente_telefone || "—"} />
                <InfoRow label="E-mail" value={item.cliente_email || "—"} />
                <InfoRow label="Criado por" value={item.criado_por_nome || "—"} />
              </>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-surface-1">
              <h2 className="font-display font-semibold text-sm flex items-center gap-2"><History className="size-4" /> Histórico do atendimento</h2>
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
              {events.length === 0 && <div className="p-4 text-xs text-muted-foreground">Sem movimentações registradas.</div>}
              {events.map(event => (
                <div key={event.id} className="p-3">
                  <div className="text-xs font-medium">{event.descricao}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {event.user_nome || "Sistema"} · {new Date(event.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatusBadge({ item }: { item: SupportCase }) {
  const waiting = item.status === "aguardando_criacao";
  const done = item.status === "concluido";
  return (
    <Badge variant="outline" className={cn(
      "text-[9px] h-5",
      waiting && "border-warning/40 bg-warning/10 text-warning",
      item.status === "em_atendimento" && "border-omni/40 bg-omni/10 text-omni",
      done && "border-success/40 bg-success/10 text-success",
    )}>
      {waiting ? "Aguardando criação do atendimento" : item.status_label}
    </Badge>
  );
}

function ChatMessage({ message, currentUserId }: { message: SupportMessage; currentUserId: string }) {
  const mine = message.autor_id === currentUserId;
  return (
    <div className={cn("flex gap-2", mine && "flex-row-reverse")}>
      <div className="size-8 rounded-full bg-surface-2 grid place-items-center shrink-0">
        <UserIcon className="size-4 text-muted-foreground" />
      </div>
      <div className={cn(
        "max-w-[78%] rounded-lg border p-3",
        mine ? "bg-omni/10 border-omni/30" : "bg-surface-1 border-border",
      )}>
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs font-semibold">{message.autor_nome || "Usuário"}</span>
          <Badge variant="outline" className="text-[8px] h-4 px-1.5">{message.autor_role === "admin" ? "Admin" : message.autor_role === "bko" ? "BKO" : "Consultor"}</Badge>
          <span className="text-[10px] text-muted-foreground font-mono">{new Date(message.created_at).toLocaleString("pt-BR")}</span>
        </div>
        <div className="text-sm whitespace-pre-wrap break-words">{message.mensagem}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2 border-b border-border last:border-0">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-medium mt-0.5 break-words">{value}</div>
    </div>
  );
}

function LegacyDetail({ ticket, messages, userId, canChat, text, setText, sendMessage, working, scrollRef }: {
  ticket: any;
  messages: LegacyMessage[];
  userId: string;
  canChat: boolean;
  text: string;
  setText: (value: string) => void;
  sendMessage: () => Promise<void>;
  working: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const voltarPaginaAnterior = useSmartBack("/suporte");

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button type="button" onClick={voltarPaginaAnterior} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <ArrowLeft className="size-3" /> Voltar
        </button>
        {ticket.venda_id && (
          <Link {...buildVendaDetailUrl(ticket.venda_id)} search={{ suporte: undefined, etapaSuporte: undefined }} className="inline-flex items-center gap-2 rounded-lg bg-omni text-black px-3 py-2 text-xs font-bold">
            <ExternalLink className="size-3.5" /> Ver pedido completo
          </Link>
        )}
      </div>
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="text-[10px] font-mono text-muted-foreground">{ticket.numero} · CHAMADO LEGADO</div>
        <h1 className="text-xl font-display font-bold mt-1">{ticket.titulo}</h1>
        <p className="text-sm text-muted-foreground mt-1">{ticket.cliente_razao_social}</p>
        {ticket.descricao && <div className="mt-3 rounded-lg border border-border bg-surface-1 p-3 text-sm whitespace-pre-wrap">{ticket.descricao}</div>}
      </section>
      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-surface-1 font-display font-semibold text-sm">Conversa</div>
        <div ref={scrollRef} className="p-4 space-y-3 max-h-[520px] overflow-y-auto">
          {messages.length === 0 && <div className="text-sm text-muted-foreground text-center py-8">Sem mensagens.</div>}
          {messages.map(message => (
            <div key={message.id} className={cn("flex gap-2", message.autor_id === userId && "flex-row-reverse")}>
              <div className="max-w-[78%] rounded-lg border border-border bg-surface-1 p-3">
                <div className="text-xs font-semibold">{message.autor_nome || "Usuário"}</div>
                <div className="text-sm whitespace-pre-wrap mt-1">{message.mensagem}</div>
                <div className="text-[10px] text-muted-foreground mt-1">{new Date(message.created_at).toLocaleString("pt-BR")}</div>
              </div>
            </div>
          ))}
        </div>
        {canChat && (
          <div className="border-t border-border p-3 bg-surface-1">
            <Textarea value={text} onChange={event => setText(event.target.value)} rows={3} placeholder="Escreva uma mensagem…" />
            <div className="flex justify-end mt-2">
              <Button onClick={() => void sendMessage()} disabled={working || !text.trim()} size="sm" className="gap-2 bg-omni text-black">
                <Send className="size-3.5" /> Enviar
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
