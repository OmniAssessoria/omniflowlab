import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRightCircle, Bell, CalendarDays, CheckCircle2, FileSignature,
  Bot, Filter, History, Info, LifeBuoy, MessageCircle, RotateCcw, Sparkles, Target, UserRound, X,
} from "lucide-react";
import { useOmni } from "@/lib/omni-store";
import { brl, getCliente, getColaborador, type FunilId, type Venda } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { useFeatures } from "@/lib/features";
import { usePipelineStructure } from "@/hooks/use-pipeline-structure";
import { useHorizontalDragScroll } from "@/hooks/use-horizontal-drag-scroll";
import {
  canConcludeCommercialOrder,
  canMoveCommercialOrder,
} from "@/lib/pipeline-movement";
import {
  firstActiveDestinationForFunnel,
  nextActiveCommercialDestination,
  type PipelineEtapa,
  type PipelineFunil,
} from "@/lib/pipeline-structure";
import { MoveVendaDialog } from "@/components/move-venda-dialog";
import { NovoSuporteDialog } from "@/components/novo-suporte-dialog";
import { getSlaState } from "@/lib/status-sla";
import { normalizedDisplayKey, uniqueNormalizedStrings, uppercaseDisplay } from "@/lib/display-normalization";
import { NovaVendaDialog } from "@/components/nova-venda-dialog";
import { SupportPipeline } from "@/components/support-pipeline";
import { buildVendaDetailUrl } from "@/lib/rotas";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNotificacoes } from "@/lib/notifications";

const FUNIL_ICONS = {
  prospeccao: Target,
  followup: MessageCircle,
  processos_bko: Sparkles,
  assinatura: FileSignature,
  suporte: LifeBuoy,
};


const PRIORIDADE_LABEL: Record<string, { label: string; cls: string }> = {
  urgente: { label: "URGENTE", cls: "bg-destructive/15 text-destructive border-destructive/30 pulse-ring" },
  alta: { label: "Alta", cls: "bg-warning/15 text-warning border-warning/30" },
  media: { label: "Média", cls: "hidden" },
  baixa: { label: "Baixa", cls: "bg-muted text-muted-foreground border-border" },
};


type PipelineDateField =
  | "QUALQUER"
  | "RECEBIMENTO"
  | "PREENCHIMENTO"
  | "ENVIO"
  | "ACEITE"
  | "INPUT"
  | "ATIVACAO"
  | "PORTABILIDADE"
  | "ENTREGA"
  | "ALTERACAO"
  | "STATUS";

type DatePresence = "TODOS" | "COM_DATA" | "SEM_DATA";
type RecentFilter = "TODOS" | "HOJE" | "24H" | "3D" | "7D" | "15D" | "30D";
type SlaFilter = "TODOS" | "ATRASADO" | "ALERTA" | "OK" | "SEM_SLA";
type MarkerFilter = "TODOS" | "COM_ERRO" | "SEM_ERRO" | "COM_BIOMETRIA" | "SEM_BIOMETRIA";

const PIPELINE_VIEW_MEMORY_KEY = "omni:pipeline-view:v1";

type PipelineViewMemory = {
  funil: FunilId;
  filtersOpen: boolean;
  dateField: PipelineDateField;
  datePresence: DatePresence;
  dateFrom: string;
  dateTo: string;
  recent: RecentFilter;
  statusComercial: string;
  statusPedido: string;
  consultor: string;
  tipoPedido: string;
  produto: string;
  sla: SlaFilter;
  markerFilter: MarkerFilter;
};

