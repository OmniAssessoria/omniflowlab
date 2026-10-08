import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Loader2, RefreshCw, ScrollText, Search } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { auditActionLabel, auditOriginLabel, type AuditOrigin } from "@/lib/audit-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuditFeedRow {
  id: string;
  origin: AuditOrigin;
  action: string;
  description: string;
  userId: string | null;
  userName: string | null;
  entity: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  details: unknown;
  createdAt: string;
}

const ORIGIN_BADGE: Record<AuditOrigin, string> = {
  sistema: "border-info/35 bg-info/10 text-info",
  pedido: "border-omni/35 bg-omni/10 text-omni",
  status_comercial: "border-warning/35 bg-warning/10 text-warning",
  suporte: "border-success/35 bg-success/10 text-success",
  importacao: "border-violet-400/35 bg-violet-400/10 text-violet-300",
  chamado_sla: "border-cyan-400/35 bg-cyan-400/10 text-cyan-300",
};

function fmtDate(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function shortId(value?: string | null) {
  if (!value) return "—";
  return value.length > 16 ? `${value.slice(0, 8)}…` : value;
}

function detailsText(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AuditoriaPanel() {
  const [rows, setRows] = useState<AuditFeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [origin, setOrigin] = useState<"todas" | AuditOrigin>("todas");
  const [selected, setSelected] = useState<AuditFeedRow | null>(null);
  const [partialErrors, setPartialErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const issues: string[] = [];

    try {
    const [
      auditResult,
      vendaResult,
      statusResult,
      suporteResult,
      importResult,
      ticketSlaResult,
    ] = await Promise.all([
      (supabase as any)
        .from("audit_logs")
        .select("id, user_id, user_email, acao, descricao, entidade, entidade_id, valor_anterior, valor_novo, ip, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      (supabase as any)
        .from("venda_historico")
        .select("id, venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      (supabase as any)
        .from("venda_status_comercial_historico")
        .select("id, venda_id, status_nome_snapshot, user_id, user_nome, user_role, observacao, operadora_snapshot, sla_horas_snapshot, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      (supabase as any)
        .from("suporte_eventos")
        .select("id, solicitacao_id, ticket_id, tipo, descricao, user_id, user_nome, user_role, dados, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      (supabase as any)
        .from("import_logs")
        .select("id, arquivo, operadora, mes_ref, ano_ref, total_linhas, total_inseridas, total_duplicadas, total_erros, importado_por, created_at")
        .order("created_at", { ascending: false })
        .limit(300),
      (supabase as any)
        .from("ticket_sla_historico")
        .select("id, ticket_id, status_anterior, status_novo, sla_due_at_anterior, sla_due_at_novo, changed_by, changed_by_nome, created_at")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const feed: AuditFeedRow[] = [];

    if (auditResult.error) {
      issues.push(`Sistema: ${auditResult.error.message}`);
    } else {
      for (const row of auditResult.data ?? []) {
        const action = String(row.acao || "");
        const auditOrigin: AuditOrigin = action.startsWith("sla_status_") || action.startsWith("status_comercial_")
          ? "status_comercial"
          : action.startsWith("suporte_")
            ? "suporte"
            : ["venda", "venda_linha"].includes(String(row.entidade || ""))
              ? "pedido"
              : "sistema";
        feed.push({
          id: `sistema:${row.id}`,
          origin: auditOrigin,
          action: row.acao || "acao",
          description: row.descricao || "Ação registrada no sistema.",
          userId: row.user_id,
          userName: row.user_email,
          entity: row.entidade,
          entityId: row.entidade_id,
          before: row.valor_anterior,
          after: row.valor_novo,
          details: row.ip ? { ip: row.ip } : null,
          createdAt: row.created_at,
        });
      }
    }

    if (vendaResult.error) {
      issues.push(`Pedidos: ${vendaResult.error.message}`);
    } else {
      for (const row of vendaResult.data ?? []) {
        const tipo = String(row.tipo || "alterada").toLowerCase();
        const action = tipo.includes("mov") ? "venda_movida"
          : tipo.includes("concl") ? "venda_concluida"
          : tipo.includes("cri") ? "venda_criada"
          : "venda_alterada";
        feed.push({
          id: `pedido:${row.id}`,
          origin: "pedido",
          action,
          description: row.descricao || (row.campo
            ? `${row.campo}: ${row.valor_anterior ?? "—"} → ${row.valor_novo ?? "—"}`
            : "Alteração registrada no pedido."),
          userId: row.user_id,
          userName: row.user_nome,
          entity: "venda",
          entityId: row.venda_id,
          before: row.campo ? { campo: row.campo, valor: row.valor_anterior } : row.valor_anterior,
          after: row.campo ? { campo: row.campo, valor: row.valor_novo } : row.valor_novo,
          details: { tipo: row.tipo, campo: row.campo },
          createdAt: row.created_at,
        });
      }
    }

    if (statusResult.error) {
      issues.push(`Status Comercial: ${statusResult.error.message}`);
    } else {
      for (const row of statusResult.data ?? []) {
        feed.push({
          id: `status:${row.id}`,
          origin: "status_comercial",
          action: "status_comercial_alterado",
          description: `${row.status_nome_snapshot}${row.operadora_snapshot ? ` · ${row.operadora_snapshot}` : ""}${row.sla_horas_snapshot ? ` · SLA ${row.sla_horas_snapshot}h` : ""}`,
          userId: row.user_id,
          userName: row.user_nome,
          entity: "venda",
          entityId: row.venda_id,
          before: null,
          after: {
            status: row.status_nome_snapshot,
            operadora: row.operadora_snapshot,
            sla_horas: row.sla_horas_snapshot,
          },
          details: {
            perfil: row.user_role,
            observacao: row.observacao,
          },
          createdAt: row.created_at,
        });
      }
    }

    if (suporteResult.error) {
      issues.push(`Suporte: ${suporteResult.error.message}`);
    } else {
      for (const row of suporteResult.data ?? []) {
        feed.push({
          id: `suporte:${row.id}`,
          origin: "suporte",
          action: row.tipo || "suporte",
          description: row.descricao || "Evento de suporte.",
          userId: row.user_id,
          userName: row.user_nome,
          entity: "suporte_solicitacao",
          entityId: row.solicitacao_id,
          before: null,
          after: null,
          details: {
            ticket_id: row.ticket_id,
            perfil: row.user_role,
            ...(row.dados && typeof row.dados === "object" ? row.dados : { dados: row.dados }),
          },
          createdAt: row.created_at,
        });
      }
    }

    if (importResult.error) {
      issues.push(`Importações: ${importResult.error.message}`);
    } else {
      for (const row of importResult.data ?? []) {
        feed.push({
          id: `import:${row.id}`,
          origin: "importacao",
          action: "importacao",
          description: `${row.arquivo || "Arquivo"} · ${row.operadora || "Operadora não informada"} · ${row.total_inseridas ?? 0} inserida(s), ${row.total_duplicadas ?? 0} duplicada(s), ${row.total_erros ?? 0} erro(s)`,
          userId: row.importado_por,
          userName: null,
          entity: "importacao",
          entityId: row.id,
          before: null,
          after: {
            arquivo: row.arquivo,
            operadora: row.operadora,
            competencia: row.mes_ref && row.ano_ref ? `${String(row.mes_ref).padStart(2, "0")}/${row.ano_ref}` : null,
            total_linhas: row.total_linhas,
            total_inseridas: row.total_inseridas,
            total_duplicadas: row.total_duplicadas,
            total_erros: row.total_erros,
          },
          details: null,
          createdAt: row.created_at,
        });
      }
    }

    if (ticketSlaResult.error) {
      issues.push(`SLA de Chamados: ${ticketSlaResult.error.message}`);
    } else {
      for (const row of ticketSlaResult.data ?? []) {
        feed.push({
          id: `ticket-sla:${row.id}`,
          origin: "chamado_sla",
          action: "sla_chamado_alterado",
          description: `Status ${row.status_anterior || "—"} → ${row.status_novo || "—"}`,
          userId: row.changed_by,
          userName: row.changed_by_nome,
          entity: "ticket",
          entityId: row.ticket_id,
          before: {
            status: row.status_anterior,
            sla_limite: row.sla_due_at_anterior,
          },
          after: {
            status: row.status_novo,
            sla_limite: row.sla_due_at_novo,
          },
          details: null,
          createdAt: row.created_at,
        });
      }
    }

    const userIds = Array.from(new Set(feed.map(item => item.userId).filter(Boolean) as string[]));
    const profileMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from("profiles")
        .select("id, nome_completo, email")
        .in("id", userIds);
      if (!profilesError) {
        for (const profile of profiles ?? []) {
          profileMap.set(profile.id, profile.nome_completo || profile.email || shortId(profile.id));
        }
      }
    }

    for (const item of feed) {
      if (!item.userName && item.userId) {
        item.userName = profileMap.get(item.userId) || shortId(item.userId);
      }
    }

    feed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setRows(feed.slice(0, 1200));
    setPartialErrors(issues);

    if (issues.length > 0) {
      toast.warning("Auditoria carregada parcialmente", {
        description: `${issues.length} fonte(s) não puderam ser consultadas. As demais continuam disponíveis.`,
      });
    }
    } catch (error: any) {
      console.error("[AUDITORIA OPERACIONAL]", error);
      setPartialErrors(["Falha geral ao consultar as fontes de auditoria."]);
      toast.error("Não foi possível atualizar a Auditoria", {
        description: error?.message || "Falha inesperada ao consultar o Supabase.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const byOrigin = new Map<AuditOrigin, number>();
    for (const row of rows) byOrigin.set(row.origin, (byOrigin.get(row.origin) ?? 0) + 1);
    return byOrigin;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("pt-BR");
    return rows.filter(row => {
      if (origin !== "todas" && row.origin !== origin) return false;
      if (!q) return true;
      return [
        auditOriginLabel(row.origin),
        auditActionLabel(row.action),
        row.action,
        row.description,
        row.userName,
        row.entity,
        row.entityId,
      ].some(value => String(value ?? "").toLocaleLowerCase("pt-BR").includes(q));
    });
  }, [rows, query, origin]);

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border bg-surface-1 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ScrollText className="size-4 text-omni" />
              <h2 className="font-display font-semibold">Auditoria Operacional</h2>
              <Badge variant="outline" className="text-[10px]">{rows.length} registros</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Consolida ações do sistema, pedidos, Status Comercial, Suporte, importações e SLA de chamados.
            </p>
            {partialErrors.length > 0 && (
              <p className="mt-1 text-[10px] text-warning">
                {partialErrors.length} fonte(s) com falha nesta atualização. Os demais registros foram carregados normalmente.
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {(["sistema", "pedido", "status_comercial", "suporte", "importacao", "chamado_sla"] as AuditOrigin[]).map(item => (
            <button
              type="button"
              key={item}
              onClick={() => setOrigin(origin === item ? "todas" : item)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${origin === item ? "border-omni bg-omni/10" : "border-border bg-background/20 hover:border-omni/40"}`}
            >
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{auditOriginLabel(item)}</div>
              <div className="mt-0.5 text-base font-semibold">{counts.get(item) ?? 0}</div>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Buscar na auditoria por ação, usuário, descrição ou entidade…"
              className="pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Origem
            <select
              value={origin}
              onChange={event => setOrigin(event.target.value as "todas" | AuditOrigin)}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground"
            >
              <option value="todas">Todas</option>
              <option value="sistema">Sistema</option>
              <option value="pedido">Pedido</option>
              <option value="status_comercial">Status Comercial</option>
              <option value="suporte">Suporte</option>
              <option value="importacao">Importação</option>
              <option value="chamado_sla">SLA de Chamado</option>
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 p-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando auditoria…
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Nenhum registro encontrado para estes filtros.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-xs">
            <thead className="bg-muted/15 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Quando</th>
                <th className="px-3 py-2 text-left">Origem</th>
                <th className="px-3 py-2 text-left">Ação</th>
                <th className="px-3 py-2 text-left">Usuário</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Entidade</th>
                <th className="px-3 py-2 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.map(row => (
                <tr key={row.id} className="hover:bg-muted/10">
                  <td className="px-4 py-3 whitespace-nowrap text-[10px] text-muted-foreground">{fmtDate(row.createdAt)}</td>
                  <td className="px-3 py-3">
                    <Badge variant="outline" className={`text-[9px] ${ORIGIN_BADGE[row.origin]}`}>
                      {auditOriginLabel(row.origin)}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 font-medium">{auditActionLabel(row.action)}</td>
                  <td className="px-3 py-3">{row.userName || shortId(row.userId)}</td>
                  <td className="px-3 py-3 max-w-[360px]">
                    <div className="line-clamp-2 text-muted-foreground">{row.description}</div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <div>{row.entity || "—"}</div>
                    {row.entityId && <div className="font-mono text-[9px]">{shortId(row.entityId)}</div>}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 text-[10px]"
                      onClick={() => setSelected(row)}
                    >
                      <Eye className="size-3.5" /> Detalhes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selected ? auditActionLabel(selected.action) : "Detalhes da Auditoria"}</DialogTitle>
            <DialogDescription>
              {selected ? `${auditOriginLabel(selected.origin)} · ${fmtDate(selected.createdAt)} · ${selected.userName || shortId(selected.userId)}` : ""}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-3 text-xs">
              <div className="rounded-lg border border-border bg-surface-1 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Descrição</div>
                <div className="mt-1 whitespace-pre-wrap">{selected.description}</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border border-border bg-surface-1 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Antes</div>
                  <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px]">{detailsText(selected.before)}</pre>
                </div>
                <div className="rounded-lg border border-border bg-surface-1 p-3">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Depois</div>
                  <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px]">{detailsText(selected.after)}</pre>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-surface-1 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Informações complementares</div>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px]">{detailsText(selected.details)}</pre>
              </div>

              <div className="text-[10px] text-muted-foreground">
                Entidade: {selected.entity || "—"} · ID: {selected.entityId || "—"}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
