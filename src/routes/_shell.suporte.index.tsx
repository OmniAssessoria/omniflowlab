import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CheckCircle2, Inbox, LifeBuoy, MessageCircle,
  RefreshCw, Search, Sparkles, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { SupportPriorityBadge, SupportPrioritySelect } from "@/components/support-priority-ui";
import { NovoSuporteDialog } from "@/components/novo-suporte-dialog";
import { canReclassifySupportPriority, type SupportPriority } from "@/lib/support-priority";
import { getEtapa } from "@/lib/mock-data";
import {
  createSupportCard,
  deleteStandaloneSupport,
  getLegacyTickets,
  getSupportCases,
  getSupportUnreadMap,
  reclassifySupportPriority,
  reopenSupportCase,
  resolveSupportCase,
  type LegacyTicket,
  type SupportCase,
} from "@/lib/support.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/suporte/")({
  component: ChamadosUnificados,
});

type Tab = "todos" | "aguardando" | "atendimento" | "concluido" | "nao_lidas";

function ChamadosUnificados() {
  const { primaryRole } = useAuth();

  if (!primaryRole) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  // SUPORTE_GERAL_SOMENTE_CLOSER
  if (primaryRole !== "closer") {
    return <Navigate to="/pipeline" search={{ funil: "suporte" }} replace />;
  }

  return <MeusSuportesCloser />;
}

