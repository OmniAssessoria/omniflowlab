import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, History, RefreshCw, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { buildVendaTimeline, type TimelineItem, type TimelineTone } from "@/lib/venda-timeline";
import { cn } from "@/lib/utils";

type HistoryHost = {
  vendaId: string;
  host: HTMLElement;
  originalPanel: HTMLElement;
};

function locateHistoryHost(): HistoryHost | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const match = window.location.pathname.match(/\/vendas\/([^/?#]+)/);
  const vendaId = match?.[1];
  if (!vendaId || vendaId === "nova") return null;

  const title = Array.from(document.querySelectorAll("h3"))
    .find((node) => node.textContent?.trim() === "Linha do Tempo");
  const panel = title?.closest(".rounded-xl.border") as HTMLElement | null;
  const parent = panel?.parentElement;
  if (!panel || !parent) return null;

  let host = parent.querySelector<HTMLElement>(`[data-omni-unified-history-host="${vendaId}"]`);
  if (!host) {
    host = document.createElement("div");
    host.dataset.omniUnifiedHistoryHost = vendaId;
    panel.insertAdjacentElement("afterend", host);
  }

  panel.style.display = "none";
  return { vendaId, host, originalPanel: panel };
}

export function VendaHistoricoGlobal() {
  const [context, setContext] = useState<HistoryHost | null>(null);

  useEffect(() => {
    let lastPanel: HTMLElement | null = null;
    let lastHost: HTMLElement | null = null;
    let scheduled = false;

    const locate = () => {
      scheduled = false;
      const found = locateHistoryHost();

      if (!found) {
        if (lastPanel?.isConnected) lastPanel.style.display = "";
        if (lastHost?.isConnected) lastHost.remove();
        lastPanel = null;
        lastHost = null;
        setContext(null);
        return;
      }

      if (lastPanel && lastPanel !== found.originalPanel && lastPanel.isConnected) {
        lastPanel.style.display = "";
      }
      if (lastHost && lastHost !== found.host && lastHost.isConnected) {
        lastHost.remove();
      }

      lastPanel = found.originalPanel;
      lastHost = found.host;
      setContext((current) =>
        current?.vendaId === found.vendaId && current.host === found.host ? current : found,
      );
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(locate);
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("popstate", schedule);
    schedule();

    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", schedule);
      if (lastPanel?.isConnected) lastPanel.style.display = "";
      if (lastHost?.isConnected) lastHost.remove();
    };
  }, []);

  if (!context || !context.host.isConnected) return null;
  return createPortal(<VendaHistoricoCompleto vendaId={context.vendaId} />, context.host);
}

function VendaHistoricoCompleto({ vendaId }: { vendaId: string }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    const db = supabase as any;

    try {
      const [
        historicoResult,
        statusResult,
        observacoesResult,
        notasResult,
        documentosResult,
        errosResult,
        solicitacoesResult,
        funisResult,
        etapasResult,
      ] = await Promise.all([
        db.from("venda_historico")
          .select("id,created_at,tipo,campo,valor_anterior,valor_novo,descricao,user_nome")
          .eq("venda_id", vendaId),
        db.from("venda_status_comercial_historico")
          .select("id,venda_id,status_id,status_nome_snapshot,user_id,user_nome,user_role,observacao,operadora_snapshot,sla_horas_snapshot,sla_inicio_em,sla_metade_em,sla_limite_em,created_at")
          .eq("venda_id", vendaId),
        db.from("venda_observacoes")
          .select("id,venda_id,texto,autor_nome,autor_perfil,tag_nome_snapshot,created_at,updated_at")
          .eq("venda_id", vendaId),
        db.from("venda_nota_versoes")
          .select("id,venda_id,tipo,conteudo,user_nome,created_at")
          .eq("venda_id", vendaId),
        db.from("venda_documentos")
          .select("id,venda_id,titulo,arquivo_nome_original,created_by_nome,created_at,deleted_at,deleted_by_nome")
          .eq("venda_id", vendaId),
        db.from("venda_erros")
          .select("id,erro_id,observacao,resolvido,resolvido_em,resolvido_por,created_by,created_at,erros_catalogo(nome)")
          .eq("venda_id", vendaId),
        db.from("suporte_solicitacoes")
          .select("id,numero,motivo,prioridade,criado_por_nome,created_at")
          .eq("venda_id", vendaId),
        db.from("pipeline_funis").select("id,nome"),
        db.from("pipeline_etapas").select("id,funil_id,nome"),
      ]);

      const baseResults = [
        historicoResult, statusResult, observacoesResult, notasResult, documentosResult,
        errosResult, solicitacoesResult, funisResult, etapasResult,
      ];
      const failed = baseResults.find((result) => result.error);
      if (failed?.error) throw failed.error;

      const solicitacoes = solicitacoesResult.data ?? [];
      const solicitacaoIds = solicitacoes.map((row: any) => row.id).filter(Boolean);
      let suporteEventos: any[] = [];
      let suporteMensagens: any[] = [];
      let suporteInformacoes: any[] = [];
      let suporteDocumentos: any[] = [];

      if (solicitacaoIds.length > 0) {
        const [eventosResult, mensagensResult, informacoesResult, suporteDocsResult] = await Promise.all([
          db.from("suporte_eventos")
            .select("id,solicitacao_id,tipo,descricao,user_nome,user_role,dados,created_at")
            .in("solicitacao_id", solicitacaoIds),
          db.from("suporte_mensagens")
            .select("id,solicitacao_id,autor_nome,autor_role,mensagem,anexos,created_at")
            .in("solicitacao_id", solicitacaoIds),
          db.from("suporte_informacoes")
            .select("id,solicitacao_id,informacao,created_by_nome,created_by_role,created_at")
            .in("solicitacao_id", solicitacaoIds),
          db.from("suporte_documentos")
            .select("id,solicitacao_id,titulo,arquivo_nome_original,created_by_nome,created_by_role,created_at,deleted_at,deleted_by_nome")
            .in("solicitacao_id", solicitacaoIds),
        ]);
        const supportFailed = [eventosResult, mensagensResult, informacoesResult, suporteDocsResult]
          .find((result) => result.error);
        if (supportFailed?.error) throw supportFailed.error;
        suporteEventos = eventosResult.data ?? [];
        suporteMensagens = mensagensResult.data ?? [];
        suporteInformacoes = informacoesResult.data ?? [];
        suporteDocumentos = suporteDocsResult.data ?? [];
      }

      const erros = errosResult.data ?? [];
      const profileIds = Array.from(new Set(
        erros.flatMap((row: any) => [row.created_by, row.resolvido_por]).filter(Boolean),
      ));
      let profileNames = new Map<string, string>();
      if (profileIds.length > 0) {
        const profilesResult = await db.from("profiles")
          .select("id,nome_completo,email")
          .in("id", profileIds);
        if (!profilesResult.error) {
          profileNames = new Map((profilesResult.data ?? []).map((row: any) => [
            String(row.id), String(row.nome_completo || row.email || "Usuário"),
          ]));
        }
      }

      const errosEnriquecidos = erros.map((row: any) => ({
        ...row,
        erro_nome: Array.isArray(row.erros_catalogo)
          ? row.erros_catalogo[0]?.nome ?? null
          : row.erros_catalogo?.nome ?? null,
        created_by_nome: row.created_by ? profileNames.get(String(row.created_by)) ?? null : null,
        resolvido_por_nome: row.resolvido_por ? profileNames.get(String(row.resolvido_por)) ?? null : null,
      }));

      setItems(buildVendaTimeline({
        vendaHistorico: historicoResult.data ?? [],
        statusComercial: statusResult.data ?? [],
        observacoes: observacoesResult.data ?? [],
        notaVersoes: notasResult.data ?? [],
        documentos: documentosResult.data ?? [],
        erros: errosEnriquecidos,
        suporteSolicitacoes: solicitacoes,
        suporteEventos,
        suporteMensagens,
        suporteInformacoes,
        suporteDocumentos,
      }, {
        funis: funisResult.data ?? [],
        etapas: etapasResult.data ?? [],
      }));
    } catch (err) {
      console.error("[HISTÓRICO COMPLETO]", err);
      setError(err instanceof Error ? err.message : "Não foi possível carregar o histórico completo.");
    } finally {
      setLoading(false);
    }
  }, [vendaId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <History className="size-4 text-omni" />
            <h3 className="font-display font-semibold">Linha do Tempo Completa</h3>
            {!loading && <Badge variant="outline" className="text-[9px]">{items.length} eventos</Badge>}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Pipeline, Status Comercial, observações, notas, documentos, erros e Suporte em uma única ordem cronológica.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void carregar()} disabled={loading}>
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} /> Atualizar
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          Falha ao carregar o histórico completo: {error}
        </div>
      ) : loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">Carregando todos os registros do pedido…</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground italic">Nenhum evento registrado ainda.</div>
      ) : (
        <div className="relative space-y-4 pl-6">
          <div className="absolute bottom-2 left-2 top-2 w-px bg-border" />
          {items.map((item) => <TimelineRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const date = new Date(item.createdAt);
  return (
    <div className="relative rounded-lg border border-border/50 bg-background/25 px-3 py-2.5">
      <span className={cn(
        "absolute -left-[22px] top-3 size-2.5 rounded-full ring-4 ring-card",
        toneDot(item.tone),
      )} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-mono text-muted-foreground">{date.toLocaleString("pt-BR")}</span>
        {item.badge && (
          <Badge variant="outline" className={cn("h-4 px-1.5 py-0 text-[8px]", toneBadge(item.tone))}>
            {item.badge}
          </Badge>
        )}
        {(item.userName || item.userRole) && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <UserRound className="size-3" /> {item.userName || "Sistema"}{item.userRole ? ` · ${roleLabel(item.userRole)}` : ""}
          </span>
        )}
      </div>
      <div className="mt-1 text-sm font-semibold">{item.title}</div>
      {(item.previous || item.next) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-md border border-border/50 bg-card/50 px-2.5 py-1.5 text-[11px]">
          <span className="text-muted-foreground">{item.previous || "—"}</span>
          <ArrowRight className="size-3 text-omni" />
          <span className="font-semibold text-foreground">{item.next || "—"}</span>
        </div>
      )}
      {item.description && (
        <div className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">{item.description}</div>
      )}
    </div>
  );
}

function roleLabel(role: string) {
  const value = role.toLowerCase();
  if (value === "admin") return "Administrador";
  if (value === "bko") return "BKO";
  if (value === "gestor" || value === "gestao") return "Gestão";
  if (value === "consultor") return "Consultor";
  if (value === "suporte") return "Suporte";
  return role;
}

function toneDot(tone: TimelineTone) {
  const classes: Record<TimelineTone, string> = {
    omni: "bg-[var(--omni)]",
    info: "bg-info",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    purple: "bg-purple",
    "muted-foreground": "bg-muted-foreground",
  };
  return classes[tone];
}

function toneBadge(tone: TimelineTone) {
  const classes: Record<TimelineTone, string> = {
    omni: "border-[var(--omni)]/40 text-[var(--omni)]",
    info: "border-info/40 text-info",
    success: "border-success/40 text-success",
    warning: "border-warning/40 text-warning",
    destructive: "border-destructive/40 text-destructive",
    purple: "border-purple/40 text-purple",
    "muted-foreground": "border-border text-muted-foreground",
  };
  return classes[tone];
}
