import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, FileText, Plus, ChevronLeft, ChevronRight, Building2,
  ListFilter, History, Download, Search, Trash2, Bot, Check, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, Maximize2, Minimize2,
  Eye, Pencil, Mail, Phone
} from "lucide-react";
import { buildVendaDetailUrl } from "@/lib/rotas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFeatures } from "@/lib/features";
import { useColaboradoresDB, useCatalogo } from "@/lib/catalogos";
import { cn } from "@/lib/utils";
import { NovaVendaDialog } from "@/components/nova-venda-dialog";
import { ClienteRepresentantes } from "@/components/cliente-representantes";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { maskPhone, maskValor } from "@/lib/mask";
import { toast } from "sonner";
import { getSlaState } from "@/lib/status-sla";
import { normalizedDisplayKey, uniqueNormalizedStrings, uppercaseDisplay } from "@/lib/display-normalization";
import {
  SLA_FILTER_OPTIONS,
  type FilterOption,
  meusPedidosCorrespondeMesAno,
  pedidoProdutoVisivelEmMeusPedidos,
  pedidoStatusMaisRecente,
  pedidoTableColumns,
  statusFiltroCorresponde,
  statusFiltroSelecionadosDisponiveis,
} from "@/lib/clientes-pedidos-rules";

const PAGE_SIZE = 30;
const MEUS_PEDIDOS_COLUMN_FILTERS_KEY = "omni:meus-pedidos:column-filters:v1";

type PedidoDateColumn = "Ult. Alteração" | "Recebimento" | "Preenchimento" | "Envio" | "Aceite" | "Ativação" | "Portabilidade";
type PedidoColumnFacet = "tipo_pedido" | "tipo_produto" | "consultor" | PedidoDateColumn;
type PedidoDateFilterMode = "todos" | "com_data" | "sem_data" | "datas";
type PedidoDateFilter = {
  mode: PedidoDateFilterMode;
  dates: string[];
};

const DEFAULT_PEDIDO_DATE_FILTERS: Record<PedidoDateColumn, PedidoDateFilter> = {
  "Ult. Alteração": { mode: "todos", dates: [] },
  "Recebimento": { mode: "todos", dates: [] },
  "Preenchimento": { mode: "todos", dates: [] },
  "Envio": { mode: "todos", dates: [] },
  "Aceite": { mode: "todos", dates: [] },
  "Ativação": { mode: "todos", dates: [] },
  "Portabilidade": { mode: "todos", dates: [] },
};

function normalizeStoredDateFilter(value: unknown): PedidoDateFilter {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const raw = value as { mode?: unknown; dates?: unknown };
    const mode = raw.mode === "com_data" || raw.mode === "sem_data" || raw.mode === "datas" ? raw.mode : "todos";
    const dates = Array.isArray(raw.dates)
      ? raw.dates.filter((item): item is string => typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item))
      : [];
    return { mode, dates: mode === "datas" ? Array.from(new Set(dates)).sort() : [] };
  }

  // Compatibilidade com o filtro antigo salvo no localStorage.
  if (value === "com_data") return { mode: "com_data", dates: [] };
  if (value === "sem_data") return { mode: "sem_data", dates: [] };
  return { mode: "todos", dates: [] };
}

type MeusPedidosColumnFilterMemory = {
  operadora?: string;
  statusSelecionados?: string[];
  statusSelecaoManual?: boolean;
  consultoresColunaOcultos?: string[];
  slaFiltro?: string;
  tipoPedidoColunaOcultos?: string[];
  tipoProdutoColunaOcultos?: string[];
  datasColuna?: Partial<Record<PedidoDateColumn, PedidoDateFilter>>;
};

function readMeusPedidosColumnFilters(): MeusPedidosColumnFilterMemory {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(MEUS_PEDIDOS_COLUMN_FILTERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    return {
      operadora: typeof parsed.operadora === "string" ? parsed.operadora : undefined,
      statusSelecionados: Array.isArray(parsed.statusSelecionados)
        ? parsed.statusSelecionados.filter((value: unknown): value is string => typeof value === "string")
        : undefined,
      statusSelecaoManual: typeof parsed.statusSelecaoManual === "boolean"
        ? parsed.statusSelecaoManual
        : undefined,
      consultoresColunaOcultos: Array.isArray(parsed.consultoresColunaOcultos)
        ? parsed.consultoresColunaOcultos.filter((value: unknown): value is string => typeof value === "string")
        : undefined,
      slaFiltro: typeof parsed.slaFiltro === "string" ? parsed.slaFiltro : undefined,
      tipoPedidoColunaOcultos: Array.isArray(parsed.tipoPedidoColunaOcultos)
        ? parsed.tipoPedidoColunaOcultos.filter((value: unknown): value is string => typeof value === "string")
        : undefined,
      tipoProdutoColunaOcultos: Array.isArray(parsed.tipoProdutoColunaOcultos)
        ? parsed.tipoProdutoColunaOcultos.filter((value: unknown): value is string => typeof value === "string")
        : undefined,
      datasColuna: parsed.datasColuna && typeof parsed.datasColuna === "object"
        ? Object.fromEntries(
            (Object.keys(DEFAULT_PEDIDO_DATE_FILTERS) as PedidoDateColumn[]).map(column => [
              column,
              normalizeStoredDateFilter(parsed.datasColuna[column]),
            ]),
          ) as Partial<Record<PedidoDateColumn, PedidoDateFilter>>
        : undefined,
    };
  } catch {
    return {};
  }
}

function writeMeusPedidosColumnFilters(memory: MeusPedidosColumnFilterMemory) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEUS_PEDIDOS_COLUMN_FILTERS_KEY, JSON.stringify(memory));
  } catch {
    // A grade continua funcional mesmo sem armazenamento local.
  }
}

/* ---------- helpers ---------- */

function useDebounced<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const ANOS = [2024, 2025, 2026, 2027];

type ConsultorFilterOption = {
  value: string;
  label: string;
};

type PedidoSortKey = "sla" | "status" | "biometria";
type PedidoSortDirection = "asc" | "desc";

function biometriaSortRank(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return 99;
  if (normalized.includes("pend")) return 0;
  if (normalized.includes("cancel")) return 1;
  if (normalized.includes("conclu") || normalized.includes("ok")) return 2;
  return 50;
}

function compareNullableText(a: string | null | undefined, b: string | null | undefined, direction: PedidoSortDirection) {
  const left = String(a ?? "").trim();
  const right = String(b ?? "").trim();

  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;

  const compared = left.localeCompare(right, "pt-BR", { sensitivity: "base" });
  return direction === "asc" ? compared : -compared;
}

function comparePedidoRows(a: PedidoRow, b: PedidoRow, key: PedidoSortKey, direction: PedidoSortDirection) {
  if (key === "status") {
    return compareNullableText(a.status_unificado_nome, b.status_unificado_nome, direction);
  }

  if (key === "biometria") {
    const aRank = biometriaSortRank(a.status_biometria);
    const bRank = biometriaSortRank(b.status_biometria);

    if (aRank === 99 && bRank !== 99) return 1;
    if (bRank === 99 && aRank !== 99) return -1;

    const compared = aRank - bRank;
    if (compared !== 0) return direction === "asc" ? compared : -compared;

    return compareNullableText(a.status_biometria, b.status_biometria, direction);
  }

  const stateA = getSlaState({
    startedAt: a.sla_unificado_inicio_em,
    slaHours: a.sla_unificado_horas,
  });
  const stateB = getSlaState({
    startedAt: b.sla_unificado_inicio_em,
    slaHours: b.sla_unificado_horas,
  });

  const rank = (state: string) => {
    if (state === "vermelho") return 0;
    if (state === "laranja") return 1;
    if (state === "verde") return 2;
    return 99;
  };

  const aRank = rank(stateA);
  const bRank = rank(stateB);

  // "Sem SLA" fica por último independentemente da direção.
  if (aRank === 99 && bRank !== 99) return 1;
  if (bRank === 99 && aRank !== 99) return -1;

  const compared = aRank - bRank;
  return direction === "asc" ? compared : -compared;
}

function consultorFilterValue(id: string | null | undefined, nome: string | null | undefined) {
  if (id) return `id:${id}`;
  const cleanName = String(nome ?? "").trim();
  return cleanName ? `nome:${cleanName}` : "";
}

function applyConsultorFilter(query: any, value: string) {
  if (!value || value === "todos") return query;
  if (value.startsWith("id:")) return query.eq("consultor_id", value.slice(3));
  if (value.startsWith("nome:")) return query.eq("consultor_nome", value.slice(5));
  return query;
}