function readPipelineViewMemory(): Partial<PipelineViewMemory> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(PIPELINE_VIEW_MEMORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePipelineViewMemory(patch: Partial<PipelineViewMemory>) {
  if (typeof window === "undefined") return;
  try {
    const atual = readPipelineViewMemory();
    window.sessionStorage.setItem(
      PIPELINE_VIEW_MEMORY_KEY,
      JSON.stringify({ ...atual, ...patch }),
    );
  } catch {
    // O Pipeline continua funcionando mesmo sem sessionStorage.
  }
}

const PIPELINE_DATE_FIELDS: { value: PipelineDateField; label: string }[] = [
  { value: "QUALQUER", label: "Qualquer data do pedido" },
  { value: "RECEBIMENTO", label: "Data de recebimento" },
  { value: "PREENCHIMENTO", label: "Data de preenchimento" },
  { value: "ENVIO", label: "Data de envio" },
  { value: "ACEITE", label: "Data de aceite" },
  { value: "INPUT", label: "Data de input" },
  { value: "ATIVACAO", label: "Data de ativação" },
  { value: "PORTABILIDADE", label: "Data de portabilidade" },
  { value: "ENTREGA", label: "Data de entrega" },
  { value: "ALTERACAO", label: "Última alteração do pedido" },
  { value: "STATUS", label: "Última alteração de status" },
];

function vendaDateValues(venda: Venda, field: PipelineDateField) {
  const values: Array<string | undefined> = [];
  const anyVenda = venda as any;

  const push = (value?: string | null) => {
    if (value) values.push(value);
  };

  if (field === "QUALQUER" || field === "RECEBIMENTO") push(venda.dataRecebimento);
  if (field === "QUALQUER" || field === "PREENCHIMENTO") push(anyVenda.dataPreenchimento);
  if (field === "QUALQUER" || field === "ENVIO") push(anyVenda.dataEnvio);
  if (field === "QUALQUER" || field === "ACEITE") push(venda.dataAceite);
  if (field === "QUALQUER" || field === "INPUT") push(anyVenda.dataInput);
  if (field === "QUALQUER" || field === "ATIVACAO") push(venda.dataAtivacao);
  if (field === "QUALQUER" || field === "PORTABILIDADE") push(anyVenda.dataPortabilidade);
  if (field === "QUALQUER" || field === "ENTREGA") push(anyVenda.dataEntrega);
  if (field === "QUALQUER" || field === "ALTERACAO") push(anyVenda.atualizadoEm);
  if (field === "QUALQUER" || field === "STATUS") {
    push(anyVenda.statusComercialEm);
    push(anyVenda.statusPedidoEm);
  }

  return values;
}

function isCreatedAtWithinRange(
  createdAt: string | undefined,
  dateFrom: string,
  dateTo: string,
) {
  if (!dateFrom && !dateTo) return true;
  if (!createdAt) return false;

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  if (dateFrom) {
    const start = new Date(`${dateFrom}T00:00:00`);
    if (created.getTime() < start.getTime()) return false;
  }

  if (dateTo) {
    const end = new Date(`${dateTo}T23:59:59.999`);
    if (created.getTime() > end.getTime()) return false;
  }

  return true;
}

function isWithinRecent(value: string | undefined, recent: RecentFilter) {
  if (!value || recent === "TODOS") return recent === "TODOS";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();

  if (recent === "HOJE") {
    return date.toDateString() === now.toDateString();
  }

  const days = recent === "24H" ? 1 : recent === "3D" ? 3 : recent === "7D" ? 7 : recent === "15D" ? 15 : 30;
  return now.getTime() - date.getTime() <= days * 24 * 60 * 60 * 1000 && date.getTime() <= now.getTime();
}

function getStatusComercialAtual(venda: Venda) {
  const manualNome = String(venda.statusComercialNome ?? "").trim();
  const roboNome = String(venda.statusPedidoRoboNome ?? venda.statusPedido ?? "").trim();

  const manualTime = venda.statusComercialEm
    ? new Date(venda.statusComercialEm).getTime()
    : Number.NEGATIVE_INFINITY;

  // status_pedido_em também pode ser tocado por edições humanas de outros campos.
  // Para decidir qual STATUS é o mais recente, usamos o timestamp real do log do robô.
  const roboEventoEm = venda.statusPedidoRoboEm
    ?? (!venda.statusPedidoUserNome ? venda.statusPedidoEm : undefined);
  const roboTime = roboEventoEm
    ? new Date(roboEventoEm).getTime()
    : Number.NEGATIVE_INFINITY;

  if (manualNome && roboNome) {
    const roboMaisRecente = Number.isFinite(roboTime)
      && (!Number.isFinite(manualTime) || roboTime >= manualTime);

    return roboMaisRecente
      ? { nome: roboNome, origem: "robo" as const, em: roboEventoEm }
      : { nome: manualNome, origem: "manual" as const, em: venda.statusComercialEm };
  }

  if (manualNome) {
    return { nome: manualNome, origem: "manual" as const, em: venda.statusComercialEm };
  }

  if (roboNome) {
    return { nome: roboNome, origem: "robo" as const, em: roboEventoEm };
  }

  return { nome: "", origem: null, em: undefined };
}

function isVendaConcluidaGanha(venda: Venda) {
  if (!venda.concluidoEm) return false;
  const atual = getStatusComercialAtual(venda).nome
    .toLocaleUpperCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return !atual.includes("CANCELAD") && !atual.includes("REPROVAD");
}

export function CommercialPipelinePage({ initialFunil }: { initialFunil?: FunilId } = {}) {
  const { vendas, vendasPipeline, ambiente } = useOmni();
  const { primaryRole, roles } = useAuth();
  // Para ações operacionais no Kanban, Admin/BKO têm precedência sobre perfis acumulados.
  // Isso evita a interface assumir "consultor" em contas que também possuem papel operacional amplo.
  const movementRole = roles.includes("admin")
    ? "admin"
    : roles.includes("bko")
      ? "bko"
      : primaryRole;
  const { comissoesVisible } = useFeatures();
  const { items: notificacoesPedido } = useNotificacoes(500);
  const { funis, etapas, loading } = usePipelineStructure();
  const initialView = useMemo(() => readPipelineViewMemory(), []);
  const [funil, setFunil] = useState<FunilId>(initialFunil ?? initialView.funil ?? "prospeccao");
  const [supportCount, setSupportCount] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(initialView.filtersOpen ?? false);
  const [dateField, setDateField] = useState<PipelineDateField>(initialView.dateField ?? "QUALQUER");
  const [datePresence, setDatePresence] = useState<DatePresence>(initialView.datePresence ?? "TODOS");
  const [dateFrom, setDateFrom] = useState(initialView.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(initialView.dateTo ?? "");
  const [recent, setRecent] = useState<RecentFilter>(initialView.recent ?? "TODOS");
  const [statusComercial, setStatusComercial] = useState(initialView.statusComercial ?? "TODOS");
  const [statusPedido, setStatusPedido] = useState(initialView.statusPedido ?? "TODOS");
  const [consultor, setConsultor] = useState(initialView.consultor ?? "TODOS");
  const [tipoPedido, setTipoPedido] = useState(initialView.tipoPedido ?? "TODOS");
  const [produto, setProduto] = useState(initialView.produto ?? "TODOS");
  const [sla, setSla] = useState<SlaFilter>(initialView.sla ?? "TODOS");
  const [markerFilter, setMarkerFilter] = useState<MarkerFilter>(initialView.markerFilter ?? "TODOS");

  useEffect(() => {
    if (!initialFunil) return;
    writePipelineViewMemory({ funil: initialFunil });
    setFunil(initialFunil);
  }, [initialFunil]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const snapshot: PipelineViewMemory = {
        funil,
        filtersOpen,
        dateField,
        datePresence,
        dateFrom,
        dateTo,
        recent,
        statusComercial,
        statusPedido,
        consultor,
        tipoPedido,
        produto,
        sla,
        markerFilter,
      };
      window.sessionStorage.setItem(PIPELINE_VIEW_MEMORY_KEY, JSON.stringify(snapshot));
    } catch {
      // Se o storage estiver indisponível, o Pipeline continua funcionando normalmente.
    }
  }, [
    funil, filtersOpen, dateField, datePresence, dateFrom, dateTo, recent,
    statusComercial, statusPedido, consultor, tipoPedido, produto, sla, markerFilter,
  ]);

  const vendasComAlteracaoPendente = useMemo(
    () => new Set(
      notificacoesPedido
        .filter(item =>
          !item.lida
          && item.tipo === "pedido_alterado"
          && Boolean(item.venda_id)
          && (item.actor_role === "consultor" || item.actor_role === "gestor")
        )
        .map(item => item.venda_id as string),
    ),
    [notificacoesPedido],
  );

  const statusComerciais = useMemo(
    () => uniqueNormalizedStrings(vendasPipeline.map(venda => getStatusComercialAtual(venda).nome)),
    [vendasPipeline],
  );
  const statusPedidos = useMemo(
    () => uniqueNormalizedStrings(vendasPipeline.map(venda => venda.statusPedido)),
    [vendasPipeline],
  );
  const consultores = useMemo(
    () => uniqueNormalizedStrings(vendasPipeline.map(venda => venda.consultorNome)),
    [vendasPipeline],
  );
  const tiposPedido = useMemo(
    () => Array.from(new Set(
      vendasPipeline.flatMap(v => v.tipoPedidos?.length ? v.tipoPedidos : (v.tipoPedido ? [v.tipoPedido] : [])),
    )).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [vendasPipeline],
  );
  const produtos = useMemo(
    () => Array.from(new Set(
      vendasPipeline.flatMap(v => v.produtos?.length ? v.produtos : (v.produto ? [v.produto] : [])),
    )).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [vendasPipeline],
  );

  const filteredPipeline = useMemo(() => {
    return vendasPipeline.filter(venda => {
      if (statusComercial !== "TODOS" && normalizedDisplayKey(getStatusComercialAtual(venda).nome) !== normalizedDisplayKey(statusComercial)) return false;
      if (statusPedido !== "TODOS" && normalizedDisplayKey(venda.statusPedido) !== normalizedDisplayKey(statusPedido)) return false;
      if (consultor !== "TODOS" && normalizedDisplayKey(venda.consultorNome) !== normalizedDisplayKey(consultor)) return false;
      const vendaTipos = venda.tipoPedidos?.length ? venda.tipoPedidos : (venda.tipoPedido ? [venda.tipoPedido] : []);
      const vendaProdutos = venda.produtos?.length ? venda.produtos : (venda.produto ? [venda.produto] : []);
      if (tipoPedido !== "TODOS" && !vendaTipos.includes(tipoPedido)) return false;
      if (produto !== "TODOS" && !vendaProdutos.includes(produto)) return false;

      const selectedDates = vendaDateValues(venda, dateField);
      if (datePresence === "COM_DATA" && selectedDates.length === 0) return false;
      if (datePresence === "SEM_DATA" && selectedDates.length > 0) return false;

      // O período do Pipeline é definido exclusivamente pela criação da venda/card.
      if (!isCreatedAtWithinRange(venda.criadoEm, dateFrom, dateTo)) return false;

      if (recent !== "TODOS" && !isWithinRecent((venda as any).atualizadoEm, recent)) return false;

      const slaState = getSlaState({ startedAt: venda.statusComercialEm, slaHours: venda.slaHorasAtual });
      if (sla === "ATRASADO" && slaState !== "vermelho") return false;
      if (sla === "ALERTA" && slaState !== "laranja") return false;
      if (sla === "OK" && slaState !== "verde") return false;
      if (sla === "SEM_SLA" && slaState !== "sem_sla") return false;

      if (markerFilter === "COM_ERRO" && !venda.temErro) return false;
      if (markerFilter === "SEM_ERRO" && venda.temErro) return false;
      if (markerFilter === "COM_BIOMETRIA" && !venda.temBiometria) return false;
      if (markerFilter === "SEM_BIOMETRIA" && venda.temBiometria) return false;

      return true;
    });
  }, [
    vendasPipeline, statusComercial, statusPedido, consultor, tipoPedido, produto,
    dateField, datePresence, dateFrom, dateTo, recent, sla, markerFilter,
  ]);

  const activeFilterCount = useMemo(() => [
    dateField !== "QUALQUER",
    datePresence !== "TODOS",
    Boolean(dateFrom),
    Boolean(dateTo),
    recent !== "TODOS",
    statusComercial !== "TODOS",
    statusPedido !== "TODOS",
    consultor !== "TODOS",
    tipoPedido !== "TODOS",
    produto !== "TODOS",
    sla !== "TODOS",
    markerFilter !== "TODOS",
  ].filter(Boolean).length, [
    dateField, datePresence, dateFrom, dateTo, recent, statusComercial,
    statusPedido, consultor, tipoPedido, produto, sla, markerFilter,
  ]);

  const clearFilters = () => {
    setDateField("QUALQUER");
    setDatePresence("TODOS");
    setDateFrom("");
    setDateTo("");
    setRecent("TODOS");
    setStatusComercial("TODOS");
    setStatusPedido("TODOS");
    setConsultor("TODOS");
    setTipoPedido("TODOS");
    setProduto("TODOS");
    setSla("TODOS");
    setMarkerFilter("TODOS");
  };

  const activeFunis = useMemo(
    () => funis.filter(item => item.ativo).sort((a, b) => a.ordem - b.ordem),
    [funis],
  );
  const visibleCommercialFunilIds = useMemo(
    () => activeFunis.filter(item => item.participa_fluxo_comercial).map(item => item.id),
    [activeFunis],
  );
  const completedVendas = useMemo(
    () => vendas
      .filter(venda =>
        isVendaConcluidaGanha(venda)
        && !(venda as any).somenteAparelho
        && (ambiente === "GERAL" || venda.operadora === ambiente)
      )
      .sort((a, b) => {
        const aTime = a.concluidoEm ? new Date(a.concluidoEm).getTime() : 0;
        const bTime = b.concluidoEm ? new Date(b.concluidoEm).getTime() : 0;
        return bTime - aTime;
      }),
    [vendas, ambiente],
  );
  useEffect(() => {
    if (loading) return;
    if (!activeFunis.some(item => item.id === funil) && activeFunis[0]) {
      setFunil(activeFunis[0].id as FunilId);
    }
  }, [activeFunis, funil, loading]);

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of funis) {
      result[item.id] = item.id === "suporte"
        ? supportCount
        : filteredPipeline.filter(venda => venda.funil === item.id).length;
    }
    return result;
  }, [funis, supportCount, filteredPipeline]);

  const valorFunilAtual = useMemo(
    () => filteredPipeline
      .filter(venda => venda.funil === funil)
      .reduce((total, venda) => total + Number(venda.receita || 0), 0),
    [filteredPipeline, funil],
  );

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando estrutura do pipeline…</div>;
  if (!activeFunis.length) {
    return <div className="p-6 rounded-xl border border-warning/40 bg-warning/5 text-sm">Nenhum funil ativo. Ative a estrutura em Configurações → Estrutura.</div>;
  }

  return (
    <div className="omni-pipeline-page p-2 sm:p-2.5 space-y-2">
      <section className="rounded-xl border border-border bg-card/75 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant={filtersOpen ? "default" : "outline"}
            size="sm"
            className={cn("h-7 gap-1.5 px-2 text-[10px]", filtersOpen && "bg-[var(--omni)] text-black hover:bg-[var(--omni)]/90")}
            onClick={() => setFiltersOpen(open => !open)}
          >
            <Filter className="size-3.5" />
            Filtros do Pipe
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[9px] font-black">{activeFilterCount}</span>
            )}
          </Button>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant={recent === "HOJE" ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2 text-[9px]"
              onClick={() => setRecent(recent === "HOJE" ? "TODOS" : "HOJE")}
            >
              <History className="size-3" /> Alterados hoje
            </Button>
            <Button
              type="button"
              variant={recent === "7D" ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2 text-[9px]"
              onClick={() => setRecent(recent === "7D" ? "TODOS" : "7D")}
            >
              <History className="size-3" /> Últimos 7 dias
            </Button>
            <Button
              type="button"
              variant={dateField === "ACEITE" && datePresence === "COM_DATA" ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2 text-[9px]"
              onClick={() => {
                setDateField("ACEITE");
                setDatePresence("COM_DATA");
                setDateFrom("");
                setDateTo("");
              }}
            >
              <CalendarDays className="size-3" /> Com aceite
            </Button>
            <Button
              type="button"
              variant={dateField === "ACEITE" && datePresence === "SEM_DATA" ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2 text-[9px]"
              onClick={() => {
                setDateField("ACEITE");
                setDatePresence("SEM_DATA");
                setDateFrom("");
                setDateTo("");
              }}
            >
              <CalendarDays className="size-3" /> Sem aceite
            </Button>
          </div>

          {activeFilterCount > 0 && (
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[9px]" onClick={clearFilters}>
              <RotateCcw className="size-3" /> Limpar
            </Button>
          )}
          </div>

          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            <div className="hidden text-[10px] text-muted-foreground xl:block">
              Exibindo <span className="font-bold text-foreground">{filteredPipeline.length}</span> de {vendasPipeline.length}
            </div>
            <NovoSuporteDialog />
            {["admin", "gestor", "consultor", "bko"].includes(primaryRole ?? "") && <NovaVendaDialog />}
          </div>
        </div>

        {filtersOpen && (
          <div className="border-t border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <FilterField label="Data do pedido">
                <Select value={dateField} onValueChange={value => setDateField(value as PipelineDateField)}>
                  <SelectTrigger className="h-9 bg-surface-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIPELINE_DATE_FIELDS.map(item => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Situação da data">
                <Select value={datePresence} onValueChange={value => setDatePresence(value as DatePresence)}>
                  <SelectTrigger className="h-9 bg-surface-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Com ou sem data</SelectItem>
                    <SelectItem value="COM_DATA">Somente com data</SelectItem>
                    <SelectItem value="SEM_DATA">Somente sem data</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Data inicial">
                <Input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="h-9 bg-surface-1" />
              </FilterField>

              <FilterField label="Data final">
                <Input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="h-9 bg-surface-1" />
              </FilterField>

              <FilterField label="Alteração recente">
                <Select value={recent} onValueChange={value => setRecent(value as RecentFilter)}>
                  <SelectTrigger className="h-9 bg-surface-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Qualquer alteração</SelectItem>
                    <SelectItem value="HOJE">Alterado hoje</SelectItem>
                    <SelectItem value="24H">Últimas 24 horas</SelectItem>
                    <SelectItem value="3D">Últimos 3 dias</SelectItem>
                    <SelectItem value="7D">Últimos 7 dias</SelectItem>
                    <SelectItem value="15D">Últimos 15 dias</SelectItem>
                    <SelectItem value="30D">Últimos 30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Status comercial">
                <Select value={statusComercial} onValueChange={setStatusComercial}>
                  <SelectTrigger className="h-9 bg-surface-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os status</SelectItem>
                    {statusComerciais.map(value => <SelectItem key={normalizedDisplayKey(value)} value={value}>{uppercaseDisplay(value)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Status do pedido">
                <Select value={statusPedido} onValueChange={setStatusPedido}>
                  <SelectTrigger className="h-9 bg-surface-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    {statusPedidos.map(value => <SelectItem key={normalizedDisplayKey(value)} value={value}>{uppercaseDisplay(value)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Consultor">
                <Select value={consultor} onValueChange={setConsultor}>
                  <SelectTrigger className="h-9 bg-surface-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os consultores</SelectItem>
                    {consultores.map(value => <SelectItem key={normalizedDisplayKey(value)} value={value}>{uppercaseDisplay(value)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Tipo de pedido">
                <Select value={tipoPedido} onValueChange={setTipoPedido}>
                  <SelectTrigger className="h-9 bg-surface-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os tipos</SelectItem>
                    {tiposPedido.map(value => <SelectItem key={value} value={value}>{uppercaseDisplay(value)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Produto">
                <Select value={produto} onValueChange={setProduto}>
                  <SelectTrigger className="h-9 bg-surface-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os produtos</SelectItem>
                    {produtos.map(value => <SelectItem key={value} value={value}>{uppercaseDisplay(value)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="SLA">
                <Select value={sla} onValueChange={value => setSla(value as SlaFilter)}>
                  <SelectTrigger className="h-9 bg-surface-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os SLAs</SelectItem>
                    <SelectItem value="ATRASADO">SLA vencido</SelectItem>
                    <SelectItem value="ALERTA">SLA em alerta</SelectItem>
                    <SelectItem value="OK">SLA dentro do prazo</SelectItem>
                    <SelectItem value="SEM_SLA">Sem SLA</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>

              <FilterField label="Ocorrência">
                <Select value={markerFilter} onValueChange={value => setMarkerFilter(value as MarkerFilter)}>
                  <SelectTrigger className="h-9 bg-surface-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os pedidos</SelectItem>
                    <SelectItem value="COM_ERRO">Com erro</SelectItem>
                    <SelectItem value="SEM_ERRO">Sem erro</SelectItem>
                    <SelectItem value="COM_BIOMETRIA">Com biometria</SelectItem>
                    <SelectItem value="SEM_BIOMETRIA">Sem biometria</SelectItem>
                  </SelectContent>
                </Select>
              </FilterField>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtros rápidos de data:</span>
              {[
                ["RECEBIMENTO", "Recebimento"],
                ["ENVIO", "Envio"],
                ["ACEITE", "Aceite"],
                ["INPUT", "Input"],
                ["ATIVACAO", "Ativação"],
                ["PORTABILIDADE", "Portabilidade"],
                ["ENTREGA", "Entrega"],
                ["STATUS", "Status"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDateField(value as PipelineDateField)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                    dateField === value
                      ? "border-omni/40 bg-omni/10 text-omni"
                      : "border-border text-muted-foreground hover:bg-surface-1 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <Tabs
        value={funil}
        onValueChange={value => {
          const nextFunil = value as FunilId;
          writePipelineViewMemory({ funil: nextFunil });
          setFunil(nextFunil);
        }}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <TabsList className="bg-surface-1 border border-border h-auto p-0.5 rounded-lg">
            {activeFunis.map(item => {
              const Icon = FUNIL_ICONS[item.id as keyof typeof FUNIL_ICONS];
              return (
                <TabsTrigger key={item.id} value={item.id} className="gap-1 data-[state=active]:bg-[var(--omni)] data-[state=active]:text-black px-2.5 py-1 text-[10px]">
                  <Icon className="size-3" />
                  <span className="font-semibold">{uppercaseDisplay(item.nome)}</span>
                  <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-black/20 font-mono">{counts[item.id] ?? 0}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {funil !== "suporte" && (
            <div className="ml-auto shrink-0 px-0.5 text-right">
              <span className="font-mono text-sm font-black tabular-nums text-success">
                {brl(valorFunilAtual)}
              </span>
            </div>
          )}
        </div>

        {activeFunis.map(item => (
          <TabsContent key={item.id} value={item.id} className="mt-1.5">
            {item.id === "suporte" ? (
              <SupportPipeline onCountChange={setSupportCount} />
            ) : (
              <CommercialFunnel
                funil={item}
                etapas={etapas
                  .filter(stage => stage.funil_id === item.id && stage.ativo)
                  .sort((a, b) =>
                    (a.ordem_exibicao ?? a.ordem) - (b.ordem_exibicao ?? b.ordem)
                    || a.ordem - b.ordem,
                  )}
                vendas={filteredPipeline.filter(venda => venda.funil === item.id)}
                completedVendas={item.id === "assinatura" ? completedVendas : []}
                primaryRole={movementRole}
                allFunis={funis}
                allEtapas={etapas}
                visibleCommercialFunilIds={visibleCommercialFunilIds}
                comissoesVisible={comissoesVisible}
                unreadChangedVendaIds={vendasComAlteracaoPendente}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function CommercialFunnel({
  funil,
  etapas,
  vendas,
  completedVendas,
  primaryRole,
  allFunis,
  allEtapas,
  visibleCommercialFunilIds,
  comissoesVisible,
  unreadChangedVendaIds,
}: {
  funil: PipelineFunil;
  etapas: PipelineEtapa[];
  vendas: Venda[];
  completedVendas: Venda[];
  primaryRole: string | null;
  allFunis: PipelineFunil[];
  allEtapas: PipelineEtapa[];
  visibleCommercialFunilIds: string[];
  comissoesVisible: boolean;
  unreadChangedVendaIds: Set<string>;
}) {
  const horizontalDrag = useHorizontalDragScroll();

  return (
    <div
      {...horizontalDrag.bind}
      className={cn(
        "omni-kanban-scroll overflow-x-auto pb-3 -mx-2.5 sm:-mx-3 px-2.5 sm:px-3 cursor-grab",
        horizontalDrag.dragging && "cursor-grabbing select-none",
      )}
      title="Segure e arraste o fundo do Kanban para navegar horizontalmente"
    >
      <div className="flex gap-1.5 min-w-min">
        {etapas.map(stage => {
          const cards = vendas.filter(venda => venda.etapaId === stage.id);
          const valorEtapa = cards.reduce((total, venda) => total + Number(venda.receita || 0), 0);
          return (
            <div key={stage.id} className="omni-kanban-column w-[200px] shrink-0 rounded-lg bg-surface-1 border border-border flex flex-col h-[clamp(400px,calc(100dvh-210px),960px)] max-h-[calc(100dvh-210px)] min-h-0">
              <div className="omni-kanban-column-header px-2 py-1.5 border-b border-border sticky top-0 z-10 bg-surface-1 rounded-t-lg">
                <div className="flex min-w-0 items-start gap-2">
                  <span className={cn("omni-kanban-stage-dot mt-1 size-2 shrink-0 rounded-full", `bg-[var(--${stage.cor})]`)} />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-bold uppercase tracking-[0.05em]" title={uppercaseDisplay(stage.nome)}>{uppercaseDisplay(stage.nome)}</div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-mono">
                      <span className="text-muted-foreground">
                        {cards.length} {cards.length === 1 ? "lead" : "leads"}
                      </span>
                      <span className="whitespace-nowrap font-bold text-foreground/80">
                        {brl(valorEtapa)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-1.5 space-y-1 overflow-y-auto overscroll-contain flex-1 min-h-0">
                {cards.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border/50 rounded-lg">sem cards</div>
                )}
                {cards.map(venda => (
                  <CommercialCard
                    key={venda.id}
                    venda={venda}
                    primaryRole={primaryRole}
                    funis={allFunis}
                    etapas={allEtapas}
                    visibleCommercialFunilIds={visibleCommercialFunilIds}
                    hasUnreadChange={unreadChangedVendaIds.has(venda.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {funil.id === "assinatura" && (
          <div className="omni-kanban-column w-[210px] shrink-0 rounded-lg border border-success/30 bg-success/5 flex flex-col h-[clamp(400px,calc(100dvh-210px),960px)] max-h-[calc(100dvh-210px)] min-h-0">
            <div className="px-2.5 py-2 border-b border-success/20 flex items-center justify-between gap-2 sticky top-0 z-10 bg-surface-1/95 rounded-t-lg">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 className="size-4 shrink-0 text-success" />
                <span className="font-semibold text-xs uppercase tracking-wider">Concluído</span>
                <TooltipProvider delayDuration={180}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-success/70 hover:text-success" aria-label="Sobre pedidos concluídos">
                        <Info className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[300px] text-xs leading-relaxed">
                      Pedidos concluídos saem do Pipeline ativo e permanecem disponíveis em Meus Pedidos. Esta coluna exibe apenas o total.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-success/10 text-success">{completedVendas.length}</span>
            </div>

            <div className="p-1.5 space-y-1 overflow-y-auto overscroll-contain flex-1 min-h-0">
              {completedVendas.length === 0 && (
                <div className="py-8 text-center text-xs text-success/60 italic border border-dashed border-success/20 rounded-lg">
                  sem cards concluídos
                </div>
              )}
              {completedVendas.map(venda => (
                <CompletedCommercialCard
                  key={venda.id}
                  venda={venda}
                  comissoesVisible={comissoesVisible}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CompletedCommercialCard({
  venda,
  comissoesVisible,
}: {
  venda: Venda;
  comissoesVisible: boolean;
}) {
  const navigate = useNavigate();
  const cliente = getCliente(venda.clienteId);
  const statusAtual = getStatusComercialAtual(venda).nome;
  const tipos = venda.tipoPedidos?.length ? venda.tipoPedidos : (venda.tipoPedido ? [venda.tipoPedido] : []);
  const primeiroTipo = tipos[0] ?? "Sem tipo";
  const tiposRestantes = tipos.slice(1);
  const concluidoLabel = venda.concluidoEm
    ? new Date(venda.concluidoEm).toLocaleDateString("pt-BR")
    : "Concluído";

  return (
    <button
      type="button"
      onClick={() => navigate({ ...buildVendaDetailUrl(venda.id), search: { suporte: undefined, etapaSuporte: undefined } })}
      className="omni-pipeline-card group block w-full rounded-lg border border-success/15 bg-black/20 p-2 text-left opacity-70 saturate-50 transition-all hover:opacity-95 hover:saturate-75 hover:border-success/30"
      title="Abrir pedido concluído"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-bold text-foreground/85">
            {uppercaseDisplay(venda.clienteRazaoSocial || cliente?.razaoSocial || venda.clienteCnpj, "CLIENTE NÃO VINCULADO")}
          </div>
        </div>
        <span className="shrink-0 text-[8px] font-mono text-success/70">{concluidoLabel}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {(venda.operadora === "CLARO" || venda.operadora === "VIVO") && (
          <span className="inline-flex h-5 items-center rounded-md border border-border/50 bg-black/20 px-1.5">
            <BrandLogo
              brand={venda.operadora}
              className={venda.operadora === "CLARO" ? "h-4 w-7" : "h-3 w-10"}
              imageClassName="h-full w-full object-contain opacity-70"
            />
          </span>
        )}
        <Badge variant="outline" className="h-3.5 max-w-[112px] border-success/15 px-1 py-0 text-[8px] text-muted-foreground" title={uppercaseDisplay(primeiroTipo)}>
          <span className="truncate">{uppercaseDisplay(primeiroTipo)}</span>
        </Badge>
        {tiposRestantes.length > 0 && (
          <span
            className="inline-flex h-3.5 min-w-4 items-center justify-center rounded-full border border-success/15 px-1 text-[7px] font-bold text-muted-foreground"
            title={tiposRestantes.map(tipo => uppercaseDisplay(tipo)).join(" · ")}
          >
            +{tiposRestantes.length}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between border-t border-success/10 pt-1">
        <span className="truncate text-[8px] text-muted-foreground/75">{uppercaseDisplay(statusAtual, "CONCLUÍDO")}</span>
        {comissoesVisible && <span className="text-[9px] font-semibold text-success/65">{brl(venda.receita)}</span>}
      </div>
    </button>
  );
}

function CommercialCard({
  venda,
  primaryRole,
  funis,
  etapas,
  visibleCommercialFunilIds,
  hasUnreadChange,
}: {
  venda: Venda;
  primaryRole: string | null;
  funis: PipelineFunil[];
  etapas: PipelineEtapa[];
  visibleCommercialFunilIds: string[];
  hasUnreadChange: boolean;
}) {
  const navigate = useNavigate();
  const { moveVenda, concluirVenda } = useOmni();
  const [shortcut, setShortcut] = useState<null | "virar" | "assinar">(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const cliente = getCliente(venda.clienteId);
  const consultorMock = getColaborador(venda.consultorId);
  const consultorNome = venda.consultorNome || consultorMock?.nome || "—";
  const prio = PRIORIDADE_LABEL[venda.prioridade];
  const operadoraValida = venda.operadora === "CLARO" || venda.operadora === "VIVO";
  const tiposPedidoCard = venda.tipoPedidos?.length ? venda.tipoPedidos : (venda.tipoPedido ? [venda.tipoPedido] : ["Sem tipo"]);
  const primeiroTipoPedido = tiposPedidoCard[0] ?? "Sem tipo";
  const tiposPedidoRestantes = tiposPedidoCard.slice(1);
  const operadoraCor = venda.operadora === "CLARO"
    ? "claro"
    : venda.operadora === "VIVO"
      ? "vivo"
      : "omni";
  const canMove = canMoveCommercialOrder(primaryRole);
  const canFinish = canConcludeCommercialOrder(primaryRole, venda.etapaId, venda.concluidoEm);
  const currentFunil = funis.find(item => item.id === venda.funil);
  const currentEtapa = etapas.find(item => item.id === venda.etapaId);

  const virarDestino = useMemo(
    () => venda.etapaId === "p-proposta" ? nextActiveCommercialDestination(venda.funil, funis, etapas) : null,
    [venda.etapaId, venda.funil, funis, etapas],
  );
  const assinaturaDestino = useMemo(
    () => venda.etapaId === "f-contrato" ? firstActiveDestinationForFunnel("assinatura", funis, etapas) : null,
    [venda.etapaId, funis, etapas],
  );
  const quickDestination = shortcut === "virar" ? virarDestino : shortcut === "assinar" ? assinaturaDestino : null;
  const quickDestinationLabel = quickDestination
    ? `${funis.find(item => item.id === quickDestination.funilId)?.nome ?? quickDestination.funilId} → ${etapas.find(item => item.id === quickDestination.etapaId)?.nome ?? quickDestination.etapaId}`
    : "nenhum destino ativo";

  function openDetail() {
    writePipelineViewMemory({ funil: venda.funil as FunilId });
    navigate({ ...buildVendaDetailUrl(venda.id), search: { suporte: undefined, etapaSuporte: undefined } });
  }

  async function executeShortcut() {
    if (!quickDestination || working) return;
    setWorking(true);
    try {
      const moved = await moveVenda(venda.id, quickDestination.etapaId);
      if (moved) setShortcut(null);
    } finally {
      setWorking(false);
    }
  }

  async function finishOrder() {
    if (working) return;
    setWorking(true);
    try {
      const done = await concluirVenda(venda.id);
      if (done) setFinishOpen(false);
    } finally {
      setWorking(false);
    }
  }

  const statusAtual = getStatusComercialAtual(venda);
  const statusAtualNome = statusAtual.nome;
  const statusAtualOrigem = statusAtual.origem;

  const slaVisual = getSlaState({ startedAt: venda.statusComercialEm, slaHours: venda.slaHorasAtual });
  const slaAtrasado = slaVisual === "vermelho";
  const slaAlerta = slaVisual === "laranja";

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={event => {
          const target = event.target as Element | null;
          if (!target?.closest(".omni-pipeline-card")) return;
          openDetail();
        }}
        onKeyDown={event => { if (event.key === "Enter") openDetail(); }}
        className={cn(
          "omni-pipeline-card group block rounded-lg bg-card border border-border p-2 cursor-pointer",
          "hover:border-[var(--omni)]/40 hover:shadow-[0_8px_24px_-12px_var(--omni)] transition-all relative overflow-hidden",
          slaAtrasado && "border-destructive/50",
          !slaAtrasado && slaAlerta && "border-warning/40",
        )}
      >
        <span className={cn("absolute left-0 top-0 bottom-0 w-1", `bg-[var(--${operadoraCor})]`)} />
        {hasUnreadChange && (
          <span
            className="absolute right-1.5 top-1.5 z-20 grid size-5 place-items-center rounded-full border border-yellow-400/50 bg-yellow-400/15 text-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.35)]"
            title="Pedido alterado · há uma notificação não lida"
            aria-label="Pedido com alteração não lida"
          >
            <Bell className="size-3" />
          </span>
        )}
        <div className={cn("flex items-start justify-between gap-1.5 mb-1 pl-0.5", hasUnreadChange && "pr-6")}>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-bold">{uppercaseDisplay(venda.clienteRazaoSocial || cliente?.razaoSocial || venda.clienteCnpj, "CLIENTE NÃO VINCULADO")}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 mb-1.5 pl-0.5">
          <span
            className={cn(
              "inline-flex h-5.5 items-center rounded-md border bg-white/[0.025] px-1.5 shadow-sm",
              venda.operadora === "CLARO"
                ? "border-[var(--claro)]/25"
                : venda.operadora === "VIVO"
                  ? "border-[var(--vivo)]/25"
                  : "border-border",
            )}
          >
            {operadoraValida ? (
              <BrandLogo
                brand={venda.operadora}
                className={venda.operadora === "CLARO" ? "h-4 w-7" : "h-3 w-10"}
                imageClassName="h-full w-full object-contain"
              />
            ) : (
              <span className="text-[8px] font-semibold text-muted-foreground">
                {venda.operadora || "Sem operadora"}
              </span>
            )}
          </span>
          <Badge
            variant="outline"
            className="h-3.5 max-w-[118px] px-1 py-0 text-[8px] border-border text-muted-foreground"
            title={uppercaseDisplay(primeiroTipoPedido)}
          >
            <span className="truncate">{uppercaseDisplay(primeiroTipoPedido)}</span>
          </Badge>
          {tiposPedidoRestantes.length > 0 && (
            <span
              className="inline-flex h-3.5 min-w-4 items-center justify-center rounded-full border border-border px-1 text-[7px] font-bold text-muted-foreground"
              title={tiposPedidoRestantes.map(tipo => uppercaseDisplay(tipo)).join(" · ")}
            >
              +{tiposPedidoRestantes.length}
            </span>
          )}
        </div>

        {statusAtualNome && (
          <div
            className="mb-1.5 flex h-5 min-w-0 items-center justify-center gap-1 rounded-md bg-purple/[0.14] px-2 text-center text-[7.5px] font-semibold text-foreground"
            title={`${statusAtualNome} · ${statusAtualOrigem === "robo" ? "Robô OMNI" : "Atualização manual"}`}
          >
            {statusAtualOrigem === "robo" && <Bot className="size-2.5 shrink-0 text-purple" />}
            {statusAtualOrigem === "manual" && <UserRound className="size-2.5 shrink-0 text-purple" />}
            <span className="min-w-0 truncate">{uppercaseDisplay(statusAtualNome)}</span>
          </div>
        )}

        <div className="mb-1.5 flex min-h-4 items-center justify-between gap-2 pl-0.5 pr-0.5">
          <span className="whitespace-nowrap text-[9px] font-semibold text-muted-foreground">
            Linhas <span className="font-mono text-foreground">{venda.quantidadeLinhas}</span>
          </span>
          <span className="max-w-[96px] truncate text-right text-[9px] font-bold tabular-nums text-foreground/70" title={brl(venda.receita)}>
            {brl(venda.receita)}
          </span>
        </div>

        {venda.temErro && (
          <div className="pl-1 mb-1.5 flex flex-wrap gap-1">
            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold bg-destructive/15 text-destructive border-destructive/40">Erro em aberto</span>
          </div>
        )}

        <div className="flex items-center pt-1 border-t border-border/60 pl-0.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full bg-[var(--omni)]" title="Consultor" />
            <span className="max-w-[80px] truncate text-[8px] text-muted-foreground" title={uppercaseDisplay(consultorNome)}>{uppercaseDisplay(consultorNome)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1.5 mt-1 pl-0.5" onClick={event => event.stopPropagation()}>
          <div>{prio && venda.prioridade !== "media" && <span className={cn("text-[9px] px-1.5 py-0.5 rounded border uppercase font-bold", prio.cls)}>{prio.label}</span>}</div>
          <div className="flex flex-wrap justify-end items-center gap-1">
            {canMove && venda.etapaId === "p-proposta" && virarDestino && (
              <Button variant="outline" size="sm" className="h-6 px-1.5 gap-1 text-[9px] text-success" onClick={() => setShortcut("virar")}><ArrowRightCircle className="size-3" /> Virar</Button>
            )}
            {canMove && venda.etapaId === "f-contrato" && assinaturaDestino && (
              <Button variant="outline" size="sm" className="h-6 px-1.5 gap-1 text-[9px] text-omni" onClick={() => setShortcut("assinar")}><FileSignature className="size-3" /> Assinar</Button>
            )}
            <MoveVendaDialog
              vendaId={venda.id}
              vendaNumero={venda.numero}
              currentFunilId={venda.funil}
              currentEtapaId={venda.etapaId}
              role={primaryRole}
              funis={funis}
              etapas={etapas}
              visibleCommercialFunilIds={visibleCommercialFunilIds}
              compact
            />
            {canFinish && (
              primaryRole === "admin" || primaryRole === "bko" ? (
                <Button
                  type="button"
                  size="icon"
                  className="size-7 bg-success text-white hover:bg-success/90"
                  onClick={() => setFinishOpen(true)}
                  title="Concluir pedido"
                  aria-label="Concluir pedido"
                >
                  <CheckCircle2 className="size-3.5" />
                </Button>
              ) : (
                <Button size="sm" className="h-7 px-2 gap-1 text-[10px] bg-success text-white hover:bg-success/90" onClick={() => setFinishOpen(true)}>
                  <CheckCircle2 className="size-3" /> Concluir pedido
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={shortcut !== null} onOpenChange={open => { if (!open) setShortcut(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{shortcut === "virar" ? "Virar Venda?" : "Enviar para Assinatura?"}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block"><strong>Origem:</strong> {currentFunil?.nome ?? venda.funil} → {currentEtapa?.nome ?? venda.etapaId}</span>
              <span className="block"><strong>Destino:</strong> {quickDestinationLabel}</span>
              <span className="block">A mesma regra de movimentação do botão Mover será aplicada e registrada no histórico.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={!quickDestination || working} onClick={() => void executeShortcut()}>{working ? "Movendo…" : "Confirmar"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={finishOpen} onOpenChange={setFinishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido {venda.numero} sairá do Pipeline ativo e continuará disponível em Meus Pedidos, preservando seu último funil e etapa no histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={working} onClick={() => void finishOrder()}>{working ? "Concluindo…" : "Concluir pedido"}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
