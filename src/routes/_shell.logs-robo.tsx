import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot, ChevronLeft, ChevronRight, Eye, RefreshCw, Search, ShieldX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { buildVendaDetailUrl } from "@/lib/rotas";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_shell/logs-robo")({
  component: LogsRoboPage,
});

const PAGE_SIZE = 50;

type VendaResumo = {
  id: string;
  numero: string | null;
  cliente_razao_social: string | null;
  cliente_cnpj: string | null;
  operadora: string | null;
  consultor_nome: string | null;
  status_pedido: string | null;
  status_biometria: string | null;
  status_leitura_robo: string | null;
  statusleiturarobo: string | null;
  data_ativacao: string | null;
  data_input: string | null;
  data_aceite: string | null;
};

type RoboLog = {
  id: string;
  venda_id: string | null;
  venda_numero: string | null;
  created_at: string;
  robo_nome: string | null;
  origem: string | null;
  acao: string | null;
  campo: string | null;
  campo_label: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  descricao: string | null;
  detalhes: Record<string, unknown> | null;
  vendas: VendaResumo | null;
};

const CAMPOS = [
  ["todos", "Todos os campos"],
  ["status_pedido", "Status do pedido"],
  ["status_leitura_robo", "Status da leitura do robô"],
  ["status_biometria", "Status de biometria"],
  ["data_ativacao", "Ativação"],
  ["data_input", "Input"],
  ["data_aceite", "Aceite"],
] as const;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR");
}

function humanize(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  return text.replace(/_/g, " ");
}

function cleanSearch(value: string) {
  return value.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ");
}

function valorAtualDaVenda(log: RoboLog): string {
  const venda = log.vendas;
  if (!venda || !log.campo) return "—";

  const campoAtual = log.campo === "status_leitura_robo"
    ? venda.status_leitura_robo || venda.statusleiturarobo
    : (venda as Record<string, unknown>)[log.campo];

  if (campoAtual === null || campoAtual === undefined || String(campoAtual).trim() === "") {
    return "—";
  }
  return String(campoAtual);
}

function LogValueBox({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | null | undefined;
  tone?: "default" | "muted" | "current";
}) {
  return (
    <div className={cn(
      "min-w-0 rounded-xl border p-3",
      tone === "current" && "border-emerald-500/25 bg-emerald-500/[0.05]",
      tone === "muted" && "border-border bg-surface-1/55",
      tone === "default" && "border-border bg-card",
    )}>
      <div className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
        {value && String(value).trim() ? value : "—"}
      </div>
    </div>
  );
}