function consultorOptionsFromRows(rows: Array<{ consultor_id?: string | null; consultor_nome?: string | null }>) {
  const map = new Map<string, ConsultorFilterOption>();
  for (const row of rows) {
    const label = String(row.consultor_nome ?? "").trim();
    const value = consultorFilterValue(row.consultor_id, label);
    if (!value || !label) continue;
    map.set(value, { value, label: uppercaseDisplay(label) });
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";

  const dateOnly = String(d).match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
  if (dateOnly) {
    return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }

  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}
function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function pedidoDateKey(value: string | null | undefined) {
  if (!value) return null;
  const raw = String(value).trim();
  const direct = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyToLocalDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function localDateToKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function OperadoraBadge({ op }: { op: string }) {
  return (
    <Badge variant="outline" className={cn(
      "text-[9px] uppercase tracking-wider px-1.5 py-0 h-4",
      op === "CLARO" ? "border-[var(--claro)]/40 text-[var(--claro)]" : "border-[var(--vivo)]/40 text-[var(--vivo)]",
    )}>{op}</Badge>
  );
}

function BiometriaBadge({ v }: { v: string | null }) {
  if (!v) return <span className="text-muted-foreground text-[11px]">—</span>;
  const t = v.toLowerCase();
  const cls = t.includes("conclu") || t.includes("ok")
    ? "border-success/40 text-success"
    : t.includes("cancel")
      ? "border-destructive/40 text-destructive"
      : "border-warning/40 text-warning";
  return <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4", cls)}>{v}</Badge>;
}

function SlaPedidoBadge({ startedAt, slaHours }: { startedAt: string | null; slaHours: number | null }) {
  const state = getSlaState({ startedAt, slaHours });
  const cls = state === "verde"
    ? "border-success/40 bg-success/10 text-success"
    : state === "laranja"
      ? "border-warning/40 bg-warning/10 text-warning"
      : state === "vermelho"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-border text-muted-foreground";
  const label = state === "verde" ? "SLA Verde" : state === "laranja" ? "SLA Laranja" : state === "vermelho" ? "SLA Vencido" : "Sem SLA";
  return (
    <Badge variant="outline" className={cn("h-4 rounded-[2px] px-1 text-[8px] font-bold whitespace-nowrap shadow-none", cls)}>
      {label}{slaHours ? ` · ${slaHours}h` : ""}
    </Badge>
  );
}


function Paginacao({
  page,
  total,
  onPage,
  label,
  pageSize = PAGE_SIZE,
  onPageSizeChange,
}: {
  page: number;
  total: number;
  onPage: (p: number) => void;
  label: string;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Mostrando {from}–{to} de {total} {label} · página {page + 1} de {pages}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">Por página</span>
            <Select
              value={String(pageSize)}
              onValueChange={value => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-7 w-[72px] bg-surface-1 px-2 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[30, 50, 100].map(size => (
                  <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)} className="h-7 gap-1 px-2 text-[10px]">
          <ChevronLeft className="size-3.5" /> Anterior
        </Button>
        <span className="px-2 font-mono text-[10px]">{page + 1}/{pages}</span>
        <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)} className="h-7 gap-1 px-2 text-[10px]">
          Próxima <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function normalizarDocumentoEmpresa(value: string | null | undefined) {
  return String(value ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

async function documentoEmpresaEmUso(documento: string, excluirClienteId?: string | null) {
  const { data, error } = await (supabase as any).rpc("cliente_documento_em_uso", {
    p_documento: documento,
    p_excluir_cliente_id: excluirClienteId ?? null,
  });
  if (error) throw error;
  return Boolean(data);
}

function formatCpfCnpjVisible(doc: string | null | undefined) {
  const raw = String(doc ?? "").trim();
  const canonical = raw.replace(/[^A-Za-z0-9]/g, "");
  const onlyDigits = /^\d+$/.test(canonical);

  if (onlyDigits && canonical.length === 11) {
    return canonical.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (onlyDigits && canonical.length === 14) {
    return canonical.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return raw || "—";
}

/* ---------- página ---------- */

export function ClientesPedidosArea({ scope }: { scope: "global" | "meus" }) {
  const [tab, setTab] = useState<"clientes" | "pedidos">("clientes");
  const [clienteId, setClienteId] = useState<string | undefined>(undefined);
  const [clientesRevision, setClientesRevision] = useState(0);
  const { primaryRole, user } = useAuth();
  const { comissoesVisible } = useFeatures();
  const isAdmin = primaryRole === "admin";
  const escopoPedidosPessoais: "global" | "meus" = scope === "meus" && primaryRole === "consultor" ? "meus" : "global";
  const consultorId = escopoPedidosPessoais === "meus" ? user?.id ?? null : null;

  const podeCriarCliente = primaryRole === "admin" || primaryRole === "gestor" || primaryRole === "consultor" || primaryRole === "bko";

  if (scope === "meus") {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <PedidosTab
          scope={escopoPedidosPessoais}
          consultorId={consultorId}
          isAdmin={isAdmin}
          clienteId={undefined}
          onLimparCliente={() => {}}
          comissoesVisible={comissoesVisible}
          meusPedidosGrid
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">
            Clientes / Pedidos
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão operacional unificada CLARO + VIVO
          </p>
        </div>
        {podeCriarCliente && (
          <NovoClienteDialog onCreated={() => setClientesRevision(value => value + 1)} />
        )}
      </div>

      <Tabs value={tab} onValueChange={v => { setTab(v as "clientes" | "pedidos"); }}>
        <TabsList className="bg-surface-1">
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="pedidos">Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="mt-4">
          <ClientesTab
            scope={scope}
            consultorId={consultorId}
            isAdmin={isAdmin}
            revision={clientesRevision}
            onVerPedidos={id => { setClienteId(id); setTab("pedidos"); }}
            comissoesVisible={comissoesVisible}
          />
        </TabsContent>
        <TabsContent value="pedidos" className="mt-4">
          <PedidosTab
            scope={scope}
            consultorId={consultorId}
            isAdmin={isAdmin}
            clienteId={clienteId}
            onLimparCliente={() => setClienteId(undefined)}
            comissoesVisible={comissoesVisible}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function MeusClientesEmpresasPanel() {
  const { comissoesVisible } = useFeatures();
  const [revision, setRevision] = useState(0);
  // O banco já limita o que cada perfil pode ver. Para Consultor, isso inclui
  // empresas próprias e empresas ligadas às vendas dele.
  const scope: "global" | "meus" = "global";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Empresas cadastradas</div>
          <div className="text-[10px] text-muted-foreground">
            Cadastro da empresa independente dos pedidos vinculados.
          </div>
        </div>
        <NovoClienteDialog
          onCreated={() => setRevision(value => value + 1)}
          buttonLabel="Nova empresa"
        />
      </div>

      <div className="min-h-0 flex-1">
        <ClientesTab
          scope={scope}
          consultorId={null}
          isAdmin={false}
          revision={revision}
          comissoesVisible={comissoesVisible}
        />
      </div>
    </div>
  );
}

function baixarCsv(nome: string, headers: string[], linhas: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const t = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const csv = [headers.join(";"), ...linhas.map(l => l.map(esc).join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nome}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- ABA CLIENTES ---------- */

interface ClienteRow {
  id: string; razao_social: string; cnpj_cpf: string | null; uf: string | null; ddd: string | null;
  contato: string | null; telefone: string | null; email: string | null; observacao: string | null;
  operadoras: string[]; qtd_linhas_total: number; receita_total: number;
  ultima_venda_em: string | null; created_at: string | null; updated_at: string | null;
}
interface VendaResumo {
  cliente_id: string | null; consultor_nome: string | null; etapa_id: string; funil: string;
  created_at: string; data_ativacao: string | null; concluido_em: string | null; status_pedido: string | null;
}

function ClientesTab({ scope, consultorId, isAdmin, revision, onVerPedidos, comissoesVisible }: {
  scope: "global" | "meus"; consultorId: string | null; isAdmin: boolean; revision: number; onVerPedidos?: (id: string) => void;
  comissoesVisible: boolean;
}) {
  const { primaryRole } = useAuth();

  const [busca, setBusca] = useState("");
  const q = useDebounced(busca);
  const [operadora, setOperadora] = useState("todos");
  const [consultor, setConsultor] = useState("todos");
  const [consultorOptions, setConsultorOptions] = useState<ConsultorFilterOption[]>([]);
  const [mes, setMes] = useState("todos");
  const [ano, setAno] = useState("todos");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<ClienteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Map<string, { consultor: string; status: string }>>(new Map());
  const [clientGridMaximized, setClientGridMaximized] = useState(false);
  const [empresaVisualizar, setEmpresaVisualizar] = useState<ClienteRow | null>(null);
  const [empresaEditar, setEmpresaEditar] = useState<ClienteRow | null>(null);

  useEffect(() => {
    if (!clientGridMaximized || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setClientGridMaximized(false);
    };
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [clientGridMaximized]);

  useEffect(() => { setPage(0); }, [q, operadora, consultor, mes, ano]);

  const usaVendas = consultor !== "todos" || mes !== "todos" || ano !== "todos";

  const [excluirId, setExcluirId] = useState<string | null>(null);
  const [excluirReason, setExcluirReason] = useState("");
  const [excluirLoading, setExcluirLoading] = useState(false);
  const [excluirVincCount, setExcluirVincCount] = useState<number | null>(null);

  const confirmDelete = async () => {
    if (!excluirId || !excluirReason.trim()) return;
    setExcluirLoading(true);
    try {
      const { deleteCliente } = await import("@/lib/exclusao.functions");
      const res = await deleteCliente({ data: { clienteId: excluirId, reason: excluirReason } });

      if (res.success) {
        toast.success(`Cliente e ${res.vendas_updated} pedido(s) vinculados excluídos definitivamente.`);
        setExcluirId(null);
        setExcluirReason("");
        await load();
      }
    } catch (e: any) {
      console.error("[ERRO EXCLUSÃO]", e);
      toast.error(e.message || "Não foi possível excluir o cliente. Tente novamente.");
    } finally {
      setExcluirLoading(false);
    }
  };

  const openExcluir = async (id: string) => {
    const { count } = await supabase.from("vendas").select("id", { count: 'exact', head: true }).eq("cliente_id", id).is("deleted_at", null);
    setExcluirVincCount(count);
    setExcluirId(id);
  };

  const loadConsultorOptions = useCallback(async () => {
    let query = supabase
      .from("vendas")
      .select("consultor_id, consultor_nome")
      .is("deleted_at", null)
      .is("is_deleted", false)
      .limit(5000);

    if (scope === "meus") {
      query = query.eq("consultor_id", consultorId ?? "00000000-0000-0000-0000-000000000000");
    }

    const { data, error } = await query;
    if (error) {
      console.error("[Clientes] Falha ao carregar consultores dos pedidos", error);
      return;
    }

    const options = consultorOptionsFromRows(data ?? []);
    setConsultorOptions(options);
    setConsultor(current =>
      current === "todos" || options.some(option => option.value === current) ? current : "todos",
    );
  }, [scope, consultorId]);

  useEffect(() => {
    void loadConsultorOptions();
  }, [loadConsultorOptions]);

  const load = useCallback(async () => {
    try {
      setLoading(true);

    let idsFiltro: string[] | null = null;
    if (usaVendas) {
      let vq = supabase.from("vendas").select("cliente_id, concluido_em, status_pedido").is("deleted_at", null).is("is_deleted", false).not("cliente_id", "is", null).limit(5000);
      if (scope === "meus") vq = vq.eq("consultor_id", consultorId ?? "00000000-0000-0000-0000-000000000000");
      vq = applyConsultorFilter(vq, consultor);
      if (mes !== "todos") vq = vq.eq("mes_ref", Number(mes));
      if (ano !== "todos") vq = vq.eq("ano_ref", Number(ano));
      const { data } = await vq;
      idsFiltro = Array.from(new Set((data ?? []).map(v => v.cliente_id as string)));
      if (idsFiltro.length === 0) {
        setRows([]); setTotal(0); setMeta(new Map()); setLoading(false); return;
      }
    }

    let cq = supabase
      .from("clientes")
      .select("id, razao_social, cnpj_cpf, uf, ddd, contato, telefone, email, observacao, operadoras, qtd_linhas_total, receita_total, ultima_venda_em, created_at, updated_at", { count: "exact" })
      // @ts-ignore
      .is("deleted_at", null)
      .is("is_deleted", false)
      .order("razao_social")
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    // O cadastro de empresas é global por CNPJ/CPF. Em "Minhas Empresas",
    // todos os usuários veem a lista de empresas; as vendas continuam filtradas
    // pelas próprias RLS e, para Consultor, somente as vendas dele são retornadas.
    if (idsFiltro) cq = cq.in("id", idsFiltro.slice(0, 1000));
    if (q) cq = cq.or(`razao_social.ilike.%${q}%,cnpj_cpf.ilike.%${q}%,telefone.ilike.%${q}%,contato.ilike.%${q}%`);
    if (operadora !== "todos") cq = cq.contains("operadoras", [operadora]);

    const { data, count, error } = await cq;
    if (error) throw error;
    const list = (data ?? []) as ClienteRow[];
    setRows(list);
    setTotal(count ?? 0);

    if (list.length) {
      const { data: vendas } = await supabase
        .from("vendas")
        .select("cliente_id, consultor_nome, etapa_id, funil, created_at, data_ativacao, concluido_em, status_pedido")
        // @ts-ignore
        .is("deleted_at", null)
        .is("is_deleted", false)
        .in("cliente_id", list.map(c => c.id));
      const m = new Map<string, { consultor: string; status: string }>();
      const latest = new Map<string, string>();
      for (const v of (vendas ?? []) as VendaResumo[]) {
        if (!v.cliente_id) continue;
        const when = v.data_ativacao ?? v.created_at ?? "";
        const prev = latest.get(v.cliente_id) ?? "";
        const cur = m.get(v.cliente_id) ?? { consultor: "—", status: "Sem pedidos" };
        if (when >= prev) {
          latest.set(v.cliente_id, when);
          cur.consultor = v.consultor_nome ?? cur.consultor;
        }
        const encerradoPorResultado = ["cancelado", "reprovado"].includes(v.status_pedido ?? "");
        const ativo = !v.concluido_em && !encerradoPorResultado;
        if (ativo) cur.status = "Ativo";
        else if (v.concluido_em && cur.status !== "Ativo") cur.status = "Concluído";
        else if (cur.status !== "Ativo" && cur.status !== "Concluído") cur.status = "Encerrado";
        m.set(v.cliente_id, cur);
      }
      setMeta(m);
    } else {
      setMeta(new Map());
    }
    } catch (err) {
      console.error("Erro ao carregar clientes:", err);
      toast.error("Erro ao carregar clientes. Tente atualizar a página.");
    } finally {
      setLoading(false);
    }
  }, [q, operadora, consultor, mes, ano, page, usaVendas, scope, consultorId, revision]);

  useEffect(() => { load(); }, [load]);

  async function exportar() {
    toast.info("Gerando CSV…");
    let cq = supabase
      .from("clientes")
      .select("id, razao_social, cnpj_cpf, uf, ddd, contato, telefone, email, observacao, operadoras, qtd_linhas_total, receita_total, ultima_venda_em, created_at, updated_at")
      // @ts-ignore
      .is("deleted_at", null)
      .is("is_deleted", false)
      .order("razao_social")
      .limit(5000);
    if (q) cq = cq.or(`razao_social.ilike.%${q}%,cnpj_cpf.ilike.%${q}%,telefone.ilike.%${q}%,contato.ilike.%${q}%`);
    if (operadora !== "todos") cq = cq.contains("operadoras", [operadora]);
    const { data, error } = await cq;
    if (error) { toast.error("Falha ao exportar", { description: error.message }); return; }
    baixarCsv("clientes",
      ["ID", "Razao social", "CNPJ/CPF", "Operadoras", "Consultor", "Telefone", "UF", "DDD", "Linhas", comissoesVisible ? "Receita" : "", "Ultima venda", "Ultima alteracao", "Status", "Criado em"].filter(Boolean),
      (data ?? []).map(c => [
        c.id, c.razao_social, c.cnpj_cpf, (c.operadoras ?? []).join("/"),
        meta.get(c.id)?.consultor ?? "", c.telefone, c.uf, c.ddd,
        c.qtd_linhas_total, comissoesVisible ? c.receita_total : null, fmtDate(c.ultima_venda_em), fmtDateTime(c.updated_at),
        meta.get(c.id)?.status ?? "", fmtDateTime(c.created_at),
      ].filter(v => v !== null)));
    toast.success("CSV gerado");
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-2 flex flex-wrap items-end gap-1.5">
        <div className="relative flex-1 min-w-[190px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Razão social, CNPJ/CPF, telefone…" className="h-8 pl-8 text-xs bg-surface-1" />
        </div>
        <FilterSelect label="Operadora" value={operadora} onChange={setOperadora} options={[["todos", "Geral OMNI"], ["CLARO", "Claro"], ["VIVO", "Vivo"]]} />
        {scope === "global" && (
          <FilterSelect
            label="Consultor"
            value={consultor}
            onChange={setConsultor}
            options={[["todos", "Todos"], ...consultorOptions.map(option => [option.value, option.label] as [string, string])]}
          />
        )}
        <FilterSelect label="Mês" value={mes} onChange={setMes}
          options={[["todos", "Todos"], ...MESES.map((m, i) => [String(i + 1), m] as [string, string])]} />
        <FilterSelect label="Ano" value={ano} onChange={setAno}
          options={[["todos", "Todos"], ...ANOS.map(a => [String(a), String(a)] as [string, string])]} />
        {isAdmin && scope === "global" && (
          <Button variant="outline" className="h-8 gap-1.5 px-2.5 text-[10px] text-omni border-omni/40" onClick={exportar}>
            <Download className="size-3.5" /> Exportar CSV
          </Button>
        )}
      </div>

      {(() => {
        const clientColumnCount = comissoesVisible ? 13 : 12;
        const grid = (
          <div
            className={cn(
              "rounded-xl border border-border bg-card",
              clientGridMaximized && "fixed inset-0 z-[40] flex h-[100dvh] w-screen flex-col overflow-hidden rounded-none bg-background shadow-2xl",
            )}
          >
            <div className="flex min-h-9 shrink-0 items-center border-b border-border/40 px-2 py-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-[10px]"
                onClick={() => setClientGridMaximized(current => !current)}
                title={clientGridMaximized ? "Fechar visualização ampliada" : "Maximizar tabela"}
              >
                {clientGridMaximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
                {clientGridMaximized ? "Fechar" : "Maximizar"}
              </Button>
            </div>

            <div className={cn("overflow-x-auto", clientGridMaximized && "min-h-0 flex-1 overflow-auto")}>
              <Table className={cn(clientGridMaximized && "min-w-max")}>
                <TableHeader className="bg-surface-2 sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent [&>th]:border-r [&>th]:border-border/20 [&>th:last-child]:border-r-0">
                    <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-[9px] uppercase tracking-[0.05em]">Cliente</TableHead>
                    <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-[9px] uppercase tracking-[0.05em]">CNPJ/CPF</TableHead>
                    <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-center text-[9px] uppercase tracking-[0.05em]">Op.</TableHead>
                    <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-[9px] uppercase tracking-[0.05em]">Consultor</TableHead>
                    <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-[9px] uppercase tracking-[0.05em]">Telefone</TableHead>
                    <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-[9px] uppercase tracking-[0.05em]">UF</TableHead>
                    <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-[9px] uppercase tracking-[0.05em]">DDD</TableHead>
                    <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-right text-[9px] uppercase tracking-[0.05em]">Linhas</TableHead>
                    {comissoesVisible && <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-right text-[9px] uppercase tracking-[0.05em]">Receita</TableHead>}
                    <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-[9px] uppercase tracking-[0.05em]">Última venda</TableHead>
                    <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-[9px] uppercase tracking-[0.05em]">Última alteração</TableHead>
                    <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-center text-[9px] uppercase tracking-[0.05em]">Status</TableHead>
                    <TableHead className="h-7 whitespace-nowrap px-2 py-1 text-right text-[9px] uppercase tracking-[0.05em]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: clientColumnCount }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full opacity-20" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={clientColumnCount} className="text-center py-20 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                          <div className="size-12 rounded-full bg-surface-2 grid place-items-center">
                            <Users className="size-6 opacity-20" />
                          </div>
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">Nenhum cliente encontrado</p>
                            <p className="text-xs">Tente ajustar seus filtros ou busca.</p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!loading && rows.map(c => {
                    const m = meta.get(c.id);
                    return (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer border-b border-border/20 odd:bg-surface-1/45 even:bg-card hover:bg-[var(--omni)]/[0.045] [&>td]:border-r [&>td]:border-border/20 [&>td:last-child]:border-r-0"
                        onClick={() => setEmpresaVisualizar(c)}
                      >
                        <TableCell className="max-w-[190px] truncate px-2 py-1 text-[10px] font-medium" title={uppercaseDisplay(c.razao_social)}>{uppercaseDisplay(c.razao_social)}</TableCell>
                        <TableCell className="whitespace-nowrap px-2 py-1 font-mono text-[9px]">{formatCpfCnpjVisible(c.cnpj_cpf)}</TableCell>
                        <TableCell className="px-2 py-1 text-center">
                          <div className="flex justify-center gap-1">{(c.operadoras ?? []).map(op => <OperadoraBadge key={op} op={op} />)}</div>
                        </TableCell>
                        <TableCell className="max-w-[130px] px-2 py-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="size-2 shrink-0 rounded-full bg-[var(--omni)]" />
                            <span className="truncate text-[9px]" title={uppercaseDisplay(m?.consultor)}>{uppercaseDisplay(m?.consultor)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-2 py-1 text-[9px]">{maskPhone(c.telefone ?? "", primaryRole)}</TableCell>
                        <TableCell className="px-2 py-1 text-[9px]">{c.uf ?? "—"}</TableCell>
                        <TableCell className="px-2 py-1 text-[9px]">{c.ddd ?? "—"}</TableCell>
                        <TableCell className="px-2 py-1 text-right text-[9px] tabular-nums">{c.qtd_linhas_total}</TableCell>
                        {comissoesVisible && <TableCell className="whitespace-nowrap px-2 py-1 text-right text-[9px] font-semibold text-foreground/70">{maskValor(Number(c.receita_total ?? 0), primaryRole)}</TableCell>}
                        <TableCell className="whitespace-nowrap px-2 py-1 text-[9px]">{fmtDate(c.ultima_venda_em)}</TableCell>
                        <TableCell className="whitespace-nowrap px-2 py-1 text-[9px]">{fmtDateTime(c.updated_at)}</TableCell>
                        <TableCell className="px-2 py-1 text-center">
                          <Badge variant="outline" className={cn("h-4 px-1.5 py-0 text-[8px]",
                            m?.status === "Ativo" ? "border-success/40 text-success" :
                            m?.status === "Concluído" ? "border-info/40 text-info" : "border-border text-muted-foreground")}>
                            {uppercaseDisplay(m?.status, "SEM PEDIDOS")}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap px-1 py-1 text-right" onClick={e => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => setEmpresaVisualizar(c)}
                            title="Visualizar dados da empresa"
                            aria-label="Visualizar dados da empresa"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-omni"
                            onClick={() => setEmpresaEditar(c)}
                            title="Editar dados da empresa"
                            aria-label="Editar dados da empresa"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          {onVerPedidos && (
                            <Button
                              variant="ghost" size="sm" className="h-6 px-1.5 text-omni"
                              onClick={() => onVerPedidos(c.id)}
                              title="Ver pedidos do cliente"
                            >
                              <ListFilter className="size-3.5" />
                            </Button>
                          )}
                          {(primaryRole === "admin" || primaryRole === "gestor") && (
                            <Button
                              variant="ghost" size="sm" className="h-6 px-1.5 text-destructive"
                              onClick={() => openExcluir(c.id)}
                              title="Excluir empresa"
                              aria-label="Excluir empresa"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className={cn("px-3 pb-3", clientGridMaximized && "shrink-0 bg-background pt-1")}>
              <Paginacao page={page} total={total} onPage={setPage} label="clientes" />
            </div>
          </div>
        );

        return clientGridMaximized && typeof document !== "undefined"
          ? createPortal(grid, document.body)
          : grid;
      })()}

        <EmpresaVisualizarDialog
          empresa={empresaVisualizar}
          open={Boolean(empresaVisualizar)}
          onOpenChange={open => !open && setEmpresaVisualizar(null)}
          comissoesVisible={comissoesVisible}
        />

        <EmpresaEditarDialog
          empresa={empresaEditar}
          open={Boolean(empresaEditar)}
          onOpenChange={open => !open && setEmpresaEditar(null)}
          onSaved={async () => {
            setEmpresaEditar(null);
            await load();
          }}
        />

        <AlertDialog open={!!excluirId} onOpenChange={(o) => !o && setExcluirId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir cliente e pedidos vinculados?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este cliente?
                {excluirVincCount !== null && excluirVincCount > 0 && (
                  <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-[11px] font-semibold">
                    Aviso: Este cliente possui {excluirVincCount} pedido(s) vinculado(s). Ao excluir o cliente, todos os pedidos relacionados a ele também serão excluídos definitivamente do sistema.
                  </div>
                )}
                A exclusão é definitiva. Apenas um registro separado de auditoria da exclusão é preservado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-2">
              <Label>Motivo da exclusão (obrigatório)</Label>
              <Textarea
                value={excluirReason}
                onChange={e => setExcluirReason(e.target.value)}
                placeholder="Ex: Cliente duplicado, desistência..."
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <Button
                variant="destructive"
                disabled={!excluirReason.trim() || excluirLoading}
                onClick={confirmDelete}
              >
                {excluirLoading ? "Excluindo..." : "Confirmar exclusão"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  );
}


type EmpresaEditForm = {
  razao_social: string;
  cnpj_cpf: string;
  uf: string;
  ddd: string;
  contato: string;
  telefone: string;
  email: string;
  observacao: string;
};

function empresaEditForm(empresa: ClienteRow | null): EmpresaEditForm {
  return {
    razao_social: empresa?.razao_social ?? "",
    cnpj_cpf: empresa?.cnpj_cpf ?? "",
    uf: empresa?.uf ?? "",
    ddd: empresa?.ddd ?? "",
    contato: empresa?.contato ?? "",
    telefone: empresa?.telefone ?? "",
    email: empresa?.email ?? "",
    observacao: empresa?.observacao ?? "",
  };
}

function EmpresaVisualizarDialog({
  empresa,
  open,
  onOpenChange,
  comissoesVisible,
}: {
  empresa: ClienteRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comissoesVisible: boolean;
}) {
  if (!empresa) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88dvh] w-[min(94vw,980px)] max-w-[980px] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-omni" />
            Dados da empresa
          </DialogTitle>
          <DialogDescription>
            Cadastro da empresa. Os pedidos vinculados são registros separados.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <section className="rounded-xl border border-border bg-surface-1/25 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="break-words text-lg font-display font-bold">
                  {uppercaseDisplay(empresa.razao_social)}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {formatCpfCnpjVisible(empresa.cnpj_cpf)}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(empresa.operadoras ?? []).map(op => <OperadoraBadge key={op} op={op} />)}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <EmpresaInfo label="UF" value={empresa.uf} />
              <EmpresaInfo label="DDD" value={empresa.ddd} />
              <EmpresaInfo label="Linhas" value={String(empresa.qtd_linhas_total ?? 0)} />
              {comissoesVisible && (
                <EmpresaInfo
                  label="Receita"
                  value={Number(empresa.receita_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                />
              )}
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="size-4 text-info" />
                <h3 className="text-sm font-semibold">Contato principal</h3>
              </div>
              <div className="space-y-2">
                <EmpresaInfo label="Nome" value={empresa.contato} />
                <EmpresaInfo label="Telefone" value={empresa.telefone ? `(${empresa.ddd || "—"}) ${empresa.telefone}` : "—"} icon={<Phone className="size-3" />} />
                <EmpresaInfo label="E-mail" value={empresa.email} icon={<Mail className="size-3" />} />
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 text-sm font-semibold">Cadastro</div>
              <div className="space-y-2">
                <EmpresaInfo label="Última venda" value={fmtDate(empresa.ultima_venda_em)} />
                <EmpresaInfo label="Criada em" value={fmtDateTime(empresa.created_at)} />
                <EmpresaInfo label="Última alteração" value={fmtDateTime(empresa.updated_at)} />
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 text-sm font-semibold">Observação da empresa</div>
            <div className="whitespace-pre-wrap break-words text-xs text-foreground/85">
              {empresa.observacao?.trim() || "—"}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <ClienteRepresentantes
              clienteId={empresa.id}
              canManage={false}
              compact
            />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmpresaInfo({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-background/30 px-3 py-2">
      <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="mt-1 flex min-w-0 items-center gap-1.5 break-words text-xs font-medium">
        {icon}
        <span className="min-w-0 break-words">{value && String(value).trim() ? value : "—"}</span>
      </div>
    </div>
  );
}

function EmpresaEditarDialog({
  empresa,
  open,
  onOpenChange,
  onSaved,
}: {
  empresa: ClienteRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState<EmpresaEditForm>(() => empresaEditForm(empresa));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(empresaEditForm(empresa));
  }, [open, empresa]);

  if (!empresa) return null;

  async function salvar() {
    if (!empresa) return;
    const razao = form.razao_social.trim();
    const documento = form.cnpj_cpf.trim();
    const contato = form.contato.trim();
    const dddDigits = form.ddd.replace(/\D/g, "");
    const telefoneDigits = form.telefone.replace(/\D/g, "");
    const email = form.email.trim();

    if (razao.length < 2) { toast.error("Informe a razão social."); return; }
    if (!documento) { toast.error("Informe o CNPJ/CPF."); return; }
    if (!form.uf) { toast.error("Selecione a UF."); return; }
    if (contato.length < 2) { toast.error("Informe o nome do contato principal."); return; }
    if (dddDigits.length !== 2) { toast.error("Informe o DDD com 2 dígitos."); return; }
    if (telefoneDigits.length !== 8 && telefoneDigits.length !== 9) { toast.error("Telefone deve ter 8 ou 9 dígitos."); return; }
    if (!email || !EMAIL_REGEX.test(email)) { toast.error("Informe um e-mail válido."); return; }

    setSaving(true);
    try {
      if (normalizarDocumentoEmpresa(documento) !== normalizarDocumentoEmpresa(empresa.cnpj_cpf)) {
        const emUso = await documentoEmpresaEmUso(documento, empresa.id);
        if (emUso) {
          toast.info("Empresa já cadastrada.", {
          description: "Este CNPJ/CPF já existe. Use o cadastro existente em vez de criar uma duplicata.",
        });
          return;
        }
      }

      const patch: Record<string, unknown> = {
        razao_social: razao,
        uf: form.uf,
        ddd: dddDigits,
        contato,
        telefone: telefoneDigits,
        email,
        observacao: form.observacao.trim() || null,
      };
      if (normalizarDocumentoEmpresa(documento) !== normalizarDocumentoEmpresa(empresa.cnpj_cpf)) {
        patch.cnpj_cpf = documento;
      }

      const { error } = await (supabase as any)
        .from("clientes")
        .update(patch)
        .eq("id", empresa.id);

      if (error) throw error;

      toast.success("Empresa atualizada.");
      await onSaved();
    } catch (error: any) {
      toast.error("Não foi possível atualizar a empresa.", {
        description: error?.message ?? "Erro inesperado",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => !saving && onOpenChange(value)}>
      <DialogContent className="flex h-[90dvh] w-[min(94vw,1000px)] max-w-[1000px] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-4 text-omni" />
            Editar empresa
          </DialogTitle>
          <DialogDescription>
            Edite o cadastro da empresa e os representantes no mesmo lugar.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 rounded-xl border border-border bg-surface-1/25 p-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Razão social *</Label>
              <Input
                value={form.razao_social}
                onChange={event => setForm(current => ({ ...current, razao_social: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ / CPF *</Label>
              <Input
                value={form.cnpj_cpf}
                onChange={event => setForm(current => ({ ...current, cnpj_cpf: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>UF *</Label>
              <Select value={form.uf} onValueChange={value => setForm(current => ({ ...current, uf: value }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {UFS_BRASIL.map(sigla => <SelectItem key={sigla} value={sigla}>{sigla}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="text-xs font-semibold">Contato principal</div>
              <div className="text-[10px] text-muted-foreground">
                Estes dados também atualizam o representante principal da empresa.
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Nome *</Label>
              <Input
                value={form.contato}
                onChange={event => setForm(current => ({ ...current, contato: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>DDD *</Label>
              <Input
                value={form.ddd}
                onChange={event => setForm(current => ({ ...current, ddd: maskDddInput(event.target.value) }))}
                maxLength={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input
                value={form.telefone}
                onChange={event => setForm(current => ({ ...current, telefone: maskTelefoneInput(event.target.value) }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Observação da empresa</Label>
              <Textarea
                rows={3}
                value={form.observacao}
                onChange={event => setForm(current => ({ ...current, observacao: event.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <ClienteRepresentantes
              clienteId={empresa.id}
              canManage
              compact
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={() => void salvar()}
            disabled={saving}
            className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)]"
          >
            {saving ? "Salvando…" : "Salvar empresa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- ABA PEDIDOS ---------- */

interface PedidoRow {
  id: string; numero: string; cliente_razao_social: string; cliente_cnpj: string | null; cliente_id: string | null;
  operadora: string; tipo_pedido: string | null; tipo_pedidos?: string[] | null; produto: string | null; produtos?: string[] | null; consultor_id: string | null; consultor_nome: string | null;
  bko_nome: string | null; valor: number; quantidade_linhas: number; mes_ref: number; ano_ref: number;
  funil: string; etapa_id: string; status: string | null; status_pedido: string | null; status_pedido_em: string | null; status_pedido_user_nome?: string | null;
  status_biometria: string | null; tem_erro: boolean | null;
  data_recebimento: string | null; data_preenchimento: string | null; data_envio: string | null;
  data_aceite: string | null; data_input: string | null; data_ativacao: string | null; data_portabilidade: string | null; data_entrega: string | null; concluido_em: string | null; created_at: string | null; updated_at: string | null;
  status_comercial_nome: string | null; status_comercial_em: string | null; sla_horas_atual: number | null; sla_metade_em: string | null; sla_limite_em: string | null;
  status_unificado_nome?: string | null;
  status_unificado_em?: string | null;
  status_unificado_origem?: "manual" | "robo" | null;
  status_unificado_label?: string | null;
  sla_unificado_horas?: number | null;
  sla_unificado_inicio_em?: string | null;
  grupo_tipo_pedido?: string | null;
  grupo_produto?: string | null;
  grupo_quantidade?: number;
  grupo_valor?: number;
  grupo_key?: string;
}

const PEDIDO_DATE_FIELDS: Array<[PedidoDateColumn, keyof PedidoRow]> = [
  ["Ult. Alteração", "status_unificado_em"],
  ["Recebimento", "data_recebimento"],
  ["Preenchimento", "data_preenchimento"],
  ["Envio", "data_envio"],
  ["Aceite", "data_aceite"],
  ["Ativação", "data_ativacao"],
  ["Portabilidade", "data_portabilidade"],
];

type VendaLinhaResumo = {
  venda_id: string;
  tipo_produto: string | null;
  produto: string | null;
  valor_mensal: number | string | null;
  status: string | null;
};

function normalizarChaveGrupo(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

async function carregarLinhasDosPedidos(vendaIds: string[]): Promise<VendaLinhaResumo[]> {
  const ids = Array.from(new Set(vendaIds.filter(Boolean)));
  if (ids.length === 0) return [];

  const result: VendaLinhaResumo[] = [];
  const chunkSize = 180;

  for (let start = 0; start < ids.length; start += chunkSize) {
    const chunk = ids.slice(start, start + chunkSize);
    const { data, error } = await (supabase as any)
      .from("venda_linhas")
      .select("venda_id,tipo_produto,produto,valor_mensal,status")
      .in("venda_id", chunk);

    if (error) throw error;
    result.push(...((data ?? []) as VendaLinhaResumo[]));
  }

  return result;
}

function agruparPedidosPorTipoProduto(pedidos: PedidoRow[], linhas: VendaLinhaResumo[]): PedidoRow[] {
  const linhasPorVenda = new Map<string, VendaLinhaResumo[]>();

  for (const linha of linhas) {
    if (["CANCELADA", "CANCELADO"].includes(normalizarChaveGrupo(linha.status))) continue;
    const atuais = linhasPorVenda.get(linha.venda_id) ?? [];
    atuais.push(linha);
    linhasPorVenda.set(linha.venda_id, atuais);
  }

  const resultado: PedidoRow[] = [];

  for (const pedido of pedidos) {
    const linhasPedido = linhasPorVenda.get(pedido.id) ?? [];

    if (linhasPedido.length === 0) {
      resultado.push({
        ...pedido,
        grupo_tipo_pedido: pedido.tipo_pedido ?? pedido.tipo_pedidos?.[0] ?? "Não informado",
        grupo_produto: pedido.produto ?? pedido.produtos?.[0] ?? "Não informado",
        grupo_quantidade: Math.max(1, Number(pedido.quantidade_linhas ?? 0)),
        grupo_valor: Number(pedido.valor ?? 0),
        grupo_key: "fallback",
      });
      continue;
    }

    const grupos = new Map<string, {
      tipo: string;
      produto: string;
      quantidade: number;
      valor: number;
    }>();

    for (const linha of linhasPedido) {
      const tipo = linha.tipo_produto?.trim()
        || pedido.tipo_pedido?.trim()
        || pedido.tipo_pedidos?.[0]?.trim()
        || "Não informado";
      const produto = linha.produto?.trim()
        || pedido.produto?.trim()
        || pedido.produtos?.[0]?.trim()
        || "Não informado";
      const key = `${normalizarChaveGrupo(tipo)}::${normalizarChaveGrupo(produto)}`;
      const atual = grupos.get(key) ?? { tipo, produto, quantidade: 0, valor: 0 };
      atual.quantidade += 1;
      atual.valor += Number(linha.valor_mensal ?? 0);
      grupos.set(key, atual);
    }

    for (const [grupoKey, grupo] of grupos) {
      resultado.push({
        ...pedido,
        grupo_tipo_pedido: grupo.tipo,
        grupo_produto: grupo.produto,
        grupo_quantidade: grupo.quantidade,
        grupo_valor: grupo.valor,
        grupo_key: grupoKey,
      });
    }
  }

  return resultado;
}

function pedidoRowKey(pedido: PedidoRow) {
  return `${pedido.id}::${pedido.grupo_key ?? "pedido"}`;
}

function dataReferenciaFiltroMes(pedido: PedidoRow) {
  const status = nomeBaseStatus(
    pedido.status_unificado_nome
      ?? pedido.status_comercial_nome
      ?? pedido.status_pedido,
  );

  if (status === "AGUARDANDO ENTREGA") {
    return pedido.data_preenchimento;
  }

  return pedido.data_ativacao;
}

function correspondeMesAnoPedido(pedido: PedidoRow, mes: string, ano: string) {
  if (mes === "todos" && ano === "todos") return true;

  const referencia = dataReferenciaFiltroMes(pedido);
  if (!referencia) return false;

  const match = String(referencia).match(/^(\d{4})-(\d{2})/);
  if (!match) return false;

  const [, anoData, mesData] = match;
  if (ano !== "todos" && Number(anoData) !== Number(ano)) return false;
  if (mes !== "todos" && Number(mesData) !== Number(mes)) return false;
  return true;
}

type StatusSlaCatalogo = {
  operadora: string;
  nome: string;
  sla_horas: number | null;
};

function normalizarNomeStatus(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function nomeBaseStatus(value: string | null | undefined) {
  return normalizarNomeStatus(value)
    .replace(/^(MV|FB|AVA)\s*-\s*/, "")
    .trim();
}

function buscarSlaStatus(
  statusNome: string | null | undefined,
  operadora: string | null | undefined,
  catalogo: StatusSlaCatalogo[],
) {
  if (!statusNome || !operadora) return null;

  const configs = catalogo.filter(item => item.operadora === operadora);
  const normalized = normalizarNomeStatus(statusNome);

  const exact = configs.find(item => normalizarNomeStatus(item.nome) === normalized);
  if (exact) return exact.sla_horas ?? null;

  const base = nomeBaseStatus(statusNome);
  const baseMatches = configs.filter(item => nomeBaseStatus(item.nome) === base);
  if (baseMatches.length === 0) return null;

  const slasValidos = Array.from(new Set(
    baseMatches
      .map(item => item.sla_horas)
      .filter((value): value is number => typeof value === "number" && value > 0),
  ));

  // Quando todos os equivalentes com SLA configurado apontam para o mesmo prazo,
  // podemos fazer o vínculo com segurança mesmo que o robô omita MV/FB/AVA.
  if (slasValidos.length === 1) return slasValidos[0];

  return null;
}

async function enriquecerStatusUnificado(pedidos: PedidoRow[]): Promise<PedidoRow[]> {
  if (pedidos.length === 0) return pedidos;

  const vendaIds = Array.from(new Set(
    pedidos.map(pedido => pedido.id).filter(Boolean),
  ));
  const numeros = Array.from(new Set(
    pedidos.map(pedido => pedido.numero).filter((numero): numero is string => Boolean(numero)),
  ));

  const operadoras = Array.from(new Set(
    pedidos.map(pedido => pedido.operadora).filter(Boolean),
  ));

  let catalogoSla: StatusSlaCatalogo[] = [];
  if (operadoras.length > 0) {
    const { data: statusConfig, error: statusConfigError } = await (supabase as any)
      .from("status_comercial_operadoras")
      .select("operadora, nome, sla_horas")
      .in("operadora", operadoras)
      .eq("ativo", true);

    if (statusConfigError) {
      console.error("[Clientes/Pedidos] Falha ao carregar catálogo de SLA", statusConfigError);
    } else {
      catalogoSla = (statusConfig ?? []) as StatusSlaCatalogo[];
    }
  }

  type RobotStatusResumo = {
    venda_id: string | null;
    venda_numero: string | null;
    created_at: string | null;
    campo_label: string | null;
    valor_novo: string | null;
  };

  const latestRobotByVendaId = new Map<string, RobotStatusResumo>();
  const latestRobotByNumero = new Map<string, RobotStatusResumo>();

  const carregarRobotLogs = async (
    campo: "venda_id" | "venda_numero",
    valores: string[],
  ): Promise<RobotStatusResumo[]> => {
    if (valores.length === 0) return [];

    const { data, error } = await (supabase as any)
      .from("venda_robo_logs")
      .select("venda_id, venda_numero, created_at, campo_label, valor_novo")
      .in(campo, valores)
      .in("campo", ["status_pedido", "status_comercial_nome"])
      .not("valor_novo", "is", null)
      .order("created_at", { ascending: false })
      .limit(Math.max(200, valores.length * 12));

    if (error) {
      console.error("[Clientes/Pedidos] Falha ao carregar status do robô", error);
      return [];
    }

    return (data ?? []) as RobotStatusResumo[];
  };

  const [robotPorId, robotPorNumero] = await Promise.all([
    carregarRobotLogs("venda_id", vendaIds),
    carregarRobotLogs("venda_numero", numeros),
  ]);

  const robotLogs = [...robotPorId, ...robotPorNumero]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

  for (const item of robotLogs) {
    const vendaId = String(item.venda_id ?? "");
    const numero = String(item.venda_numero ?? "");
    if (vendaId && !latestRobotByVendaId.has(vendaId)) latestRobotByVendaId.set(vendaId, item);
    if (numero && !latestRobotByNumero.has(numero)) latestRobotByNumero.set(numero, item);
  }

  return pedidos.map(pedido => {
    const manualNome = pedido.status_comercial_nome?.trim() || null;
    const manualEm = pedido.status_comercial_em || null;
    const robotLog = latestRobotByVendaId.get(pedido.id) ?? latestRobotByNumero.get(pedido.numero) ?? null;
    const roboNome = robotLog?.valor_novo?.trim() || null;
    const roboEm = robotLog?.created_at || null;
    const pedidoNome = pedido.status_pedido?.trim() || null;
    const pedidoEm = pedido.status_pedido_em || null;

    const statusAtual = pedidoStatusMaisRecente(
      manualNome ? {
        nome: manualNome,
        createdAt: manualEm,
        origem: "manual",
        label: "Status Comercial",
        slaHoras: buscarSlaStatus(manualNome, pedido.operadora, catalogoSla) ?? pedido.sla_horas_atual,
        slaInicioEm: manualEm,
      } : null,
      roboNome ? {
        nome: roboNome,
        createdAt: roboEm,
        origem: "robo",
        label: robotLog?.campo_label || "Status do pedido",
        slaHoras: buscarSlaStatus(roboNome, pedido.operadora, catalogoSla),
        slaInicioEm: roboEm,
      } : null,
      pedidoNome ? {
        nome: pedidoNome,
        createdAt: pedidoEm,
        origem: pedido.status_pedido_user_nome ? "manual" : "robo",
        label: "Status do pedido",
        slaHoras: buscarSlaStatus(pedidoNome, pedido.operadora, catalogoSla),
        slaInicioEm: pedidoEm,
      } : null,
    );

    const slaHorasPersistido = Number(pedido.sla_horas_atual ?? 0) > 0
      ? Number(pedido.sla_horas_atual)
      : null;
    const slaLimitePersistido = pedido.sla_limite_em
      ? new Date(pedido.sla_limite_em).getTime()
      : Number.NaN;
    const slaInicioPersistido = slaHorasPersistido && Number.isFinite(slaLimitePersistido)
      ? new Date(slaLimitePersistido - slaHorasPersistido * 60 * 60 * 1000).toISOString()
      : null;

    return {
      ...pedido,
      status_unificado_nome: statusAtual?.nome ?? null,
      status_unificado_em: statusAtual?.createdAt ?? null,
      status_unificado_origem: statusAtual?.origem ?? null,
      status_unificado_label: statusAtual?.label ?? null,
      // O banco mantém o SLA canônico da última mudança de status configurada,
      // seja ela feita por robô, BKO, gestor/admin ou pelo campo legado Status.
      sla_unificado_horas: slaHorasPersistido,
      sla_unificado_inicio_em: slaInicioPersistido,
    };
  });
}

function PedidosTab({ scope, consultorId, isAdmin, clienteId, onLimparCliente, comissoesVisible, meusPedidosGrid = false }: {
  scope: "global" | "meus"; consultorId: string | null; isAdmin: boolean;
  clienteId?: string; onLimparCliente: () => void;
  comissoesVisible: boolean;
  meusPedidosGrid?: boolean;
}) {
  const { primaryRole } = useAuth();
  const navigate = useNavigate();
  const { data: colaboradores } = useColaboradoresDB();
  const { data: tipos } = useCatalogo("tipos_pedido_catalogo");
  const initialColumnFilters = useMemo(
    () => meusPedidosGrid ? readMeusPedidosColumnFilters() : {},
    [meusPedidosGrid],
  );

  const [busca, setBusca] = useState("");
  const q = useDebounced(busca);
  const [operadora, setOperadora] = useState(initialColumnFilters.operadora ?? "todos");
  const [consultor, setConsultor] = useState("todos");
  const [consultorOptions, setConsultorOptions] = useState<ConsultorFilterOption[]>([]);
  const [consultoresColunaOpcoes, setConsultoresColunaOpcoes] = useState<ConsultorFilterOption[]>([]);
  const [consultoresColunaOcultos, setConsultoresColunaOcultos] = useState<string[]>(
    initialColumnFilters.consultoresColunaOcultos ?? [],
  );
  const [pedidosSelecionados, setPedidosSelecionados] = useState<Set<string>>(new Set());
  const [bko, setBko] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>(
    initialColumnFilters.statusSelecionados ?? [],
  );
  const [statusSelecaoManual, setStatusSelecaoManual] = useState(
    initialColumnFilters.statusSelecaoManual
      ?? ((initialColumnFilters.statusSelecionados?.length ?? 0) > 0),
  );
  const [statusOpcoes, setStatusOpcoes] = useState<string[]>([]);
  const statusSelecionadosExibidos = useMemo(
    () => statusFiltroSelecionadosDisponiveis(statusOpcoes, statusSelecionados, statusSelecaoManual),
    [statusOpcoes, statusSelecionados, statusSelecaoManual],
  );
  const [biometria, setBiometria] = useState("todos");
  const [erro, setErro] = useState("todos");
  const [slaFiltro, setSlaFiltro] = useState(initialColumnFilters.slaFiltro ?? "todos");
  const [slaColunaOpcoes, setSlaColunaOpcoes] = useState<FilterOption[]>([]);
  const [tipoPedidoColunaOcultos, setTipoPedidoColunaOcultos] = useState<string[]>(
    initialColumnFilters.tipoPedidoColunaOcultos ?? [],
  );
  const [tipoProdutoColunaOcultos, setTipoProdutoColunaOcultos] = useState<string[]>(
    initialColumnFilters.tipoProdutoColunaOcultos ?? [],
  );
  const [tipoPedidoColunaOpcoes, setTipoPedidoColunaOpcoes] = useState<FilterOption[]>([]);
  const [tipoProdutoColunaOpcoes, setTipoProdutoColunaOpcoes] = useState<FilterOption[]>([]);
  const [datasColuna, setDatasColuna] = useState<Record<PedidoDateColumn, PedidoDateFilter>>({
    ...DEFAULT_PEDIDO_DATE_FILTERS,
    ...(initialColumnFilters.datasColuna ?? {}),
  });
  const [datasColunaOpcoes, setDatasColunaOpcoes] = useState<Record<PedidoDateColumn, string[]>>({
    "Ult. Alteração": [],
    "Recebimento": [],
    "Preenchimento": [],
    "Envio": [],
    "Aceite": [],
    "Ativação": [],
    "Portabilidade": [],
  });
  const canFilterSla = primaryRole === "admin" || primaryRole === "bko";
  const [sortKey, setSortKey] = useState<PedidoSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<PedidoSortDirection>("asc");
  const [mes, setMes] = useState("todos");
  const [ano, setAno] = useState("todos");
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [rows, setRows] = useState<PedidoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [valorTotalAgrupado, setValorTotalAgrupado] = useState(0);
  const [quantidadeTotalAgrupada, setQuantidadeTotalAgrupada] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pedidoExcluir, setPedidoExcluir] = useState<PedidoRow | null>(null);
  const [pedidoExcluirReason, setPedidoExcluirReason] = useState("");
  const [pedidoExcluirLoading, setPedidoExcluirLoading] = useState(false);
  const [gridMaximized, setGridMaximized] = useState(false);
  const [gridDragScrolling, setGridDragScrolling] = useState(false);
  const gridDragRef = useRef({
    active: false,
    dragging: false,
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
  });
  const loadRequestRef = useRef(0);
  const podeExcluirPedido = scope === "global" && (primaryRole === "admin" || primaryRole === "bko");

  useEffect(() => {
    if (!gridMaximized || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGridMaximized(false);
    };
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [gridMaximized]);

  useEffect(() => { setPage(0); }, [q, operadora, consultor, bko, tipo, statusSelecionados, statusSelecaoManual, biometria, erro, slaFiltro, sortKey, sortDirection, mes, ano, clienteId, pageSize, consultoresColunaOcultos, tipoPedidoColunaOcultos, tipoProdutoColunaOcultos, datasColuna]);

  useEffect(() => {
    if (!meusPedidosGrid) return;
    setPedidosSelecionados(new Set());
  }, [meusPedidosGrid, q, operadora, consultor, bko, tipo, statusSelecionados, statusSelecaoManual, biometria, erro, slaFiltro, sortKey, sortDirection, mes, ano, page, pageSize, consultoresColunaOcultos, tipoPedidoColunaOcultos, tipoProdutoColunaOcultos, datasColuna]);

  useEffect(() => {
    if (!meusPedidosGrid) return;
    writeMeusPedidosColumnFilters({
      operadora,
      statusSelecionados,
      statusSelecaoManual,
      consultoresColunaOcultos,
      slaFiltro,
      tipoPedidoColunaOcultos,
      tipoProdutoColunaOcultos,
      datasColuna,
    });
  }, [meusPedidosGrid, operadora, statusSelecionados, statusSelecaoManual, consultoresColunaOcultos, slaFiltro, tipoPedidoColunaOcultos, tipoProdutoColunaOcultos, datasColuna]);

  function togglePedidoSort(key: PedidoSortKey) {
    if (sortKey === key) {
      setSortDirection(current => current === "asc" ? "desc" : "asc");
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  const temFiltrosColunaAtivos = meusPedidosGrid && (
    operadora !== "todos"
    || statusSelecaoManual
    || consultoresColunaOcultos.length > 0
    || slaFiltro !== "todos"
    || tipoPedidoColunaOcultos.length > 0
    || tipoProdutoColunaOcultos.length > 0
    || Object.values(datasColuna).some(value => value.mode !== "todos" || value.dates.length > 0)
  );

  function limparFiltrosColunas() {
    setOperadora("todos");
    setStatusSelecionados([]);
    setStatusSelecaoManual(false);
    setConsultoresColunaOcultos([]);
    setSlaFiltro("todos");
    setTipoPedidoColunaOcultos([]);
    setTipoProdutoColunaOcultos([]);
    setDatasColuna({ ...DEFAULT_PEDIDO_DATE_FILTERS });
    setPedidosSelecionados(new Set());
    setPage(0);
  }

  const aplicarFiltrosColunasMeusPedidos = useCallback((
    source: PedidoRow[],
    ignorar?: PedidoColumnFacet,
  ) => {
    let result = source;

    if (ignorar !== "tipo_pedido" && tipoPedidoColunaOcultos.length > 0) {
      const ocultos = new Set(tipoPedidoColunaOcultos.map(normalizedDisplayKey));
      result = result.filter(item =>
        !ocultos.has(normalizedDisplayKey(item.grupo_tipo_pedido)),
      );
    }

    if (ignorar !== "tipo_produto" && tipoProdutoColunaOcultos.length > 0) {
      const ocultos = new Set(tipoProdutoColunaOcultos.map(normalizedDisplayKey));
      result = result.filter(item =>
        !ocultos.has(normalizedDisplayKey(item.grupo_produto)),
      );
    }

    if (ignorar !== "consultor" && consultoresColunaOcultos.length > 0) {
      const ocultos = new Set(consultoresColunaOcultos);
      result = result.filter(item =>
        !ocultos.has(consultorFilterValue(item.consultor_id, item.consultor_nome)),
      );
    }

    for (const [column, field] of PEDIDO_DATE_FIELDS) {
      if (ignorar === column) continue;

      const filtro = datasColuna[column];
      if (filtro.mode === "todos") continue;

      if (filtro.mode === "com_data") {
        result = result.filter(item =>
          Boolean(pedidoDateKey(item[field] == null ? null : String(item[field]))),
        );
        continue;
      }

      if (filtro.mode === "sem_data") {
        result = result.filter(item =>
          !pedidoDateKey(item[field] == null ? null : String(item[field])),
        );
        continue;
      }

      if (filtro.mode === "datas" && filtro.dates.length > 0) {
        const selecionadas = new Set(filtro.dates);
        result = result.filter(item => {
          const key = pedidoDateKey(item[field] == null ? null : String(item[field]));
          return Boolean(key && selecionadas.has(key));
        });
      }
    }

    return result;
  }, [tipoPedidoColunaOcultos, tipoProdutoColunaOcultos, consultoresColunaOcultos, datasColuna]);

  function alterarStatusSelecionados(values: string[]) {
    setStatusSelecaoManual(true);
    setStatusSelecionados(uniqueNormalizedStrings(values));
    setPage(0);
  }

  function restaurarStatusAutomatico() {
    setStatusSelecaoManual(false);
    setStatusSelecionados([]);
    setPage(0);
  }

  const loadDynamicFilterOptions = useCallback(async () => {
    let query = supabase
      .from("vendas")
      .select("id, numero, operadora, consultor_id, consultor_nome, status_pedido, status_pedido_em, status_pedido_user_nome, status_comercial_nome, status_comercial_em, sla_horas_atual, sla_limite_em, created_at, updated_at, concluido_em, data_recebimento, data_preenchimento, data_envio, data_aceite, data_input, data_ativacao, data_portabilidade, data_entrega")
      .is("deleted_at", null)
      .is("is_deleted", false)
      .limit(5000);

    if (scope === "meus") {
      query = query.eq("consultor_id", consultorId ?? "00000000-0000-0000-0000-000000000000");
    }

    const { data, error } = await query;
    if (error) {
      console.error("[Pedidos] Falha ao carregar opções dinâmicas", error);
      return;
    }

    const baseRows = (data ?? []) as unknown as PedidoRow[];
    const enriched = await enriquecerStatusUnificado(baseRows);

    const statuses = uniqueNormalizedStrings(
      enriched.map(item => item.status_unificado_nome),
    );

    const dateFields: Array<keyof PedidoRow> = [
      "created_at",
      "updated_at",
      "concluido_em",
      "status_pedido_em",
      "status_comercial_em",
      "data_recebimento",
      "data_preenchimento",
      "data_envio",
      "data_aceite",
      "data_input",
      "data_ativacao",
      "data_portabilidade",
      "data_entrega",
    ];
    const years = Array.from(new Set(
      baseRows.flatMap(item =>
        dateFields.flatMap(field => {
          const value = item[field];
          const match = String(value ?? "").match(/^(\d{4})-/);
          return match ? [Number(match[1])] : [];
        }),
      ),
    ))
      .filter(year => Number.isFinite(year))
      .sort((a, b) => b - a);

    setAnosDisponiveis(years);
    setAno(current =>
      current === "todos" || years.includes(Number(current)) ? current : "todos",
    );

    const consultantOptions = consultorOptionsFromRows((data ?? []) as any);

    if (!meusPedidosGrid) {
      setStatusOpcoes(statuses);
      setStatusSelecionados(current => {
        const next = current
          .map(status => statuses.find(option => normalizedDisplayKey(option) === normalizedDisplayKey(status)))
          .filter((status): status is string => Boolean(status));
        return uniqueNormalizedStrings(next);
      });
    }
    setConsultorOptions(consultantOptions);
    setConsultor(current =>
      current === "todos" || consultantOptions.some(option => option.value === current) ? current : "todos",
    );
  }, [scope, consultorId]);

  useEffect(() => {
    void loadDynamicFilterOptions();
  }, [loadDynamicFilterOptions]);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;

    try {
      setLoading(true);
    let vq = supabase
      .from("vendas")
      .select("id, numero, cliente_razao_social, cliente_cnpj, cliente_id, operadora, tipo_pedido, tipo_pedidos, produto, produtos, consultor_id, consultor_nome, bko_nome, valor, quantidade_linhas, mes_ref, ano_ref, funil, etapa_id, status, status_pedido, status_pedido_em, status_pedido_user_nome, status_biometria, tem_erro, data_recebimento, data_preenchimento, data_envio, data_aceite, data_input, data_ativacao, data_portabilidade, data_entrega, concluido_em, created_at, updated_at, status_comercial_nome, status_comercial_em, sla_horas_atual, sla_metade_em, sla_limite_em", { count: "exact" })
      // @ts-ignore
      .is("deleted_at", null)
      .is("is_deleted", false)
      .order("updated_at", { ascending: false });

    if (scope === "meus") vq = vq.eq("consultor_id", consultorId ?? "00000000-0000-0000-0000-000000000000");
    if (clienteId) vq = vq.eq("cliente_id", clienteId);
    if (q) vq = vq.or(`cliente_razao_social.ilike.%${q}%,numero.ilike.%${q}%,cliente_cnpj.ilike.%${q}%,cliente_telefone.ilike.%${q}%`);
    if (operadora !== "todos") vq = vq.eq("operadora", operadora as "CLARO" | "VIVO");
    vq = applyConsultorFilter(vq, consultor);
    if (bko !== "todos") vq = vq.eq("bko_colab_id", bko);
    if (biometria === "vazio") vq = vq.is("status_biometria", null);
    else if (biometria !== "todos") vq = vq.ilike("status_biometria", `%${biometria}%`);
    if (erro === "aberto") vq = vq.eq("tem_erro", true);
    if (erro === "sem") vq = vq.or("tem_erro.is.null,tem_erro.eq.false");

    // A tabela agora é paginada depois da quebra por Tipo de Pedido + Produto.
    // O filtro de mês também depende da data operacional da venda, não mais de mes_ref.
    vq = vq.limit(5000);

    const { data, error } = await vq;
    if (requestId !== loadRequestRef.current) return;
    if (error) throw error;

    let pedidos = await enriquecerStatusUnificado((data ?? []) as unknown as PedidoRow[]);
    if (requestId !== loadRequestRef.current) return;

    if (!meusPedidosGrid && statusSelecionados.length > 0) {
      pedidos = pedidos.filter(item =>
        statusFiltroCorresponde(item.status_unificado_nome, statusSelecionados, true),
      );
    }

    if (mes !== "todos" || ano !== "todos") {
      pedidos = pedidos.filter(item => {
        if (!meusPedidosGrid) return correspondeMesAnoPedido(item, mes, ano);

        return meusPedidosCorrespondeMesAno({
          status: item.status_unificado_nome ?? item.status_comercial_nome ?? item.status_pedido,
          dataAtivacao: item.data_ativacao,
          dataPreenchimento: item.data_preenchimento,
        }, mes, ano);
      });
    }

    if (meusPedidosGrid && canFilterSla) {
      const estadosDisponiveis = new Set<string>(
        pedidos.map(item => getSlaState({
          startedAt: item.sla_unificado_inicio_em,
          slaHours: item.sla_unificado_horas,
        })),
      );
      setSlaColunaOpcoes(
        SLA_FILTER_OPTIONS.filter(([value]) => value === "todos" || estadosDisponiveis.has(value)),
      );
    }

    if (canFilterSla && slaFiltro !== "todos") {
      pedidos = pedidos.filter(item =>
        getSlaState({
          startedAt: item.sla_unificado_inicio_em,
          slaHours: item.sla_unificado_horas,
        }) === slaFiltro,
      );
    }

    const linhas = await carregarLinhasDosPedidos(pedidos.map(item => item.id));
    if (requestId !== loadRequestRef.current) return;

    let pedidosAgrupados = agruparPedidosPorTipoProduto(pedidos, linhas);

    // O filtro superior de Tipo participa da mesma interseção ANTES dos facets
    // das colunas, para que as opções exibidas também respeitem todos os filtros.
    if (tipo !== "todos") {
      pedidosAgrupados = pedidosAgrupados.filter(item =>
        normalizedDisplayKey(item.grupo_tipo_pedido) === normalizedDisplayKey(tipo),
      );
    }

    if (meusPedidosGrid) {
      // Base comum já filtrada por busca, mês/ano, operadora, SLA e Tipo.
      const baseColunas = pedidosAgrupados.filter(item =>
        pedidoProdutoVisivelEmMeusPedidos(item.grupo_produto),
      );

      const aplicarStatusManual = (source: PedidoRow[]) =>
        source.filter(item =>
          statusFiltroCorresponde(
            item.status_unificado_nome ?? item.status_comercial_nome ?? item.status_pedido,
            statusSelecionados,
            statusSelecaoManual,
          ),
        );

      // Status considera TODOS os outros filtros, mas ignora a si próprio.
      // Em modo automático, todos os status disponíveis aparecem marcados.
      const rowsParaStatus = aplicarFiltrosColunasMeusPedidos(baseColunas);
      const statusDisponiveis = uniqueNormalizedStrings(
        rowsParaStatus.map(item =>
          item.status_unificado_nome ?? item.status_comercial_nome ?? item.status_pedido,
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR"));
      setStatusOpcoes(statusDisponiveis);

      // Os demais seletores também respeitam uma eventual seleção manual
      // de Status, mantendo a interseção entre todos os filtros.
      const tiposDisponiveis = uniqueNormalizedStrings(
        aplicarStatusManual(aplicarFiltrosColunasMeusPedidos(baseColunas, "tipo_pedido"))
          .map(item => item.grupo_tipo_pedido),
      ).sort((a, b) => a.localeCompare(b, "pt-BR"));

      const produtosDisponiveis = uniqueNormalizedStrings(
        aplicarStatusManual(aplicarFiltrosColunasMeusPedidos(baseColunas, "tipo_produto"))
          .map(item => item.grupo_produto),
      ).sort((a, b) => a.localeCompare(b, "pt-BR"));

      setTipoPedidoColunaOpcoes(
        tiposDisponiveis.map(value => [value, uppercaseDisplay(value)] as FilterOption),
      );
      setTipoProdutoColunaOpcoes(
        produtosDisponiveis.map(value => [value, uppercaseDisplay(value)] as FilterOption),
      );

      setConsultoresColunaOpcoes(
        consultorOptionsFromRows(
          aplicarStatusManual(aplicarFiltrosColunasMeusPedidos(baseColunas, "consultor")),
        ),
      );

      const proximasOpcoes = {} as Record<PedidoDateColumn, string[]>;
      for (const [column, field] of PEDIDO_DATE_FIELDS) {
        const rowsParaData = aplicarStatusManual(
          aplicarFiltrosColunasMeusPedidos(baseColunas, column),
        );
        proximasOpcoes[column] = Array.from(new Set(
          rowsParaData
            .map(item => pedidoDateKey(item[field] == null ? null : String(item[field])))
            .filter((value): value is string => Boolean(value)),
        )).sort();
      }
      setDatasColunaOpcoes(proximasOpcoes);

      pedidosAgrupados = aplicarStatusManual(
        aplicarFiltrosColunasMeusPedidos(baseColunas),
      );
    }

    if (sortKey) {
      pedidosAgrupados = [...pedidosAgrupados].sort((a, b) => {
        const compared = comparePedidoRows(a, b, sortKey, sortDirection);
        if (compared !== 0) return compared;

        return new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime();
      });
    }

    if (requestId !== loadRequestRef.current) return;

    setValorTotalAgrupado(
      pedidosAgrupados.reduce((totalAtual, item) => totalAtual + Number(item.grupo_valor ?? 0), 0),
    );
    setQuantidadeTotalAgrupada(
      pedidosAgrupados.reduce((totalAtual, item) => totalAtual + Number(item.grupo_quantidade ?? 0), 0),
    );

    const filteredTotal = pedidosAgrupados.length;
    const start = page * pageSize;
    setRows(pedidosAgrupados.slice(start, start + pageSize));
    setTotal(filteredTotal);
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      console.error("Erro ao carregar pedidos:", err);
      setValorTotalAgrupado(0);
      setQuantidadeTotalAgrupada(0);
      toast.error("Erro ao carregar pedidos. Tente atualizar a página.");
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [q, operadora, consultor, bko, tipo, statusSelecionados, statusSelecaoManual, biometria, erro, slaFiltro, canFilterSla, sortKey, sortDirection, mes, ano, page, pageSize, clienteId, scope, consultorId, meusPedidosGrid, aplicarFiltrosColunasMeusPedidos]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const refresh = () => {
      void load();
      void loadDynamicFilterOptions();
    };

    const channel = supabase
      .channel("clientes-pedidos-status-unificado")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "venda_status_comercial_historico" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "venda_robo_logs", filter: "campo=eq.status_pedido" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "venda_robo_logs", filter: "campo=eq.status_comercial_nome" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "venda_robo_logs", filter: "campo=eq.status_portabilidade" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "venda_robo_logs", filter: "campo=eq.status_biometria" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "vendas" },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venda_linhas" },
        refresh,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, loadDynamicFilterOptions]);

  const tiposOpts = useMemo(() => Array.from(new Set(tipos.map(p => p.nome))).sort(), [tipos]);
  const bkos = useMemo(() => colaboradores.filter(c => (c.funcao ?? "").toLowerCase().includes("bko")), [colaboradores]);
  const pedidoColumns = useMemo(() => {
    const columns = pedidoTableColumns(comissoesVisible);
    if (!meusPedidosGrid) return columns;

    const visibleColumns = columns.filter(column => column !== "Envio");
    const ativacaoIndex = visibleColumns.indexOf("Ativação");
    if (ativacaoIndex < 0) return visibleColumns;

    return [
      ...visibleColumns.slice(0, ativacaoIndex + 1),
      "Portabilidade",
      ...visibleColumns.slice(ativacaoIndex + 1),
    ];
  }, [comissoesVisible, meusPedidosGrid]);

  // Os totalizadores representam sempre o resultado filtrado completo,
  // independentemente da página atual ou das linhas selecionadas.
  const valorTotalExibido = valorTotalAgrupado;
  const quantidadeTotalExibida = quantidadeTotalAgrupada;
  const todasLinhasVisiveisSelecionadas = meusPedidosGrid
    && rows.length > 0
    && rows.every(item => pedidosSelecionados.has(pedidoRowKey(item)));
  const algumaLinhaVisivelSelecionada = meusPedidosGrid
    && rows.some(item => pedidosSelecionados.has(pedidoRowKey(item)));

  function togglePedidoSelecionado(pedido: PedidoRow) {
    const key = pedidoRowKey(pedido);
    setPedidosSelecionados(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleTodosPedidosVisiveis() {
    const keys = rows.map(pedidoRowKey);
    setPedidosSelecionados(current => {
      const next = new Set(current);
      const todosJaSelecionados = keys.length > 0 && keys.every(key => next.has(key));
      for (const key of keys) {
        if (todosJaSelecionados) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  function isPedidoGridInteractiveTarget(target: HTMLElement) {
    return Boolean(target.closest(
      'button, a, input, textarea, select, [role="button"], [role="checkbox"], [role="tab"], [role="menuitem"]',
    ));
  }

  function handlePedidoGridPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!meusPedidosGrid || event.pointerType !== "mouse" || event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (isPedidoGridInteractiveTarget(target)) return;

    gridDragRef.current = {
      active: true,
      dragging: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
    };
  }

  function handlePedidoGridPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = gridDragRef.current;
    if (!meusPedidosGrid || !drag.active || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startX;
    if (!drag.dragging && Math.abs(deltaX) < 5) return;

    if (!drag.dragging) {
      drag.dragging = true;
      setGridDragScrolling(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      if (typeof window !== "undefined") window.getSelection()?.removeAllRanges();
    }

    event.preventDefault();

    // Movimento deliberadamente mais suave que o deslocamento bruto do mouse.
    event.currentTarget.scrollLeft = drag.startScrollLeft + (deltaX * 0.72);
  }

  function stopPedidoGridDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = gridDragRef.current;
    if (!drag.active || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    gridDragRef.current = {
      active: false,
      dragging: false,
      pointerId: -1,
      startX: 0,
      startScrollLeft: event.currentTarget.scrollLeft,
    };
    setGridDragScrolling(false);
  }

  function handlePedidoGridKeyDown(event: React.KeyboardEvent<HTMLTableElement>) {
    if (!meusPedidosGrid) return;

    const target = event.target as HTMLElement;
    const cell = target.closest<HTMLElement>('[data-pedido-grid-cell="true"]');
    if (!cell) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
      const selection = typeof window !== "undefined" ? window.getSelection() : null;
      if (selection && !selection.isCollapsed) return;

      const value = cell.innerText.trim();
      if (value && navigator.clipboard?.writeText) {
        event.preventDefault();
        void navigator.clipboard.writeText(value);
      }
      return;
    }

    const row = Number(cell.dataset.gridRow);
    const col = Number(cell.dataset.gridCol);

    if (event.key === "Tab" || event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const delta = event.key === "ArrowLeft" || (event.key === "Tab" && event.shiftKey) ? -1 : 1;
      const nextCell = event.currentTarget.querySelector<HTMLElement>(
        `[data-pedido-grid-cell="true"][data-grid-row="${row}"][data-grid-col="${col + delta}"]`,
      );

      // Navegação horizontal fica presa à própria linha.
      event.preventDefault();
      if (nextCell) nextCell.focus();
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const nextRow = row + (event.key === "ArrowUp" ? -1 : 1);
      const nextCell = event.currentTarget.querySelector<HTMLElement>(
        `[data-pedido-grid-cell="true"][data-grid-row="${nextRow}"][data-grid-col="${col}"]`,
      );

      if (!nextCell) return;
      event.preventDefault();
      nextCell.focus();
    }
  }

  function gridCellProps(rowIndex: number, colIndex: number) {
    return meusPedidosGrid
      ? {
          tabIndex: 0,
          "data-pedido-grid-cell": "true",
          "data-grid-row": String(rowIndex),
          "data-grid-col": String(colIndex),
        }
      : {};
  }

  function abrirExcluirPedido(pedido: PedidoRow) {
    if (!podeExcluirPedido) {
      toast.error("Apenas administradores e BKO podem excluir pedidos.");
      return;
    }
    setPedidoExcluir(pedido);
    setPedidoExcluirReason("");
  }

  async function confirmDeletePedido() {
    if (!pedidoExcluir || !pedidoExcluirReason.trim()) return;
    setPedidoExcluirLoading(true);
    try {
      const { deleteVenda } = await import("@/lib/exclusao.functions");
      const res = (await deleteVenda({ data: { vendaId: pedidoExcluir.id, reason: pedidoExcluirReason.trim() } })) as { success?: boolean };
      if (!res?.success) throw new Error("Não foi possível confirmar a exclusão do pedido.");

      toast.success("Pedido excluído com sucesso.");
      setRows(current => current.filter(row => row.id !== pedidoExcluir.id));
      setTotal(current => Math.max(0, current - 1));
      setPedidoExcluir(null);
      setPedidoExcluirReason("");
      await load();
    } catch (e: any) {
      console.error("[ERRO EXCLUSÃO PEDIDO]", e);
      toast.error(e?.message || "Não foi possível excluir o pedido. Tente novamente.");
    } finally {
      setPedidoExcluirLoading(false);
    }
  }

  async function exportar() {
    toast.info("Gerando CSV…");
    let vq = supabase
      .from("vendas")
      .select("id, numero, cliente_razao_social, cliente_cnpj, operadora, tipo_pedido, tipo_pedidos, produto, produtos, consultor_id, consultor_nome, bko_nome, valor, quantidade_linhas, mes_ref, ano_ref, funil, etapa_id, status, status_pedido, status_pedido_em, status_biometria, tem_erro, data_recebimento, data_preenchimento, data_envio, data_aceite, data_input, data_ativacao, concluido_em, data_portabilidade, data_entrega, updated_at, created_at, status_pedido_user_nome, status_comercial_nome, status_comercial_em, sla_horas_atual, sla_limite_em")
      // @ts-ignore
      .is("deleted_at", null)
      .is("is_deleted", false)
      .order("updated_at", { ascending: false })
      .limit(5000);
    if (scope === "meus") vq = vq.eq("consultor_id", consultorId ?? "00000000-0000-0000-0000-000000000000");
    if (clienteId) vq = vq.eq("cliente_id", clienteId);
    if (q) vq = vq.or(`cliente_razao_social.ilike.%${q}%,numero.ilike.%${q}%,cliente_cnpj.ilike.%${q}%,cliente_telefone.ilike.%${q}%`);
    if (operadora !== "todos") vq = vq.eq("operadora", operadora as "CLARO" | "VIVO");
    vq = applyConsultorFilter(vq, consultor);
    if (bko !== "todos") vq = vq.eq("bko_colab_id", bko);
    if (biometria === "vazio") vq = vq.is("status_biometria", null);
    else if (biometria !== "todos") vq = vq.ilike("status_biometria", `%${biometria}%`);
    if (erro === "aberto") vq = vq.eq("tem_erro", true);
    if (erro === "sem") vq = vq.or("tem_erro.is.null,tem_erro.eq.false");
    const { data, error } = await vq;
    if (error) { toast.error("Falha ao exportar", { description: error.message }); return; }

    let exportRows = await enriquecerStatusUnificado((data ?? []) as unknown as PedidoRow[]);

    if (!meusPedidosGrid && statusSelecionados.length > 0) {
      exportRows = exportRows.filter(item =>
        statusFiltroCorresponde(item.status_unificado_nome, statusSelecionados, true),
      );
    }

    if (canFilterSla && slaFiltro !== "todos") {
      exportRows = exportRows.filter(item =>
        getSlaState({
          startedAt: item.sla_unificado_inicio_em,
          slaHours: item.sla_unificado_horas,
        }) === slaFiltro,
      );
    }

    if (mes !== "todos" || ano !== "todos") {
      exportRows = exportRows.filter(item => {
        if (!meusPedidosGrid) return correspondeMesAnoPedido(item, mes, ano);

        return meusPedidosCorrespondeMesAno({
          status: item.status_unificado_nome ?? item.status_comercial_nome ?? item.status_pedido,
          dataAtivacao: item.data_ativacao,
          dataPreenchimento: item.data_preenchimento,
        }, mes, ano);
      });
    }

    const linhasExportacao = await carregarLinhasDosPedidos(exportRows.map(item => item.id));
    exportRows = agruparPedidosPorTipoProduto(exportRows, linhasExportacao);

    if (meusPedidosGrid) {
      exportRows = exportRows.filter(item =>
        pedidoProdutoVisivelEmMeusPedidos(item.grupo_produto),
      );
    }

    if (tipo !== "todos") {
      exportRows = exportRows.filter(item =>
        normalizedDisplayKey(item.grupo_tipo_pedido) === normalizedDisplayKey(tipo),
      );
    }

    if (meusPedidosGrid) {
      exportRows = aplicarFiltrosColunasMeusPedidos(exportRows).filter(item =>
        statusFiltroCorresponde(
          item.status_unificado_nome ?? item.status_comercial_nome ?? item.status_pedido,
          statusSelecionados,
          statusSelecaoManual,
        ),
      );
    }

    baixarCsv("pedidos",
      ["ID", "Pedido", "Cliente", "CNPJ/CPF", "Operadora", "Tipo Pedido", "Tipo Produto", "Quantidade Produto", "Consultor", "BKO", "Valor Agrupado",
        "Mes ref", "Ano ref", "Funil", "Etapa", "Status", "SLA horas", "Resultado", "Biometria", "Erro em aberto",
        "Recebimento", "Preenchimento", "Envio", "Aceite", "Input", "Ativacao", "Concluído em", "Portabilidade", "Entrega",
        "Ultima alteracao de status", "Ultima alteracao por", "Criado em"],
      exportRows.map((p: any) => [
        p.id, p.numero, p.cliente_razao_social, p.cliente_cnpj, p.operadora, p.grupo_tipo_pedido, p.grupo_produto, p.grupo_quantidade,
        p.consultor_nome, p.bko_nome, p.grupo_valor, p.mes_ref, p.ano_ref, p.funil, p.etapa_id,
        p.status_unificado_nome ?? p.status_comercial_nome ?? p.status_pedido, p.sla_unificado_horas ?? p.sla_horas_atual,
        p.status_pedido, p.status_biometria, p.tem_erro ? "Sim" : "Nao",
        fmtDate(p.data_recebimento), fmtDate(p.data_preenchimento), fmtDate(p.data_envio), fmtDate(p.data_aceite),
        fmtDate(p.data_input), fmtDate(p.data_ativacao), fmtDateTime(p.concluido_em), fmtDate(p.data_portabilidade), fmtDate(p.data_entrega),
        fmtDateTime(p.status_unificado_em), p.status_unificado_em ? (p.status_unificado_origem === "robo" ? "Robô OMNI" : (p.status_pedido_user_nome || "Atualização manual")) : "", fmtDateTime(p.created_at),
      ]));
    toast.success("CSV gerado");
  }

  return (
    <div className="space-y-3">
      {clienteId && (
        <div className="rounded-lg border border-omni/30 bg-omni/5 px-3 py-2 text-xs flex items-center justify-between">
          <span>Filtrando pedidos de um cliente específico.</span>
          <Button size="sm" variant="ghost" className="h-6 text-omni" onClick={onLimparCliente}>
            Limpar
          </Button>
        </div>
      )}

      {meusPedidosGrid ? (
        <div className="flex flex-wrap items-end gap-2">
          <h1 className="mr-2 text-2xl font-display font-bold tracking-tight">Meus Pedidos</h1>

          <div className="relative min-w-[260px] flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Cliente, nº do pedido, CNPJ, telefone…"
              className="h-8 pl-8 text-xs bg-surface-1"
            />
          </div>

          <FilterSelect
            label="Mês"
            value={mes}
            onChange={setMes}
            options={[["todos", "Todos"], ...MESES.map((m, i) => [String(i + 1), m] as [string, string])]}
          />

          <FilterSelect
            label="Ano"
            value={ano}
            onChange={setAno}
            options={[["todos", "Todos"], ...anosDisponiveis.map(value => [String(value), String(value)] as [string, string])]}
          />

          {isAdmin && scope === "global" && (
            <Button variant="outline" className="h-8 gap-1.5 px-2.5 text-[10px] text-omni border-omni/40" onClick={exportar}>
              <Download className="size-3.5" /> Exportar CSV
            </Button>
          )}

          <NovaVendaDialog triggerLabel="Novo Pedido" />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-2 flex flex-wrap items-end gap-1.5">
          <div className="relative flex-1 min-w-[190px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Cliente, nº do pedido, CNPJ, telefone…" className="h-8 pl-8 text-xs bg-surface-1" />
          </div>
          <FilterSelect label="Operadora" value={operadora} onChange={setOperadora} options={[["todos", "Geral OMNI"], ["CLARO", "Claro"], ["VIVO", "Vivo"]]} />
          <FilterSelect
            label="Consultor"
            value={consultor}
            onChange={setConsultor}
            options={[["todos", "Todos"], ...consultorOptions.map(option => [option.value, option.label] as [string, string])]}
          />
          <MultiFilterSelect
            label="Status"
            values={statusSelecionados}
            options={statusOpcoes}
            onChange={setStatusSelecionados}
          />
          <FilterSelect label="BKO" value={bko} onChange={setBko}
            options={[["todos", "Todos"], ...bkos.map(c => [c.id, c.nome_exibicao] as [string, string])]} />
          {canFilterSla && <FilterSelect label="SLA" value={slaFiltro} onChange={setSlaFiltro} options={SLA_FILTER_OPTIONS} />}
          <FilterSelect label="Biometria" value={biometria} onChange={setBiometria} options={[
            ["todos", "Todas"], ["vazio", "Vazio"], ["pend", "Pendente"], ["conclu", "Concluído"], ["cancel", "Cancelado"],
          ]} />
          <FilterSelect label="Erro" value={erro} onChange={setErro} options={[
            ["todos", "Todos"], ["aberto", "Com erro em aberto"], ["sem", "Sem erro em aberto"],
          ]} />
          <FilterSelect label="Mês" value={mes} onChange={setMes}
            options={[["todos", "Todos"], ...MESES.map((m, i) => [String(i + 1), m] as [string, string])]} />
          <FilterSelect label="Ano" value={ano} onChange={setAno}
            options={[["todos", "Todos"], ...ANOS.map(a => [String(a), String(a)] as [string, string])]} />
          {isAdmin && scope === "global" && (
            <Button variant="outline" className="h-8 gap-1.5 px-2.5 text-[10px] text-omni border-omni/40" onClick={exportar}>
              <Download className="size-3.5" /> Exportar CSV
            </Button>
          )}
        </div>
      )}

      {(() => {
        const grid = (
          <div
            className={cn(
              "rounded-xl border border-border bg-card",
              gridMaximized && "fixed inset-0 z-[40] flex h-[100dvh] w-screen flex-col overflow-hidden rounded-none bg-background shadow-2xl",
            )}
          >
        <div className="flex min-h-9 shrink-0 items-center border-b border-border/40 px-2 py-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[10px]"
            onClick={() => setGridMaximized(current => !current)}
            title={gridMaximized ? "Fechar visualização ampliada" : "Maximizar tabela"}
          >
            {gridMaximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
            {gridMaximized ? "Fechar" : "Maximizar"}
          </Button>

          {meusPedidosGrid && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-[10px]"
              onClick={limparFiltrosColunas}
              disabled={!temFiltrosColunaAtivos}
              title="Limpar filtros das colunas"
            >
              <ListFilter className="size-3.5" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div
          className={cn(
            "overflow-x-auto",
            meusPedidosGrid && (gridDragScrolling ? "cursor-grabbing select-none" : "cursor-grab"),
            gridMaximized && "min-h-0 flex-1 overflow-auto",
          )}
          onPointerDown={meusPedidosGrid ? handlePedidoGridPointerDown : undefined}
          onPointerMove={meusPedidosGrid ? handlePedidoGridPointerMove : undefined}
          onPointerUp={meusPedidosGrid ? stopPedidoGridDrag : undefined}
          onPointerCancel={meusPedidosGrid ? stopPedidoGridDrag : undefined}
          onDragStart={meusPedidosGrid ? event => event.preventDefault() : undefined}
        >
          <Table
            className={cn(gridMaximized && "min-w-max")}
            onKeyDown={meusPedidosGrid ? handlePedidoGridKeyDown : undefined}
          >
            <TableHeader className="bg-surface-2 sticky top-0 z-10">
              <TableRow className="hover:bg-transparent [&>th]:border-r [&>th]:border-border/20 [&>th:last-child]:border-r-0">
                {meusPedidosGrid && (
                  <TableHead className="h-7 w-9 px-1 text-center">
                    <Checkbox
                      checked={todasLinhasVisiveisSelecionadas ? true : algumaLinhaVisivelSelecionada ? "indeterminate" : false}
                      onCheckedChange={toggleTodosPedidosVisiveis}
                      aria-label="Selecionar pedidos visíveis"
                    />
                  </TableHead>
                )}
                {pedidoColumns.map(h => {
                  if (meusPedidosGrid && h === "Op.") {
                    return (
                      <TableHead key={h} className="h-7 whitespace-nowrap px-1 py-0 text-center">
                        <SingleColumnFilter
                          label="Op."
                          value={operadora}
                          onChange={setOperadora}
                          options={[["todos", "Geral OMNI"], ["CLARO", "Claro"], ["VIVO", "Vivo"]]}
                        />
                      </TableHead>
                    );
                  }

                  if (meusPedidosGrid && h === "Status") {
                    const active = sortKey === "status";
                    const Icon = active
                      ? sortDirection === "asc"
                        ? ArrowUp
                        : ArrowDown
                      : ArrowUpDown;

                    return (
                      <TableHead key={h} className="h-7 min-w-[220px] whitespace-nowrap px-1 py-0">
                        <div className="flex items-center justify-center gap-0.5">
                          <StatusColumnFilter
                            values={statusSelecionadosExibidos}
                            options={statusOpcoes}
                            manual={statusSelecaoManual}
                            onChange={alterarStatusSelecionados}
                            onReset={restaurarStatusAutomatico}
                          />
                          <button
                            type="button"
                            onClick={() => togglePedidoSort("status")}
                            className={cn(
                              "grid size-6 place-items-center rounded hover:bg-muted",
                              active ? "text-omni" : "text-muted-foreground",
                            )}
                            title="Ordenar Status alfabeticamente"
                          >
                            <Icon className="size-3" />
                          </button>
                        </div>
                      </TableHead>
                    );
                  }

                  if (meusPedidosGrid && h === "SLA" && canFilterSla) {
                    const active = sortKey === "sla";
                    const Icon = active
                      ? sortDirection === "asc"
                        ? ArrowUp
                        : ArrowDown
                      : ArrowUpDown;

                    return (
                      <TableHead key={h} className="h-7 whitespace-nowrap px-1 py-0">
                        <div className="flex items-center justify-center gap-0.5">
                          <SingleColumnFilter
                            label="SLA"
                            value={slaFiltro}
                            onChange={setSlaFiltro}
                            options={slaColunaOpcoes.length > 0 ? slaColunaOpcoes : [["todos", "Todos os prazos"]]}
                          />
                          <button
                            type="button"
                            onClick={() => togglePedidoSort("sla")}
                            className={cn(
                              "grid size-6 place-items-center rounded hover:bg-muted",
                              active ? "text-omni" : "text-muted-foreground",
                            )}
                            title="Ordenar SLA: vermelho → laranja → verde"
                          >
                            <Icon className="size-3" />
                          </button>
                        </div>
                      </TableHead>
                    );
                  }

                  if (meusPedidosGrid && h === "Tipo Pedido") {
                    return (
                      <TableHead key={h} className="h-7 whitespace-nowrap px-1 py-0">
                        <MultiColumnFilter
                          label="Tipo Pedido"
                          options={tipoPedidoColunaOpcoes}
                          hiddenValues={tipoPedidoColunaOcultos}
                          onChange={setTipoPedidoColunaOcultos}
                        />
                      </TableHead>
                    );
                  }

                  if (meusPedidosGrid && h === "Tipo Produto") {
                    return (
                      <TableHead key={h} className="h-7 whitespace-nowrap px-1 py-0">
                        <MultiColumnFilter
                          label="Tipo Produto"
                          options={tipoProdutoColunaOpcoes}
                          hiddenValues={tipoProdutoColunaOcultos}
                          onChange={setTipoProdutoColunaOcultos}
                        />
                      </TableHead>
                    );
                  }

                  const dateColumn = (
                    ["Ult. Alteração", "Recebimento", "Preenchimento", "Envio", "Aceite", "Ativação", "Portabilidade"] as PedidoDateColumn[]
                  ).includes(h as PedidoDateColumn)
                    ? h as PedidoDateColumn
                    : null;

                  if (meusPedidosGrid && dateColumn) {
                    return (
                      <TableHead key={h} className="h-7 whitespace-nowrap px-1 py-0 text-center">
                        <PedidoDateColumnFilter
                          label={h}
                          value={datasColuna[dateColumn]}
                          availableDates={datasColunaOpcoes[dateColumn]}
                          onChange={value => setDatasColuna(current => ({
                            ...current,
                            [dateColumn]: value,
                          }))}
                        />
                      </TableHead>
                    );
                  }

                  const key: PedidoSortKey | null =
                    h === "SLA"
                      ? "sla"
                      : h === "Status"
                        ? "status"
                        : h === "Biometria"
                          ? "biometria"
                          : null;

                  const centered = ["SLA", "Op.", "Status", "Biometria", "Qtd.", "Recebimento", "Aceite", "Preenchimento", "Envio", "Ativação"].includes(h);
                  const rightAligned = ["Valor", "Ult. Alteração", "Ações"].includes(h);

                  if (!key) {
                    return (
                      <TableHead
                        key={h}
                        className={cn(
                          "h-7 whitespace-nowrap px-2 py-1 uppercase tracking-[0.05em]",
                          meusPedidosGrid ? "text-[10px]" : "text-[9px]",
                          meusPedidosGrid && h === "CNPJ/CPF" && "min-w-[160px]",
                          centered && "text-center",
                          rightAligned && "text-right",
                        )}
                      >
                        {h === "Valor" ? (
                          <div className="flex flex-col items-end leading-tight">
                            <span>Valor</span>
                            <span className={cn("mt-0.5 font-bold text-success normal-case tracking-normal", meusPedidosGrid ? "text-[10px]" : "text-[8px]")}>
                              {maskValor(valorTotalExibido, primaryRole)}
                            </span>
                            {meusPedidosGrid && pedidosSelecionados.size > 0 && (
                              <span className="text-[8px] font-medium normal-case tracking-normal text-omni">
                                {pedidosSelecionados.size} selecionado{pedidosSelecionados.size === 1 ? "" : "s"}
                              </span>
                            )}
                          </div>
                        ) : h === "Qtd." ? (
                          <div className="flex flex-col items-center leading-tight">
                            <span>Qtd.</span>
                            <span className={cn("mt-0.5 font-bold text-omni normal-case tracking-normal tabular-nums", meusPedidosGrid ? "text-[10px]" : "text-[8px]")}>
                              {quantidadeTotalExibida.toLocaleString("pt-BR")}
                            </span>
                          </div>
                        ) : h === "Consultor" && meusPedidosGrid ? (
                          <ConsultorColumnFilter
                            options={consultoresColunaOpcoes}
                            hiddenValues={consultoresColunaOcultos}
                            onChange={setConsultoresColunaOcultos}
                          />
                        ) : h}
                      </TableHead>
                    );
                  }

                  const active = sortKey === key;
                  const Icon = active
                    ? sortDirection === "asc"
                      ? ArrowUp
                      : ArrowDown
                    : ArrowUpDown;

                  return (
                    <TableHead key={h} className="h-7 whitespace-nowrap p-0">
                      <button
                        type="button"
                        onClick={() => togglePedidoSort(key)}
                        className={cn(
                          "flex h-7 w-full items-center justify-center gap-1 px-2 py-1 text-center font-medium uppercase tracking-[0.05em] transition-colors hover:text-foreground",
                          meusPedidosGrid ? "text-[10px]" : "text-[9px]",
                          active ? "text-omni" : "text-muted-foreground",
                        )}
                        title={
                          key === "sla"
                            ? "Ordenar SLA: vermelho → laranja → verde"
                            : key === "status"
                              ? "Ordenar Status alfabeticamente"
                              : "Ordenar Biometria: pendente → cancelada → concluída"
                        }
                      >
                        <span>{h}</span>
                        <Icon className="size-3 shrink-0" />
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: pedidoColumns.length + (meusPedidosGrid ? 1 : 0) }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full opacity-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={pedidoColumns.length + (meusPedidosGrid ? 1 : 0)} className="text-center py-20 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                      <div className="size-12 rounded-full bg-surface-2 grid place-items-center">
                        <FileText className="size-6 opacity-20" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">Nenhum pedido encontrado</p>
                        <p className="text-xs">Tente ajustar seus filtros ou busca.</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
              {!loading && rows.map((p, rowIndex) => {
                const rowKey = pedidoRowKey(p);
                const selecionado = meusPedidosGrid && pedidosSelecionados.has(rowKey);

                return (
                <TableRow
                  key={rowKey}
                  className={cn(
                    "border-b border-border/20 odd:bg-surface-1/45 even:bg-card hover:bg-[var(--omni)]/[0.045] [&>td]:border-r [&>td]:border-border/20 [&>td:last-child]:border-r-0",
                    meusPedidosGrid ? "cursor-default" : "cursor-pointer",
                    selecionado && "!bg-[var(--omni)]/[0.11] hover:!bg-[var(--omni)]/[0.14]",
                  )}
                  onClick={meusPedidosGrid
                    ? undefined
                    : () => navigate({ ...buildVendaDetailUrl(p.id), search: { suporte: undefined, etapaSuporte: undefined } })}
                >
                  {meusPedidosGrid && (
                    <TableCell className="w-9 px-1 py-1 text-center" onClick={event => event.stopPropagation()}>
                      <Checkbox
                        checked={selecionado}
                        onCheckedChange={() => togglePedidoSelecionado(p)}
                        aria-label={`Selecionar ${p.cliente_razao_social}`}
                      />
                    </TableCell>
                  )}
                  <TableCell {...gridCellProps(rowIndex, 0)} className="px-2 py-1 text-center">
                    <SlaPedidoBadge
                      startedAt={p.sla_unificado_inicio_em ?? p.status_comercial_em}
                      slaHours={p.sla_unificado_horas ?? null}
                    />
                  </TableCell>
                  <TableCell {...gridCellProps(rowIndex, 1)} className="max-w-[170px] truncate px-2 py-1 text-[10px] font-medium" title={uppercaseDisplay(p.cliente_razao_social)}>
                    {uppercaseDisplay(p.cliente_razao_social)}
                  </TableCell>
                  <TableCell {...gridCellProps(rowIndex, 2)} className={cn("px-2 py-1 text-left font-mono text-[9px]", meusPedidosGrid && "min-w-[160px] whitespace-nowrap")}>{formatCpfCnpjVisible(p.cliente_cnpj)}</TableCell>
                  <TableCell {...gridCellProps(rowIndex, 3)} className="px-2 py-1 text-center"><OperadoraBadge op={p.operadora} /></TableCell>
                  <TableCell {...gridCellProps(rowIndex, 4)} className={cn("whitespace-nowrap px-2 py-1 text-center text-[9px]", meusPedidosGrid ? "min-w-[220px]" : "max-w-[210px]")}>
                    {p.status_unificado_nome ? (
                      <div
                        className="flex min-w-0 items-center justify-center gap-1"
                        title={[
                          p.status_unificado_nome,
                          p.status_unificado_origem === "robo" ? "Robô OMNI" : "Atualização manual",
                          p.status_unificado_label,
                          p.status_unificado_em ? fmtDateTime(p.status_unificado_em) : null,
                        ].filter(Boolean).join(" · ")}
                      >
                        {p.status_unificado_origem === "robo" && (
                          <Bot className="size-3 shrink-0 text-violet-400" />
                        )}
                        <span className={cn(meusPedidosGrid ? "whitespace-nowrap" : "truncate")}>{uppercaseDisplay(p.status_unificado_nome)}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell {...gridCellProps(rowIndex, 5)} className="max-w-[120px] truncate whitespace-nowrap px-2 py-1 text-left text-[9px]">{uppercaseDisplay(p.consultor_nome)}</TableCell>
                  <TableCell {...gridCellProps(rowIndex, 6)} className="px-2 py-1 text-center"><BiometriaBadge v={p.status_biometria} /></TableCell>
                  <TableCell {...gridCellProps(rowIndex, 7)} className="max-w-[150px] truncate whitespace-nowrap px-2 py-1 text-left text-[9px] font-medium" title={uppercaseDisplay(p.grupo_tipo_pedido)}>
                    {uppercaseDisplay(p.grupo_tipo_pedido)}
                  </TableCell>
                  <TableCell {...gridCellProps(rowIndex, 8)} className="max-w-[130px] truncate whitespace-nowrap px-2 py-1 text-left text-[9px] font-medium" title={uppercaseDisplay(p.grupo_produto)}>
                    {uppercaseDisplay(p.grupo_produto)}
                  </TableCell>
                  <TableCell {...gridCellProps(rowIndex, 9)} className="whitespace-nowrap px-2 py-1 text-center text-[9px] font-bold tabular-nums">
                    {p.grupo_quantidade ?? 0}
                  </TableCell>
                  <TableCell {...gridCellProps(rowIndex, 10)} className="whitespace-nowrap px-2 py-1 text-right text-[9px] font-semibold tabular-nums text-success">
                    {maskValor(Number(p.grupo_valor ?? 0), primaryRole)}
                  </TableCell>
                  <TableCell
                    {...gridCellProps(rowIndex, 11)}
                    className="whitespace-nowrap px-2 py-1 text-right text-[9px] tabular-nums"
                    title={p.status_unificado_em
                      ? `Última alteração de status · ${p.status_unificado_origem === "robo" ? "Robô OMNI" : "Atualização manual"}`
                      : "Sem alteração de status registrada"}
                  >
                    {fmtDateTime(p.status_unificado_em)}
                  </TableCell>
                  <TableCell {...gridCellProps(rowIndex, 12)} className="whitespace-nowrap px-2 py-1 text-center text-[9px] tabular-nums">{fmtDate(p.data_recebimento)}</TableCell>
                  <TableCell {...gridCellProps(rowIndex, 13)} className="whitespace-nowrap px-2 py-1 text-center text-[9px] tabular-nums">{fmtDate(p.data_preenchimento)}</TableCell>
                  {!meusPedidosGrid && (
                    <TableCell {...gridCellProps(rowIndex, 14)} className="whitespace-nowrap px-2 py-1 text-center text-[9px] tabular-nums">{fmtDate(p.data_envio)}</TableCell>
                  )}
                  <TableCell {...gridCellProps(rowIndex, meusPedidosGrid ? 14 : 15)} className="whitespace-nowrap px-2 py-1 text-center text-[9px] tabular-nums">{fmtDate(p.data_aceite)}</TableCell>
                  <TableCell {...gridCellProps(rowIndex, meusPedidosGrid ? 15 : 16)} className="whitespace-nowrap px-2 py-1 text-center text-[9px] tabular-nums">{fmtDate(p.data_ativacao)}</TableCell>
                  {meusPedidosGrid && (
                    <TableCell {...gridCellProps(rowIndex, 16)} className="whitespace-nowrap px-2 py-1 text-center text-[9px] tabular-nums">{fmtDate(p.data_portabilidade)}</TableCell>
                  )}
                  <TableCell className="whitespace-nowrap px-1 py-1 text-right" onClick={e => e.stopPropagation()}>
                    <Button asChild variant="ghost" size="sm" className="h-6 px-1.5 text-omni" title="Abrir pedido">
                      <Link
                        {...buildVendaDetailUrl(p.id)}
                        search={{
                          suporte: undefined,
                          etapaSuporte: undefined,
                          clienteId: p.cliente_id || undefined
                        }}
                      >
                        <FileText className="size-3.5" />
                      </Link>
                    </Button>
                    {podeExcluirPedido && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirExcluirPedido(p);
                        }}
                        title="Excluir pedido"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </TableCell>

                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className={cn("px-3 pb-3", gridMaximized && "shrink-0 bg-background pt-1")}>
          <Paginacao
            page={page}
            total={total}
            onPage={setPage}
            label="pedidos"
            pageSize={pageSize}
            onPageSizeChange={size => {
              setPage(0);
              setPageSize(size);
            }}
          />
        </div>
          </div>
        );

        return gridMaximized && typeof document !== "undefined"
          ? createPortal(grid, document.body)
          : grid;
      })()}

      <AlertDialog open={!!pedidoExcluir} onOpenChange={(o) => {
        if (!o && !pedidoExcluirLoading) {
          setPedidoExcluir(null);
          setPedidoExcluirReason("");
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este pedido? Essa ação removerá o pedido das telas do sistema.
              {pedidoExcluir && (
                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-destructive text-[11px] font-semibold">
                  Pedido: {pedidoExcluir.numero || "—"}<br />
                  Cliente: {pedidoExcluir.cliente_razao_social || "—"}
                </div>
              )}
              O cliente vinculado não será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo da exclusão (obrigatório)</Label>
            <Textarea
              value={pedidoExcluirReason}
              onChange={e => setPedidoExcluirReason(e.target.value)}
              placeholder="Ex: Pedido duplicado, cadastro incorreto, desistência..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pedidoExcluirLoading}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!pedidoExcluirReason.trim() || pedidoExcluirLoading}
              onClick={confirmDeletePedido}
            >
              {pedidoExcluirLoading ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- filtros / dialog ---------- */

function PedidoDateColumnFilter({
  label,
  value,
  availableDates,
  onChange,
}: {
  label: string;
  value: PedidoDateFilter;
  availableDates: string[];
  onChange: (value: PedidoDateFilter) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);
  const availableDateObjects = useMemo(
    () => availableDates.map(dateKeyToLocalDate).filter((date): date is Date => Boolean(date)),
    [availableDates],
  );
  const selectedDates = useMemo(
    () => value.dates.map(dateKeyToLocalDate).filter((date): date is Date => Boolean(date)),
    [value.dates],
  );
  const firstMonth = selectedDates[0] ?? availableDateObjects[availableDateObjects.length - 1];
  const firstAvailable = availableDateObjects[0];
  const lastAvailable = availableDateObjects[availableDateObjects.length - 1];
  const active = value.mode !== "todos" || value.dates.length > 0;

  const summary = value.mode === "com_data"
    ? "Todas as datas"
    : value.mode === "sem_data"
      ? "Sem datas"
      : value.mode === "datas" && value.dates.length > 0
        ? `${value.dates.length} data${value.dates.length === 1 ? "" : "s"}`
        : "Todos";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded px-1 text-[10px] uppercase tracking-[0.05em] hover:bg-muted",
            active ? "text-omni" : "text-muted-foreground",
          )}
          title={`Filtrar ${label}: ${summary}`}
        >
          <span>{label}</span>
          {value.mode === "datas" && value.dates.length > 0 && (
            <span className="rounded bg-omni/15 px-1 text-[8px] font-bold text-omni">
              {value.dates.length}
            </span>
          )}
          <ChevronDown className="size-2.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-44 p-1.5">
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant={value.mode === "todos" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-full justify-start px-2 text-[9px]"
            onClick={() => {
              setCalendarOpen(false);
              onChange({ mode: "todos", dates: [] });
            }}
          >
            Todos
          </Button>

          <Button
            type="button"
            variant={value.mode === "com_data" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-full justify-start px-2 text-[9px]"
            onClick={() => {
              setCalendarOpen(false);
              onChange({ mode: "com_data", dates: [] });
            }}
          >
            Todas as datas
          </Button>

          <Button
            type="button"
            variant={value.mode === "sem_data" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 w-full justify-start px-2 text-[9px]"
            onClick={() => {
              setCalendarOpen(false);
              onChange({ mode: "sem_data", dates: [] });
            }}
          >
            Sem datas
          </Button>

          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={value.mode === "datas" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 w-full justify-between px-2 text-[9px]"
                disabled={availableDates.length === 0}
                onClick={() => {
                  if (value.mode !== "datas") {
                    onChange({ mode: "datas", dates: [] });
                  }
                }}
              >
                <span>Selecionar datas</span>
                {value.dates.length > 0 && (
                  <span className="rounded bg-omni/15 px-1 text-[8px] font-bold text-omni">
                    {value.dates.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>

            <PopoverContent
              side="left"
              align="start"
              sideOffset={8}
              className="w-auto p-1.5"
            >
              <div className="mb-1 flex items-center justify-between gap-3 px-1">
                <span className="text-[9px] font-semibold">Datas disponíveis</span>
                {value.dates.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[8px]"
                    onClick={() => onChange({ mode: "datas", dates: [] })}
                  >
                    Limpar
                  </Button>
                )}
              </div>

              <CalendarPicker
                mode="multiple"
                selected={selectedDates}
                defaultMonth={firstMonth}
                startMonth={firstAvailable}
                endMonth={lastAvailable}
                showOutsideDays={false}
                hidden={date => !availableSet.has(localDateToKey(date))}
                onSelect={dates => {
                  const keys = (dates ?? [])
                    .map(localDateToKey)
                    .filter(date => availableSet.has(date))
                    .sort();
                  onChange({ mode: "datas", dates: keys });
                }}
                className="p-1 [--cell-size:1.7rem]"
              />

              <div className="border-t border-border px-1 pt-1 text-[8px] text-muted-foreground">
                Só aparecem dias que possuem pedidos nesta coluna.
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SingleColumnFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const active = value !== "todos";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded px-1 text-[10px] uppercase tracking-[0.05em] hover:bg-muted",
            active ? "text-omni" : "text-muted-foreground",
          )}
          title={`Filtrar ${label}`}
        >
          <span>{label}</span>
          <ChevronDown className="size-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-52 p-1.5">
        {options.map(([optionValue, optionLabel]) => (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] hover:bg-muted",
              value === optionValue && "bg-muted/70 font-semibold",
            )}
          >
            <span className="grid size-4 shrink-0 place-items-center rounded border border-border">
              {value === optionValue && <Check className="size-3" />}
            </span>
            <span className="min-w-0 flex-1">{optionLabel}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function MultiColumnFilter({
  label,
  options,
  hiddenValues,
  onChange,
}: {
  label: string;
  options: FilterOption[];
  hiddenValues: string[];
  onChange: (values: string[]) => void;
}) {
  const hidden = useMemo(
    () => new Set(hiddenValues.map(value => normalizedDisplayKey(value))),
    [hiddenValues],
  );
  const selectedCount = options.filter(([value]) => !hidden.has(normalizedDisplayKey(value))).length;
  const filtered = hiddenValues.length > 0;

  function toggle(value: string) {
    const key = normalizedDisplayKey(value);
    onChange(
      hidden.has(key)
        ? hiddenValues.filter(item => normalizedDisplayKey(item) !== key)
        : [...hiddenValues, value],
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded px-1 text-[10px] uppercase tracking-[0.05em] hover:bg-muted",
            filtered ? "text-omni" : "text-muted-foreground",
          )}
          title={`Filtrar ${label}`}
        >
          <span>{label}</span>
          <ChevronDown className="size-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[9px] text-muted-foreground">
            {selectedCount === options.length
              ? "Todos selecionados"
              : `${selectedCount} de ${options.length} selecionados`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[9px]"
              disabled={hiddenValues.length === 0}
              onClick={() => onChange([])}
            >
              Selecionar todos
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[9px]"
              disabled={options.length === 0 || selectedCount === 0}
              onClick={() => onChange(options.map(([value]) => value))}
            >
              Limpar
            </Button>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-2 py-3 text-[10px] text-muted-foreground">Nenhuma opção disponível.</div>
          ) : options.map(([value, optionLabel]) => {
            const active = !hidden.has(normalizedDisplayKey(value));
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggle(value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] hover:bg-muted"
              >
                <Checkbox checked={active} tabIndex={-1} className="pointer-events-none" />
                <span className="min-w-0 flex-1 break-words">{optionLabel}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StatusColumnFilter({
  values,
  options,
  manual,
  onChange,
  onReset,
}: {
  values: string[];
  options: string[];
  manual: boolean;
  onChange: (values: string[]) => void;
  onReset: () => void;
}) {
  const normalizedSelected = new Set(values.map(value => normalizedDisplayKey(value)));
  const filtered = manual;

  function toggle(value: string) {
    const key = normalizedDisplayKey(value);
    const isActive = normalizedSelected.has(key);
    onChange(
      isActive
        ? values.filter(item => normalizedDisplayKey(item) !== key)
        : [...values, value],
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded px-1 text-[10px] uppercase tracking-[0.05em] hover:bg-muted",
            filtered ? "text-omni" : "text-muted-foreground",
          )}
          title="Filtrar Status"
        >
          <span>Status</span>
          <ChevronDown className="size-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[9px] text-muted-foreground">
            {!manual ? "Todos os status" : `${values.length} selecionado${values.length === 1 ? "" : "s"}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[9px]"
              onClick={onReset}
            >
              Todos
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[9px]" onClick={() => onChange([])}>
              Desmarcar
            </Button>
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {options.map(option => {
            const active = normalizedSelected.has(normalizedDisplayKey(option));
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggle(option)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] hover:bg-muted"
              >
                <Checkbox checked={active} tabIndex={-1} className="pointer-events-none" />
                <span className="min-w-0 flex-1 break-words">{uppercaseDisplay(option)}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ConsultorColumnFilter({
  options,
  hiddenValues,
  onChange,
}: {
  options: ConsultorFilterOption[];
  hiddenValues: string[];
  onChange: (values: string[]) => void;
}) {
  const hidden = useMemo(() => new Set(hiddenValues), [hiddenValues]);
  const visibleCount = options.filter(option => !hidden.has(option.value)).length;
  const filtered = hiddenValues.length > 0;

  function toggle(value: string) {
    onChange(
      hidden.has(value)
        ? hiddenValues.filter(item => item !== value)
        : [...hiddenValues, value],
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-6 items-center gap-1 rounded px-1 text-[10px] uppercase tracking-[0.05em] hover:bg-muted",
            filtered ? "text-omni" : "text-muted-foreground",
          )}
          title="Filtrar Consultor nesta coluna"
        >
          <span>Consultor</span>
          <ChevronDown className="size-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="mb-2 flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
          <span>{visibleCount} de {options.length}</span>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[9px]" onClick={() => onChange([])}>
              Todos
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[9px]"
              onClick={() => onChange(options.map(option => option.value))}
            >
              Nenhum
            </Button>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-2 py-3 text-[10px] text-muted-foreground">Nenhum consultor disponível.</div>
          ) : options.map(option => {
            const active = !hidden.has(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] hover:bg-muted"
              >
                <Checkbox checked={active} tabIndex={-1} className="pointer-events-none" />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function MultiFilterSelect({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
}) {
  const summary = values.length === 0
    ? "Sem filtro"
    : options.length > 0 && values.length === options.length
      ? "Todos selecionados"
      : values.length === 1
        ? uppercaseDisplay(values[0])
        : `${values.length} selecionados`;

  function toggle(value: string) {
    onChange(
      values.includes(value)
        ? values.filter(item => item !== value)
        : [...values, value],
    );
  }

  return (
    <div className="flex w-44 flex-col items-stretch gap-0.5">
      <Label className="block text-[9px] uppercase text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-44 justify-between bg-surface-1 px-2.5 text-[10px] font-normal"
          >
            <span className="min-w-0 truncate text-left">{summary}</span>
            <ChevronDown className="ml-1.5 size-3 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[9px]"
              disabled={options.length === 0 || values.length === options.length}
              onClick={() => onChange([...options])}
            >
              <Check className="mr-1 size-3" /> Selecionar todos
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[9px]"
              disabled={values.length === 0}
              onClick={() => onChange([])}
            >
              Limpar
            </Button>
          </div>

          <div className="my-1.5 border-t border-border" />

          {options.length === 0 ? (
            <div className="px-2.5 py-3 text-xs text-muted-foreground">
              Nenhum status disponível.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto pr-1">
              {options.map(option => {
                const active = values.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => toggle(option)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10px] transition-colors hover:bg-muted",
                      active && "bg-muted/70 font-semibold",
                    )}
                  >
                    <span className="grid size-4 shrink-0 place-items-center rounded border border-border">
                      {active && <Check className="size-3" />}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{uppercaseDisplay(option)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[9px] uppercase text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-36 bg-surface-1 px-2.5 text-[10px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function maskTelefoneInput(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 9);
  if (d.length <= 8) return d.replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{5})(\d)/, "$1-$2");
}

function maskDddInput(v: string) {
  return v.replace(/\D/g, "").slice(0, 2);
}

const UFS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function NovoClienteDialog({
  onCreated,
  buttonLabel = "Nova empresa",
}: {
  onCreated: () => void;
  buttonLabel?: string;
}) {
  const { primaryRole, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [razao, setRazao] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [contato, setContato] = useState("");
  const [ddd, setDdd] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [uf, setUf] = useState("");
  const [principalNegociante, setPrincipalNegociante] = useState(true);
  const [principalAssinante, setPrincipalAssinante] = useState(true);
  const [representantesExtras, setRepresentantesExtras] = useState<Array<{
    nome: string;
    ddd: string;
    telefone: string;
    email: string;
    negociante: boolean;
    assinante: boolean;
  }>>([]);

  const limpar = () => {
    setRazao("");
    setCnpj("");
    setContato("");
    setDdd("");
    setTelefone("");
    setEmail("");
    setUf("");
    setPrincipalNegociante(true);
    setPrincipalAssinante(true);
    setRepresentantesExtras([]);
  };

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) limpar();
  };

  async function salvar() {
    const nome = razao.trim();
    if (nome.length < 2) { toast.error("Informe a razão social"); return; }
    const documento = cnpj.trim();
    if (!documento) { toast.error("Informe o CNPJ/CPF"); return; }
    const contatoTrim = contato.trim();
    if (contatoTrim.length < 2) { toast.error("Informe o nome do contato"); return; }
    const dddDigits = ddd.replace(/\D/g, "");
    if (dddDigits.length !== 2) { toast.error("Informe o DDD com 2 dígitos"); return; }
    const telDigits = telefone.replace(/\D/g, "");
    if (telDigits.length !== 8 && telDigits.length !== 9) { toast.error("Telefone deve ter 8 ou 9 dígitos"); return; }
    const emailTrim = email.trim();
    if (!emailTrim || !EMAIL_REGEX.test(emailTrim)) { toast.error("Informe um e-mail válido"); return; }
    if (!uf) { toast.error("Selecione a UF"); return; }

    const temNegociante = principalNegociante || representantesExtras.some(rep => rep.negociante);
    const temAssinante = principalAssinante || representantesExtras.some(rep => rep.assinante);
    if (!temNegociante) { toast.error("Selecione quem será o Negociante da empresa."); return; }
    if (!temAssinante) { toast.error("Selecione quem será o Assinante da empresa."); return; }

    for (let index = 0; index < representantesExtras.length; index += 1) {
      const rep = representantesExtras[index];
      const repDdd = rep.ddd.replace(/\D/g, "");
      const repTelefone = rep.telefone.replace(/\D/g, "");
      if (rep.nome.trim().length < 2) { toast.error(`Informe o nome do Representante ${index + 2}`); return; }
      if (repDdd.length !== 2) { toast.error(`Informe o DDD do Representante ${index + 2}`); return; }
      if (repTelefone.length !== 8 && repTelefone.length !== 9) { toast.error(`Telefone inválido no Representante ${index + 2}`); return; }
      if (!EMAIL_REGEX.test(rep.email.trim())) { toast.error(`Informe um e-mail válido para o Representante ${index + 2}`); return; }
    }

    if (!user) {
      toast.error("Sua sessão expirou. Entre novamente para criar a empresa.");
      return;
    }

    setSaving(true);
    try {
      const documentoEmUso = await documentoEmpresaEmUso(documento);
      if (documentoEmUso) {
        toast.error("Este CNPJ/CPF já está cadastrado em outra empresa.");
        return;
      }
    } catch (error: any) {
      toast.error("Não foi possível validar o CNPJ/CPF.", {
        description: error?.message ?? "Erro inesperado",
      });
      return;
    } finally {
      setSaving(false);
    }

    setSaving(true);
    const isConsultor = primaryRole === "consultor";
    const payload = {
      razao_social: nome,
      cnpj_cpf: documento,
      contato: contatoTrim,
      telefone: telDigits,
      email: emailTrim,
      ddd: dddDigits,
      uf,
      operadoras: [],
      consultor_id: isConsultor ? user.id : null,
      created_by: user.id,
      is_deleted: false,
      deleted_at: null,
    };
    console.debug("[NovoCliente] Criando cliente", {
      role: primaryRole,
      consultor_id: payload.consultor_id,
      razao_social: nome,
    });
    const { data, error } = await supabase
      .from("clientes")
      .insert(payload)
      .select()
      .single();

    if (error) {
      setSaving(false);
      console.error("[NovoCliente] Erro Supabase:", error);
      toast.error("Falha ao criar cliente", { description: error.message });
      return;
    }

    if (!data) {
      setSaving(false);
      console.error("[NovoCliente] Cliente não retornado após insert");
      toast.error("Erro interno ao criar cliente");
      return;
    }

    if (representantesExtras.length > 0) {
      const { error: representantesError } = await (supabase as any)
        .from("cliente_representantes")
        .insert(
          representantesExtras.map((rep, index) => ({
            cliente_id: data.id,
            nome: rep.nome.trim(),
            ddd: rep.ddd.replace(/\D/g, "") || null,
            telefone: rep.telefone.replace(/\D/g, "") || null,
            email: rep.email.trim() || null,
            principal: false,
            ordem: index + 1,
            created_by: user.id,
          })),
        );

      if (representantesError) {
        toast.warning("Empresa criada, mas algum representante adicional não foi salvo.", {
          description: representantesError.message,
        });
      } else {
        const { data: representantesSalvos } = await (supabase as any)
          .from("cliente_representantes")
          .select("id, ordem")
          .eq("cliente_id", data.id)
          .gt("ordem", 0)
          .order("ordem", { ascending: true });

        for (const [index, rep] of representantesExtras.entries()) {
          const salvo = representantesSalvos?.find((item: any) => Number(item.ordem) === index + 1);
          if (!salvo) continue;
          if (rep.negociante) {
            await (supabase as any).rpc("cliente_definir_papel_representante", {
              p_cliente_id: data.id,
              p_representante_id: salvo.id,
              p_papel: "negociante",
            });
          }
          if (rep.assinante) {
            await (supabase as any).rpc("cliente_definir_papel_representante", {
              p_cliente_id: data.id,
              p_representante_id: salvo.id,
              p_papel: "assinante",
            });
          }
        }
      }
    }

    setSaving(false);
    console.debug("[NovoCliente] Cliente criado", { cliente_id: data.id });
    toast.success("Empresa criada com sucesso.");
    setOpen(false);
    limpar();
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)] font-semibold shadow-[0_0_20px_-4px_var(--omni)]">
          <Plus className="size-4" /> {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[90dvh] w-[min(94vw,1000px)] max-w-[1000px] flex-col overflow-hidden bg-card border-border">
        <DialogHeader className="shrink-0">
          <DialogTitle>Nova empresa</DialogTitle>
          <DialogDescription>
            Cadastre os dados da empresa e seus representantes no mesmo formulário.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Razão social *</Label>
            <Input value={razao} onChange={e => setRazao(e.target.value)} placeholder="Nome / Razão social" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>CNPJ / CPF *</Label>
            <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="Digite o CNPJ/CPF" />
          </div>
          <div className="space-y-1.5">
            <Label>UF *</Label>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger className="bg-surface-1"><SelectValue placeholder="Selecione a UF" /></SelectTrigger>
              <SelectContent>
                {UFS_BRASIL.map(sigla => <SelectItem key={sigla} value={sigla}>{sigla}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 rounded-xl border border-border bg-surface-1/45 p-3">
            <div className="mb-3">
              <div className="text-xs font-semibold">Representante principal</div>
              <div className="text-[10px] text-muted-foreground">Toda empresa precisa de pelo menos um representante.</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1.5">
                <Label>Nome *</Label>
                <Input value={contato} onChange={e => setContato(e.target.value)} placeholder="Nome do representante" />
              </div>
              <div className="space-y-1.5">
                <Label>DDD *</Label>
                <Input value={ddd} onChange={e => setDdd(maskDddInput(e.target.value))} placeholder="11" maxLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone *</Label>
                <Input value={telefone} onChange={e => setTelefone(maskTelefoneInput(e.target.value))} placeholder="99999-9999" />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label>E-mail *</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="representante@empresa.com" />
              </div>

              <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setPrincipalNegociante(true);
                    setRepresentantesExtras(current => current.map(rep => ({ ...rep, negociante: false })));
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left",
                    principalNegociante ? "border-[var(--warning)]/40 bg-[var(--warning)]/10" : "border-border bg-background/30",
                  )}
                >
                  <Checkbox checked={principalNegociante} tabIndex={-1} className="pointer-events-none" />
                  <div>
                    <div className="text-[10px] font-bold">Negociante</div>
                    <div className="text-[8px] text-muted-foreground">Conduz a negociação</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPrincipalAssinante(true);
                    setRepresentantesExtras(current => current.map(rep => ({ ...rep, assinante: false })));
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left",
                    principalAssinante ? "border-purple/40 bg-purple/10" : "border-border bg-background/30",
                  )}
                >
                  <Checkbox checked={principalAssinante} tabIndex={-1} className="pointer-events-none" />
                  <div>
                    <div className="text-[10px] font-bold">Assinante</div>
                    <div className="text-[8px] text-muted-foreground">Responsável pela assinatura</div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {representantesExtras.map((rep, index) => (
            <div key={index} className="sm:col-span-2 rounded-xl border border-border bg-surface-1/35 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold">Representante {index + 2}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] text-destructive hover:text-destructive"
                  onClick={() => setRepresentantesExtras(current => current.filter((_, itemIndex) => itemIndex !== index))}
                >
                  Remover
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Nome *</Label>
                  <Input
                    value={rep.nome}
                    onChange={event => setRepresentantesExtras(current => current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, nome: event.target.value } : item
                    ))}
                    placeholder="Nome do representante"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>DDD *</Label>
                  <Input
                    value={rep.ddd}
                    onChange={event => setRepresentantesExtras(current => current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, ddd: maskDddInput(event.target.value) } : item
                    ))}
                    placeholder="11"
                    maxLength={2}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Telefone *</Label>
                  <Input
                    value={rep.telefone}
                    onChange={event => setRepresentantesExtras(current => current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, telefone: maskTelefoneInput(event.target.value) } : item
                    ))}
                    placeholder="99999-9999"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>E-mail *</Label>
                  <Input
                    type="email"
                    value={rep.email}
                    onChange={event => setRepresentantesExtras(current => current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, email: event.target.value } : item
                    ))}
                    placeholder="representante@empresa.com"
                  />
                </div>

                <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPrincipalNegociante(false);
                      setRepresentantesExtras(current => current.map((item, itemIndex) => ({
                        ...item,
                        negociante: itemIndex === index,
                      })));
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left",
                      rep.negociante ? "border-[var(--warning)]/40 bg-[var(--warning)]/10" : "border-border bg-background/30",
                    )}
                  >
                    <Checkbox checked={rep.negociante} tabIndex={-1} className="pointer-events-none" />
                    <div>
                      <div className="text-[10px] font-bold">Negociante</div>
                      <div className="text-[8px] text-muted-foreground">Conduz a negociação</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPrincipalAssinante(false);
                      setRepresentantesExtras(current => current.map((item, itemIndex) => ({
                        ...item,
                        assinante: itemIndex === index,
                      })));
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-3 py-2 text-left",
                      rep.assinante ? "border-purple/40 bg-purple/10" : "border-border bg-background/30",
                    )}
                  >
                    <Checkbox checked={rep.assinante} tabIndex={-1} className="pointer-events-none" />
                    <div>
                      <div className="text-[10px] font-bold">Assinante</div>
                      <div className="text-[8px] text-muted-foreground">Responsável pela assinatura</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ))}

          <div className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setRepresentantesExtras(current => [
                ...current,
                { nome: "", ddd: "", telefone: "", email: "", negociante: false, assinante: false },
              ])}
            >
              <Plus className="size-3.5" /> Adicionar outro representante
            </Button>
          </div>
        </div>
        </div>
        <DialogFooter className="shrink-0 border-t border-border pt-3">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)]">
            {saving ? "Criando…" : "Criar empresa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