function MeusSuportesCloser() {
  const { user, primaryRole } = useAuth();
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [legacyTickets, setLegacyTickets] = useState<LegacyTicket[]>([]);
  const [unread, setUnread] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<Tab>("todos");
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportCase | null>(null);

  const isBko = primaryRole === "bko";
  const isAdmin = primaryRole === "admin";
  const isConsultor = primaryRole === "consultor";
  const isCloser = primaryRole === "closer";
  const canOperate = isBko || isAdmin;
  const canReclassify = canReclassifySupportPriority(primaryRole);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [data, legacy] = await Promise.all([
        getSupportCases(),
        isCloser ? Promise.resolve([] as LegacyTicket[]) : getLegacyTickets(),
      ]);
      setCases(data);
      setLegacyTickets(legacy);
      setUnread(await getSupportUnreadMap(user.id, data.map(item => item.id)));
    } catch (error: any) {
      console.error("Erro ao carregar chamados", error);
      toast.error(error?.message || "Erro ao carregar Chamados");
    } finally {
      setLoading(false);
    }
  }, [user?.id, isCloser]);

  useEffect(() => {
    if (!user?.id) return;
    void load();
    const channel = supabase
      .channel(`support-central-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "suporte_solicitacoes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "suporte_mensagens" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, load]);

  const counts = useMemo(() => ({
    todos: cases.length,
    aguardando: cases.filter(item => item.status === "aguardando_criacao").length,
    atendimento: cases.filter(item => item.status === "em_atendimento").length,
    concluido: cases.filter(item => item.status === "concluido").length,
    nao_lidas: cases.filter(item => Boolean(unread[item.id])).length,
  }), [cases, unread]);

  const filtered = useMemo(() => {
    let list = cases;
    if (tab === "aguardando") list = list.filter(item => item.status === "aguardando_criacao");
    if (tab === "atendimento") list = list.filter(item => item.status === "em_atendimento");
    if (tab === "concluido") list = list.filter(item => item.status === "concluido");
    if (tab === "nao_lidas") list = list.filter(item => Boolean(unread[item.id]));
    const q = busca.trim().toLowerCase();
    if (q) {
      list = list.filter(item => [
        item.numero,
        item.venda?.numero,
        item.venda?.cliente_razao_social,
        item.venda?.cliente_cnpj,
        item.cliente_razao_social,
        item.cliente_nome,
        item.cliente_cnpj,
        item.cliente_email,
        item.cliente_telefone,
        item.criado_por_nome,
        item.motivo,
      ].some(value => String(value ?? "").toLowerCase().includes(q)));
    }
    return list;
  }, [cases, tab, busca, unread]);

  const filteredLegacy = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return legacyTickets;
    return legacyTickets.filter(ticket => [
      ticket.numero,
      ticket.titulo,
      ticket.cliente_razao_social,
    ].some(value => String(value ?? "").toLowerCase().includes(q)));
  }, [legacyTickets, busca]);

  async function criarCard(item: SupportCase) {
    if (!canOperate || workingId) return;
    setWorkingId(item.id);
    try {
      await createSupportCard(item.id);
      toast.success("Card criado em Suportes em Espera");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível criar o card");
    } finally {
      setWorkingId(null);
    }
  }

  async function reclassificar(item: SupportCase, prioridade: SupportPriority) {
    if (!canReclassify || item.status === "concluido" || workingId) return;
    setWorkingId(item.id);
    try {
      await reclassifySupportPriority(item.id, prioridade);
      toast.success(`Prioridade alterada para ${prioridade === "urgente" ? "Urgente" : "A tratar"}`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível alterar a prioridade");
    } finally {
      setWorkingId(null);
    }
  }

  async function concluir(item: SupportCase) {
    if (!canOperate || workingId) return;
    setWorkingId(item.id);
    try {
      await resolveSupportCase(item.id);
      toast.success(item.ticket_id ? "Atendimento concluído" : "Solicitação resolvida na triagem");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível concluir");
    } finally {
      setWorkingId(null);
    }
  }

  async function reabrir(item: SupportCase) {
    if (!canOperate || workingId) return;
    setWorkingId(item.id);
    try {
      await reopenSupportCase(item.id);
      toast.success(item.ticket_id
        ? "Atendimento reaberto em Suportes em Espera"
        : "Solicitação reaberta e aguardando criação do atendimento");
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível reabrir");
    } finally {
      setWorkingId(null);
    }
  }

  async function excluirSuporteAvulso() {
    if (!deleteTarget || deleteTarget.venda_id || workingId) return;
    const podeExcluir = isAdmin || (isCloser && deleteTarget.criado_por === user?.id);
    if (!podeExcluir) return;

    const target = deleteTarget;
    setWorkingId(target.id);
    try {
      await deleteStandaloneSupport(target.id);
      setDeleteTarget(null);
      toast.success("Suporte excluído", {
        description: `${target.numero} foi removido de ${isCloser ? "Meus Suportes" : "Chamados"}.`,
      });
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível excluir o suporte");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <LifeBuoy className="size-5 text-omni" /> {isCloser ? "Meus Suportes" : isConsultor ? "Meus Chamados" : "Chamados"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isCloser
              ? "Acompanhe somente os suportes criados por você. BKO e Admin fazem o atendimento; esta área é de acompanhamento."
              : isConsultor
                ? "Acompanhe seus atendimentos, mensagens e histórico em uma única tela."
                : "Solicitações, triagem, atendimentos, prioridades, conversas e histórico em uma única central."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(!isConsultor || isCloser) && <NovoSuporteDialog onCreated={() => load()} />}
          <Button variant="outline" size="sm" onClick={() => void load()} className="gap-2">
            <RefreshCw className="size-3.5" /> Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        <TabButton label="Todos" count={counts.todos} active={tab === "todos"} onClick={() => setTab("todos")} />
        <TabButton label="Aguardando criação" count={counts.aguardando} active={tab === "aguardando"} onClick={() => setTab("aguardando")} accent />
        <TabButton label="Em atendimento" count={counts.atendimento} active={tab === "atendimento"} onClick={() => setTab("atendimento")} />
        <TabButton label="Concluídos" count={counts.concluido} active={tab === "concluido"} onClick={() => setTab("concluido")} />
        <TabButton label="Não lidas" count={counts.nao_lidas} active={tab === "nao_lidas"} onClick={() => setTab("nao_lidas")} accent={counts.nao_lidas > 0} />
      </div>

      <div className="relative max-w-xl">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={event => setBusca(event.target.value)}
          placeholder={isCloser ? "Buscar por suporte, cliente, CNPJ ou motivo…" : "Buscar por solicitação, pedido, cliente, CNPJ, consultor ou motivo…"}
          className="pl-9 bg-card"
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Inbox className="size-7 mx-auto mb-2 opacity-40" />
            Nenhuma solicitação encontrada.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(item => (
              <CentralRow
                key={item.id}
                item={item}
                unread={Boolean(unread[item.id])}
                canOperate={canOperate}
                canReclassify={canReclassify}
                canDeleteStandalone={
                  item.venda_id === null
                  && (isAdmin || (isCloser && item.criado_por === user?.id))
                }
                working={workingId === item.id}
                onPriorityChange={priority => void reclassificar(item, priority)}
                onCreate={() => void criarCard(item)}
                onResolve={() => void concluir(item)}
                onReopen={() => void reabrir(item)}
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
          </div>
        )}
      </div>

      {filteredLegacy.length > 0 && (
        <section className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface-1">
            <h2 className="font-display font-semibold text-sm">Chamados legados</h2>
            <p className="text-[11px] text-muted-foreground">Histórico anterior ao fluxo atual, preservado na mesma área de Chamados.</p>
          </div>
          <div className="divide-y divide-border">
            {filteredLegacy.map(ticket => (
              <Link
                key={ticket.id}
                to="/suporte/$id"
                params={{ id: ticket.id }}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-1 transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-mono text-muted-foreground">{ticket.numero}</div>
                  <div className="text-sm font-semibold truncate">{ticket.titulo}</div>
                  <div className="text-xs text-muted-foreground truncate">{ticket.cliente_razao_social}</div>
                </div>
                <ArrowRight className="size-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => {
          if (!open && !workingId) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir suporte avulso?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.numero} será removido das telas operacionais. O registro fica preservado apenas para auditoria.`
                : "Selecione um suporte para excluir."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(workingId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deleteTarget || Boolean(workingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void excluirSuporteAvulso()}
            >
              {workingId ? "Excluindo…" : "Excluir suporte"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CentralRow({
  item, unread, canOperate, canReclassify, canDeleteStandalone, working, onPriorityChange, onCreate, onResolve, onReopen, onDelete,
}: {
  item: SupportCase;
  unread: boolean;
  canOperate: boolean;
  canReclassify: boolean;
  canDeleteStandalone: boolean;
  working: boolean;
  onPriorityChange: (priority: SupportPriority) => void;
  onCreate: () => void;
  onResolve: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const stage = item.ticket?.etapa_suporte_id ? getEtapa(item.ticket.etapa_suporte_id) : null;
  const waiting = item.status === "aguardando_criacao";
  const done = item.status === "concluido";

  return (
    <div className={cn("p-4 flex items-center gap-4 flex-wrap lg:flex-nowrap", unread && "bg-omni/5")}>
      <Link to="/suporte/$id" params={{ id: item.id }} className="flex-1 min-w-[260px] group">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-mono text-[10px] text-muted-foreground">{item.numero}</span>
          <Badge variant="outline" className={cn(
            "text-[9px] h-5",
            waiting && "border-warning/40 text-warning bg-warning/10",
            item.status === "em_atendimento" && "border-omni/40 text-omni bg-omni/10",
            done && "border-success/40 text-success bg-success/10",
          )}>
            {waiting ? "Aguardando criação do atendimento" : item.status_label}
          </Badge>
          <SupportPriorityBadge priority={item.prioridade} />
          {item.responsavel_nome && <Badge variant="outline" className="h-5 text-[9px]">Responsável: {item.responsavel_nome}</Badge>}
          {unread && <Badge className="h-5 text-[9px] bg-destructive text-white border-0">Nova mensagem</Badge>}
        </div>
        <div className="text-sm font-semibold group-hover:text-omni transition-colors truncate">
          {item.venda?.cliente_razao_social || item.cliente_razao_social || item.cliente_nome || "Cliente não informado"}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">
          {item.venda ? `Pedido ${item.venda.numero} · ${item.venda.operadora || "—"} · ${item.venda.produto || "Produto não informado"}` : `Suporte avulso · ${item.cliente_cnpj || "CNPJ não informado"}`}
        </div>
        <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
          {item.criado_por_nome || item.venda?.consultor_nome || "Consultor"}: {item.motivo}
        </div>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
          <MessageCircle className="size-3" />
          <span>{stage?.nome || (waiting ? "Triagem" : "Sem etapa")}</span>
          <span>·</span>
          <span>{new Date(item.updated_at).toLocaleString("pt-BR")}</span>
        </div>
      </Link>

      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {canReclassify && !done && (
          <SupportPrioritySelect value={item.prioridade} onChange={onPriorityChange} disabled={working} />
        )}
        {canOperate && waiting && (
          <Button size="sm" className="gap-2 bg-omni text-black hover:bg-omni-glow" disabled={working} onClick={onCreate}>
            <Sparkles className="size-3.5" /> Criar card de atendimento
          </Button>
        )}
        {canOperate && !done && (
          <Button variant="outline" size="sm" className="gap-2" disabled={working} onClick={onResolve}>
            <CheckCircle2 className="size-3.5" /> Resolver solicitação
          </Button>
        )}
        {canOperate && done && (
          <Button variant="outline" size="sm" className="gap-2" disabled={working} onClick={onReopen}>
            <RefreshCw className="size-3.5" /> Reabrir
          </Button>
        )}
        {canDeleteStandalone && (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={working}
            title="Excluir suporte avulso"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
        <Link to="/suporte/$id" params={{ id: item.id }} className="size-9 rounded-lg border border-border grid place-items-center hover:border-omni/50 hover:text-omni">
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function TabButton({ label, count, active, onClick, accent = false }: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-3 text-left transition-colors",
        active ? "border-omni/50 bg-omni/10" : "border-border bg-card hover:bg-surface-1",
        accent && count > 0 && !active && "border-warning/40",
      )}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xl font-display font-bold mt-1">{count}</div>
    </button>
  );
}