function LogsRoboPage() {
  const { primaryRole } = useAuth();
  const [logs, setLogs] = useState<RoboLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [campo, setCampo] = useState("todos");
  const [dataFiltro, setDataFiltro] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [logSelecionado, setLogSelecionado] = useState<RoboLog | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async () => {
    if (!["admin", "bko", "gestor"].includes(primaryRole ?? "")) return;

    setLoading(true);
    try {
      const db = supabase as any;
      let query = db
        .from("venda_robo_logs")
        .select(
          "id,venda_id,venda_numero,created_at,robo_nome,origem,acao,campo,campo_label,valor_anterior,valor_novo,descricao,detalhes,vendas:venda_id(id,numero,cliente_razao_social,cliente_cnpj,operadora,consultor_nome,status_pedido,status_biometria,status_leitura_robo,statusleiturarobo,data_ativacao,data_input,data_aceite)",
          { count: "exact" },
        )
        .order("created_at", { ascending: false });

      if (campo !== "todos") {
        query = query.eq("campo", campo);
      }

      if (dataFiltro) {
        const [ano, mes, dia] = dataFiltro.split("-").map(Number);
        const inicio = new Date(ano, mes - 1, dia);
        const fim = new Date(ano, mes - 1, dia + 1);
        query = query
          .gte("created_at", inicio.toISOString())
          .lt("created_at", fim.toISOString());
      }

      const term = cleanSearch(search);
      if (term) {
        query = query.or(
          [
            `venda_numero.ilike.%${term}%`,
            `robo_nome.ilike.%${term}%`,
            `origem.ilike.%${term}%`,
            `campo.ilike.%${term}%`,
            `campo_label.ilike.%${term}%`,
            `valor_anterior.ilike.%${term}%`,
            `valor_novo.ilike.%${term}%`,
            `descricao.ilike.%${term}%`,
          ].join(","),
        );
      }

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count, error } = await query.range(from, to);

      if (error) throw error;
      setLogs((data ?? []) as RoboLog[]);
      setTotal(Number(count ?? 0));
    } catch (error) {
      console.error("[LOGS DO ROBÔ] Falha ao carregar logs globais:", error);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [primaryRole, page, campo, dataFiltro, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!["admin", "bko", "gestor"].includes(primaryRole ?? "")) return;

    const channel = supabase
      .channel("logs-robo-global-admin-bko-gestor")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "venda_robo_logs" },
        () => {
          if (page === 0) void load();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [primaryRole, page, load]);

  useEffect(() => {
    setPage(0);
  }, [campo, dataFiltro, search]);

  const primeiro = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const ultimo = Math.min(total, (page + 1) * PAGE_SIZE);

  const stats = useMemo(() => {
    const status = logs.filter(item => item.campo === "status_pedido").length;
    const biometria = logs.filter(item => item.campo === "status_biometria").length;
    const datas = logs.filter(item => String(item.campo ?? "").startsWith("data_")).length;
    return { status, biometria, datas };
  }, [logs]);

  if (!["admin", "bko", "gestor"].includes(primaryRole ?? "")) {
    return (
      <div className="p-4 sm:p-6">
        <Card className="max-w-xl border-border bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldX className="size-6 text-destructive" />
              <CardTitle>Sem permissão</CardTitle>
            </div>
            <CardDescription>Esta tela é exclusiva para administradores, BKO e gestores.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-purple" />
            <h1 className="font-display text-2xl font-bold tracking-tight">Logs do Robô</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Alterações registradas pelo robô em todas as vendas, da mais recente para a mais antiga.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Total encontrado</div>
          <div className="mt-1 text-xl font-bold">{total.toLocaleString("pt-BR")}</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Status nesta página</div>
          <div className="mt-1 text-xl font-bold">{stats.status}</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Biometria nesta página</div>
          <div className="mt-1 text-xl font-bold">{stats.biometria}</div>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Datas nesta página</div>
          <div className="mt-1 text-xl font-bold">{stats.datas}</div>
        </div>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="gap-3 pb-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-base">Histórico global</CardTitle>
              <CardDescription>
                Exibindo {primeiro.toLocaleString("pt-BR")}–{ultimo.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} eventos.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex h-8 min-w-[280px] items-center gap-2 rounded-md border border-input bg-background px-2">
                <Search className="size-3.5 shrink-0 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={event => setSearchInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter") setSearch(searchInput.trim());
                  }}
                  placeholder="Pedido, status, campo ou texto do log..."
                  className="h-7 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setSearch(searchInput.trim())}
                >
                  Buscar
                </Button>
              </div>

              <Input
                type="date"
                value={dataFiltro}
                onChange={event => setDataFiltro(event.target.value)}
                aria-label="Filtrar logs por data"
                title="Filtrar logs por data"
                className="h-8 w-full text-xs sm:w-[150px]"
              />

              <Select value={campo} onValueChange={setCampo}>
                <SelectTrigger className="h-8 w-full text-xs sm:w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPOS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1480px]">
              <TableHeader>
                <TableRow className="bg-surface-1">
                  <TableHead className="w-[105px] px-2">Data</TableHead>
                  <TableHead className="w-[120px] px-2">Pedido</TableHead>
                  <TableHead className="min-w-[220px] px-2">Cliente</TableHead>
                  <TableHead className="w-[68px] px-2">Op.</TableHead>
                  <TableHead className="min-w-[140px] px-2">Robô / origem</TableHead>
                  <TableHead className="min-w-[165px] px-2">Campo alterado</TableHead>
                  <TableHead className="min-w-[205px] px-2">Valor anterior</TableHead>
                  <TableHead className="min-w-[205px] px-2">Novo valor no evento</TableHead>
                  <TableHead className="min-w-[310px] px-2">Log completo</TableHead>
                  <TableHead className="w-[52px] px-2 text-center">Ver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-sm text-muted-foreground">
                      Carregando logs...
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-sm text-muted-foreground">
                      Nenhum evento encontrado para este filtro.
                    </TableCell>
                  </TableRow>
                ) : logs.map(log => {
                  const venda = log.vendas;
                  const vendaId = log.venda_id || venda?.id || null;
                  const numero = log.venda_numero || venda?.numero || "Não informado";
                  return (
                    <TableRow key={log.id} className="align-top [&>td]:px-2 [&>td]:py-2.5">
                      <TableCell className="whitespace-nowrap font-mono text-[10px]">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell>
                        {vendaId ? (
                          <Link
                            {...buildVendaDetailUrl(vendaId)}
                            className="font-mono text-[11px] font-semibold text-omni hover:underline"
                          >
                            {numero}
                          </Link>
                        ) : (
                          <span className="font-mono text-[11px]">{numero}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="whitespace-normal break-words text-xs font-medium">
                          {venda?.cliente_razao_social || "—"}
                        </div>
                        <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">
                          {venda?.cliente_cnpj || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px]",
                            venda?.operadora === "CLARO" && "border-red-500/35 text-red-500",
                            venda?.operadora === "VIVO" && "border-purple-500/35 text-purple-500",
                          )}
                        >
                          {venda?.operadora || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-[10px] font-semibold">{log.robo_nome || "Robô"}</div>
                        <div className="mt-0.5 text-[9px] text-muted-foreground">{humanize(log.origem)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className="whitespace-normal text-left text-[9px]">
                            {log.campo_label || humanize(log.campo)}
                          </Badge>
                          <div className="break-all font-mono text-[9px] text-muted-foreground">{log.campo || "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap break-words text-[10px] leading-relaxed text-muted-foreground">
                        {log.valor_anterior || "—"}
                      </TableCell>
                      <TableCell className="whitespace-pre-wrap break-words text-[10px] font-semibold leading-relaxed">
                        {log.valor_novo || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="whitespace-pre-wrap break-words text-[10px] leading-relaxed">
                          {log.descricao || humanize(log.acao)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => setLogSelecionado(log)}
                          title="Visualizar log completo"
                          aria-label="Visualizar log completo"
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-2 border-t border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[10px] text-muted-foreground">
              Página {Math.min(page + 1, totalPages)} de {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-[10px]"
                disabled={page === 0 || loading}
                onClick={() => setPage(current => Math.max(0, current - 1))}
              >
                <ChevronLeft className="size-3" /> Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 px-2 text-[10px]"
                disabled={page >= totalPages - 1 || loading}
                onClick={() => setPage(current => current + 1)}
              >
                Próxima <ChevronRight className="size-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(logSelecionado)} onOpenChange={(open) => !open && setLogSelecionado(null)}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          {logSelecionado && (() => {
            const venda = logSelecionado.vendas;
            const vendaId = logSelecionado.venda_id || venda?.id || null;
            const numero = logSelecionado.venda_numero || venda?.numero || "Não informado";
            const atual = valorAtualDaVenda(logSelecionado);
            const detalhes = logSelecionado.detalhes && Object.keys(logSelecionado.detalhes).length > 0
              ? JSON.stringify(logSelecionado.detalhes, null, 2)
              : "";

            return (
              <>
                <DialogHeader>
                  <div className="flex flex-col gap-2 pr-8 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <DialogTitle className="flex items-center gap-2">
                        <Eye className="size-4 text-omni" />
                        Log completo do robô
                      </DialogTitle>
                      <DialogDescription className="mt-1">
                        {formatDate(logSelecionado.created_at)} · {logSelecionado.robo_nome || "Robô"}
                      </DialogDescription>
                    </div>
                    {vendaId && (
                      <Link
                        {...buildVendaDetailUrl(vendaId)}
                        className="shrink-0 rounded-md border border-border px-3 py-1.5 font-mono text-[10px] font-semibold text-omni hover:bg-muted"
                      >
                        Abrir pedido {numero}
                      </Link>
                    )}
                  </div>
                </DialogHeader>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-border bg-surface-1/45 p-3">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Pedido</div>
                    <div className="mt-1 break-words font-mono text-xs font-bold">{numero}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-1/45 p-3 md:col-span-1 xl:col-span-2">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Cliente</div>
                    <div className="mt-1 break-words text-xs font-bold">{venda?.cliente_razao_social || "—"}</div>
                    <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{venda?.cliente_cnpj || "—"}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-surface-1/45 p-3">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Operadora</div>
                    <div className="mt-1 text-xs font-bold">{venda?.operadora || "—"}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{logSelecionado.campo_label || humanize(logSelecionado.campo)}</Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">{logSelecionado.campo || "—"}</span>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    <LogValueBox label="Valor anterior" value={logSelecionado.valor_anterior} tone="muted" />
                    <LogValueBox label="Novo valor neste evento" value={logSelecionado.valor_novo} />
                    <LogValueBox label="Valor atual da venda" value={atual} tone="current" />
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Robô</div>
                    <div className="mt-1 text-xs font-semibold">{logSelecionado.robo_nome || "—"}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Origem</div>
                    <div className="mt-1 text-xs font-semibold">{humanize(logSelecionado.origem)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Ação</div>
                    <div className="mt-1 text-xs font-semibold">{humanize(logSelecionado.acao)}</div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">Descrição completa</div>
                  <div className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed">
                    {logSelecionado.descricao || "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">Contexto da venda</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <LogValueBox label="Status pedido atual" value={venda?.status_pedido} />
                    <LogValueBox label="Biometria atual" value={venda?.status_biometria} />
                    <LogValueBox label="Leitura do robô atual" value={venda?.status_leitura_robo || venda?.statusleiturarobo} />
                    <LogValueBox label="Consultor" value={venda?.consultor_nome} />
                    <LogValueBox label="Data ativação" value={venda?.data_ativacao} />
                    <LogValueBox label="Data input" value={venda?.data_input} />
                    <LogValueBox label="Data aceite" value={venda?.data_aceite} />
                    <LogValueBox label="ID da venda" value={vendaId} />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">Detalhes técnicos do evento</div>
                  {detalhes ? (
                    <pre className="mt-3 max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface-1 p-3 text-[10px] leading-relaxed text-muted-foreground">
                      {detalhes}
                    </pre>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">Sem detalhes técnicos adicionais.</div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
