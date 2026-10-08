import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowUpRight, Building2, CalendarDays, CheckCircle2, CircleDollarSign,
  Clock3, Eye, Filter, Handshake, PackagePlus, Plus, Search, Trash2,
  TrendingUp, UserRound, XCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { BRAND_META, BrandLogo, BrandTile } from "@/components/brand-logo";
import { CloserOptionSelect, CloserOptionsHubButton } from "@/components/closer-option-select";
import { NovoSuporteDialog } from "@/components/novo-suporte-dialog";
import { useCloserOptions } from "@/lib/closer-options";
import {
  buildCloserClientPayload,
  filterCloserClientOptions,
  formatBrlInput,
  onvoxDidUsaNumero,
  onvoxProdutosPermitidos,
  onvoxQuantidadePersistida,
  onvoxValorTotalLinha,
  parseBrlInput,
  somenteDigitosOnvox,
  somenteDigitosTake,
  somarReceitaCloser,
  takeApiTipoValido,
  usaFluxoGuiadoNovoPedido,
  type CloserClientOption,
} from "@/lib/closer-consultor-ui";
import { toast } from "sonner";

export const Route = createFileRoute("/_shell/operacao-closer")({
  validateSearch: (search: Record<string, unknown>) => ({
    marca: search.marca === "ONVOX" || search.marca === "TAKE_FLOW"
      ? search.marca
      : "TODOS",
  }),
  component: OperacaoCloserPage,
});

type Produto = "ONVOX" | "TAKE_FLOW";

type PedidoItem = {
  id: string;
  tipo_pedido: string | null;
  produto_item: string;
  quantidade: number;
  receita: number | string;
  operadora_doadora: string | null;
  ddd: string | null;
  numero: string | null;
  data_portabilidade: string | null;
  status_portabilidade: string | null;
  data_entrega: string | null;
  equipamento: string | null;
  modelo: string | null;
  quantidade_equipamentos: number | null;
};

type Pedido = {
  id: string;
  numero: number | null;
  produto: Produto;
  etapa: string;
  closer_id: string;
  closer_nome: string | null;
  bko_id: string | null;
  bko_nome: string | null;
  data_recebimento: string | null;
  data_envio: string | null;
  data_assinatura: string | null;
  data_implantacao: string | null;
  data_ativacao: string | null;
  observacao: string | null;
  observacao_bko: string | null;
  erro: string | null;
  receita_total: number | string | null;
  take_conexoes: number | null;
  take_usuarios: number | null;
  take_valor_implantacao: number | string | null;
  take_api_tipo: string | null;
  onvox_plano_pabx: string | null;
  created_at: string;
  updated_at: string;
  concluido_em: string | null;
  closer_clientes?: {
    id: string;
    razao_social: string;
    cnpj: string;
    contato: string | null;
    telefone: string | null;
    email: string | null;
    origem_lead: string | null;
  } | null;
  closer_pedido_itens?: PedidoItem[];
};

type ItemDraft = {
  tipo_pedido: string;
  produto_item: string;
  quantidade: string;
  valor_unitario: string;
  receita: string;
  operadora_doadora: string;
  ddd: string;
  numero: string;
  equipamento: string;
  quantidade_equipamentos: string;
};

type TakeDraft = {
  receita: string;
  conexoes: string;
  usuarios: string;
  implantacao: string;
  observacao: string;
};

type TakeConnectionDraft = {
  ddd: string;
  numero: string;
};

type ItemOperationalDraft = {
  id: string;
  data_portabilidade: string;
  status_portabilidade: string;
  data_entrega: string;
};

type CloserCreationOption = {
  id: string;
  nome: string;
  email: string | null;
};

const ONVOX = "#D92FA0";
const TAKE = "#7A3DA8";
const PURPLE = "#7100CA";

const emptyItem = (): ItemDraft => ({
  tipo_pedido: "NOVO",
  produto_item: "DID",
  quantidade: "1",
  valor_unitario: "",
  receita: "",
  operadora_doadora: "",
  ddd: "",
  numero: "",
  equipamento: "",
  quantidade_equipamentos: "",
});

const emptyTake = (): TakeDraft => ({
  receita: "",
  conexoes: "",
  usuarios: "",
  implantacao: "",
  observacao: "",
});

function brl(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function money(value: string | number | null | undefined) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCnpjKey(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function productLabel(p: Produto) {
  return p === "ONVOX" ? "ONVOX" : "TAKE FLOW";
}

function isPortabilidadeTipo(tipo: string | null | undefined) {
  const normalized = String(tipo ?? "").trim().toUpperCase();
  return normalized === "PORTABILIDADE" || normalized === "PORTABILIDADE PF";
}

function isPedidoFinalizado(pedido: Pick<Pedido, "produto" | "etapa" | "concluido_em">) {
  return Boolean(pedido.concluido_em)
    || (pedido.produto === "ONVOX" && pedido.etapa === "CONCLUÍDO")
    || (pedido.produto === "TAKE_FLOW" && pedido.etapa === "ONBOARDING 3");
}

function stageClass(etapa: string, produto?: Produto) {
  if (etapa === "CONCLUÍDO" || (produto === "TAKE_FLOW" && etapa === "ONBOARDING 3")) {
    return "border-success/40 bg-success/10 text-success";
  }
  if (etapa === "CANCELADO") return "border-destructive/40 bg-destructive/10 text-destructive";
  return "border-border bg-surface-2 text-foreground";
}

function historyFieldLabel(campo: string | null | undefined) {
  const labels: Record<string, string> = {
    etapa: "Etapa",
    bko_id: "BKO responsável",
    data_recebimento: "Data de recebimento",
    data_envio: "Data de envio",
    data_assinatura: "Data de assinatura",
    data_implantacao: "Data de implantação",
    data_ativacao: "Data de ativação",
    erro: "Erro / pendência",
    observacao_closer: "Observação do Closer",
    observacao_bko: "Observação do BKO",
    data_portabilidade: "Data de portabilidade",
    status_portabilidade: "Status da portabilidade",
    data_entrega: "Data de entrega",
    item_onvox: "Item ONVOX",
  };
  return campo ? labels[campo] ?? campo.replaceAll("_", " ") : "";
}

function OperacaoCloserPage() {
  const { primaryRole, user, profile, roles } = useAuth();
  const optionCatalog = useCloserOptions();
  const canManageOptions = primaryRole === "admin" || primaryRole === "bko";
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isPedidoDetail = /^\/operacao-closer\/[^/]+\/?$/.test(pathname);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [newChoiceOpen, setNewChoiceOpen] = useState(false);
  const [newProduto, setNewProduto] = useState<Produto | null>(null);
  const [query, setQuery] = useState("");
  const { marca } = Route.useSearch();
  const produto: "TODOS" | Produto = marca;
  const setProduto = (value: "TODOS" | Produto) => {
    navigate({
      to: "/operacao-closer",
      search: { marca: value },
      replace: true,
    });
  };
  const [etapa, setEtapa] = useState("TODAS");
  const [closerFilter, setCloserFilter] = useState("TODOS");

  const canCreate =
    roles.includes("closer")
    || roles.includes("consultor")
    || roles.includes("bko")
    || roles.includes("admin")
    || roles.includes("gestor");
  const isCloser = primaryRole === "closer" || primaryRole === "consultor";
  const usaFluxoGuiadoCriacao = usaFluxoGuiadoNovoPedido(primaryRole);
  const canFilterByCloser =
    primaryRole === "bko" || primaryRole === "admin" || primaryRole === "gestor";

  async function load() {
    setLoading(true);
    const db = supabase as any;
    let request = db
      .from("closer_pedidos")
      .select("*, closer_clientes(*), closer_pedido_itens(*)")
      .order("updated_at", { ascending: false })
      .limit(2000);

    if (isCloser && user?.id) {
      request = request.eq("closer_id", user.id);
    }

    const { data, error } = await request;

    if (error) {
      toast.error("Não foi possível carregar a Operação Closer", { description: error.message });
      setLoading(false);
      return;
    }

    setPedidos((data ?? []) as Pedido[]);
    setLoading(false);
  }

  useEffect(() => {
    if (isCloser && !user?.id) return;

    void load();
    const db = supabase as any;
    const channel = db
      .channel(`operacao-closer-live-${primaryRole ?? "guest"}-${user?.id ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "closer_pedidos" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "closer_pedido_itens" }, load)
      .subscribe();

    const interval = window.setInterval(load, 30000);
    return () => {
      window.clearInterval(interval);
      db.removeChannel(channel);
    };
  }, [primaryRole, user?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (produto !== "TODOS" && p.produto !== produto) return false;
      if (etapa !== "TODAS" && p.etapa !== etapa) return false;
      if (canFilterByCloser && closerFilter !== "TODOS" && p.closer_id !== closerFilter) return false;
      if (!q) return true;

      const cliente = p.closer_clientes;
      return [
        cliente?.razao_social,
        cliente?.cnpj,
        p.closer_nome,
        p.bko_nome,
        p.numero ? String(p.numero) : "",
      ].some((value) => String(value ?? "").toLowerCase().includes(q));
    });
  }, [pedidos, query, produto, etapa, canFilterByCloser, closerFilter]);

  const receitaTotalFiltrada = useMemo(
    () => somarReceitaCloser(filtered),
    [filtered],
  );

  const stats = useMemo(() => {
    const total = pedidos.length;
    const concluidos = pedidos.filter(isPedidoFinalizado).length;
    const cancelados = pedidos.filter((p) => p.etapa === "CANCELADO").length;
    const andamento = total - concluidos - cancelados;
    const onvoxPedidos = pedidos.filter((p) => p.produto === "ONVOX");
    const takePedidos = pedidos.filter((p) => p.produto === "TAKE_FLOW");
    const receita = pedidos.reduce((sum, p) => sum + Number(p.receita_total ?? 0), 0);
    const receitaOnvox = onvoxPedidos.reduce((sum, p) => sum + Number(p.receita_total ?? 0), 0);
    const receitaTake = takePedidos.reduce((sum, p) => sum + Number(p.receita_total ?? 0), 0);

    const onvoxConcluidos = onvoxPedidos.filter(isPedidoFinalizado).length;
    const onvoxCancelados = onvoxPedidos.filter((p) => p.etapa === "CANCELADO").length;
    const onvoxAndamento = onvoxPedidos.length - onvoxConcluidos - onvoxCancelados;

    const takeConcluidos = takePedidos.filter(isPedidoFinalizado).length;
    const takeCancelados = takePedidos.filter((p) => p.etapa === "CANCELADO").length;
    const takeAndamento = takePedidos.length - takeConcluidos - takeCancelados;

    return {
      total,
      concluidos,
      cancelados,
      andamento,
      onvox: onvoxPedidos.length,
      take: takePedidos.length,
      receita,
      receitaOnvox,
      receitaTake,
      onvoxConcluidos,
      onvoxAndamento,
      takeConcluidos,
      takeAndamento,
    };
  }, [pedidos]);

  const etapasDisponiveis = useMemo(
    () => Array.from(new Set(pedidos.map((p) => p.etapa))).sort(),
    [pedidos],
  );

  const closersDisponiveis = useMemo(() => {
    const unique = new Map<string, string>();
    pedidos.forEach((pedido) => {
      if (pedido.closer_id) unique.set(pedido.closer_id, pedido.closer_nome || "Closer");
    });
    return Array.from(unique.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [pedidos]);

  if (isPedidoDetail) {
    return <Outlet />;
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <section
        className={cn(
          "relative overflow-hidden border border-white/10 bg-[#120d19] shadow-[0_24px_70px_-44px_rgba(113,0,202,.8)]",
          isCloser
            ? "rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5"
            : "rounded-3xl px-5 py-6 sm:px-7 sm:py-7",
        )}
      >
        {/* CLOSER_HEADER_BACKGROUND */}
        {produto === "TODOS" && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(217,47,160,.20),transparent_32%),radial-gradient(circle_at_88%_8%,rgba(122,61,168,.24),transparent_34%)]" />
        )}
        {produto === "ONVOX" && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(217,47,160,.28),transparent_42%)]" />
        )}
        {produto === "TAKE_FLOW" && (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_84%_10%,rgba(122,61,168,.32),transparent_42%)]" />
        )}
        {(produto === "TODOS" || produto === "ONVOX") && (
          <img
            src={BRAND_META.ONVOX.src}
            alt=""
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -left-8 -bottom-6 opacity-[0.055]",
              produto === "ONVOX" ? "h-36" : "h-28",
            )}
          />
        )}
        {(produto === "TODOS" || produto === "TAKE_FLOW") && (
          <img
            src={BRAND_META.TAKE_FLOW.src}
            alt=""
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -right-10 -bottom-4 opacity-[0.055]",
              produto === "TAKE_FLOW" ? "h-32" : "h-24",
            )}
          />
        )}

        <div className={cn(
          "relative z-10 flex gap-3",
          isCloser
            ? "flex-row items-center justify-between"
            : "flex-col xl:flex-row xl:items-center xl:justify-between xl:gap-5",
        )}>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
              <span className="size-2 rounded-full bg-[#d92fa0] shadow-[0_0_16px_#d92fa0]" />
              Frente especializada
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {(roles.includes("closer") || roles.includes("consultor")) && <NovoSuporteDialog />}
            {canManageOptions && <CloserOptionsHubButton controller={optionCatalog} />}
            {canCreate && (
              <Button
                onClick={() => {
                  if (usaFluxoGuiadoCriacao) setNewChoiceOpen(true);
                  else setNewOpen(true);
                }}
                className={cn(
                  "shrink-0 border border-white/15 bg-white text-[#21152b] font-bold hover:bg-white/90",
                  isCloser ? "h-9 px-3 text-xs" : "h-11",
                )}
              >
                <Plus className="size-4 mr-2" /> Novo pedido
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border flex flex-col lg:flex-row gap-2 lg:items-center">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente, CNPJ, Closer ou nº do pedido..."
              className="pl-9 bg-surface-1"
            />
          </div>

          {produto !== "TODOS" && (
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 px-2.5"
              onClick={() => setProduto("TODOS")}
              title="Remover filtro de marca"
            >
              <span
                className="inline-flex h-6 items-center rounded-md px-2"
                style={{ background: BRAND_META[produto].surface }}
              >
                <BrandLogo brand={produto} className="h-3.5 max-w-[88px]" imageClassName="h-full w-auto" />
              </span>
              <XCircle className="size-3.5 text-muted-foreground" />
            </Button>
          )}

          {canFilterByCloser && (
            <Select value={closerFilter} onValueChange={setCloserFilter}>
              <SelectTrigger className="w-full lg:w-52 bg-surface-1">
                <SelectValue placeholder="Todos os Closers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos os Closers</SelectItem>
                {closersDisponiveis.map((closer) => (
                  <SelectItem key={closer.id} value={closer.id}>{closer.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={etapa} onValueChange={setEtapa}>
            <SelectTrigger className="w-full lg:w-44 bg-surface-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas as etapas</SelectItem>
              {etapasDisponiveis.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
            </SelectContent>
          </Select>

          <Badge variant="outline" className="h-9 px-3 justify-center gap-1.5">
            <Filter className="size-3.5" /> {filtered.length}
          </Badge>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Carregando operação…</div>
        ) : filtered.length === 0 ? (
          <div className="p-14 text-center">
            <div className="size-14 rounded-2xl bg-surface-1 border border-border grid place-items-center mx-auto mb-3">
              <PackagePlus className="size-6 text-muted-foreground" />
            </div>
            <div className="font-semibold">Nenhum pedido por aqui ainda.</div>
            <p className="text-sm text-muted-foreground mt-1">
              O módulo começa vazio. Os novos pedidos aparecerão aqui conforme forem cadastrados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-surface-1">
                <tr>
                  <th className="text-left px-4 py-3">Pedido</th>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3">Produto</th>
                  <th className="text-left px-4 py-3">Etapa</th>
                  {!isCloser && <th className="text-left px-4 py-3">Closer</th>}
                  <th className="text-left px-4 py-3">
                    <div>Receita</div>
                    <div className="mt-1 text-[10px] font-semibold normal-case tracking-normal text-foreground">
                      Total: {brl(receitaTotalFiltrada)}
                    </div>
                  </th>
                  <th className="text-left px-4 py-3">Atualização</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((pedido) => {
                  const accent = pedido.produto === "ONVOX" ? ONVOX : TAKE;
                  const cliente = pedido.closer_clientes;
                  return (
                    <tr key={pedido.id} className="border-t border-border hover:bg-surface-1/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">
                        #{String(pedido.numero ?? "—").padStart(4, "0")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{cliente?.razao_social || "Cliente"}</div>
                        <div className="text-[11px] text-muted-foreground">{cliente?.cnpj || "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex h-8 items-center rounded-lg border border-white/10 px-2 shadow-sm"
                          style={{ background: BRAND_META[pedido.produto].surface }}
                        >
                          <BrandLogo
                            brand={pedido.produto}
                            className="h-4 max-w-[104px]"
                            imageClassName="h-full w-auto"
                          />
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={stageClass(pedido.etapa, pedido.produto)}>{pedido.etapa}</Badge>
                      </td>
                      {!isCloser && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <UserRound className="size-3.5 text-muted-foreground" /> {pedido.closer_nome || "—"}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3 font-semibold">{brl(pedido.receita_total)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(pedido.updated_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button asChild variant="ghost" size="sm" className="gap-1.5">
                          <Link to="/operacao-closer/$id" params={{ id: pedido.id }}>
                            <Eye className="size-3.5" /> Abrir
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {usaFluxoGuiadoCriacao && newChoiceOpen && (
        <NewPedidoProductChoice
          onClose={() => setNewChoiceOpen(false)}
          onSelect={(selected) => {
            setNewChoiceOpen(false);
            setNewProduto(selected);
          }}
        />
      )}

      {(newOpen || newProduto) && (
        <NewPedidoDialog
          key={newProduto ?? "privileged"}
          produtoInicial={newProduto ?? undefined}
          produtoTravado={Boolean(newProduto)}
          onClose={() => {
            setNewOpen(false);
            setNewProduto(null);
          }}
          onSaved={async (pedidoId) => {
            setNewOpen(false);
            setNewProduto(null);
            await load();
            if (pedidoId) {
              navigate({ to: "/operacao-closer/$id", params: { id: pedidoId } });
            }
          }}
        />
      )}

    </div>
  );
}

function NewPedidoProductChoice({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (produto: Produto) => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo pedido</DialogTitle>
          <DialogDescription>Escolha qual frente comercial deseja cadastrar.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <BrandTile
            brand="ONVOX"
            subtitle="Telefonia e itens do pedido"
            onClick={() => onSelect("ONVOX")}
            compact
          />
          <BrandTile
            brand="TAKE_FLOW"
            subtitle="Atendimento e implantação"
            onClick={() => onSelect("TAKE_FLOW")}
            compact
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewPedidoDialog({
  onClose,
  onSaved,
  produtoInicial,
  produtoTravado = false,
}: {
  onClose: () => void;
  onSaved: (pedidoId?: string) => void;
  produtoInicial?: Produto;
  produtoTravado?: boolean;
}) {
  const { user, profile, primaryRole, roles } = useAuth();
  const optionCatalog = useCloserOptions();
  const [saving, setSaving] = useState(false);
  const [produto, setProduto] = useState<Produto>(produtoInicial ?? "ONVOX");
  const [clienteId, setClienteId] = useState("");
  const [clienteBusca, setClienteBusca] = useState("");
  const [clientes, setClientes] = useState<CloserClientOption[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickClientSaving, setQuickClientSaving] = useState(false);
  const [razao, setRazao] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [contato, setContato] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState("");
  const [observacaoGeral, setObservacaoGeral] = useState("");
  const [representanteLegalNome, setRepresentanteLegalNome] = useState("");
  const [representanteLegalEmail, setRepresentanteLegalEmail] = useState("");
  const [representanteLegalTelefone, setRepresentanteLegalTelefone] = useState("");
  const [gestorTecnicoOpen, setGestorTecnicoOpen] = useState(false);
  const [gestorTecnicoNome, setGestorTecnicoNome] = useState("");
  const [gestorTecnicoEmail, setGestorTecnicoEmail] = useState("");
  const [gestorTecnicoTelefone, setGestorTecnicoTelefone] = useState("");
  const [gestorTecnicoEmailFaturas, setGestorTecnicoEmailFaturas] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);
  const [onvoxPlanoPabx, setOnvoxPlanoPabx] = useState("");
  const [takePedidos, setTakePedidos] = useState<TakeDraft[]>([emptyTake()]);
  const [takeApiTipo, setTakeApiTipo] = useState("");
  const [takeConexoesLinhas, setTakeConexoesLinhas] = useState<TakeConnectionDraft[]>([
    { ddd: "", numero: "" },
  ]);
  const [closerOptions, setCloserOptions] = useState<CloserCreationOption[]>([]);
  const [selectedCloserId, setSelectedCloserId] = useState("");
  const [loadingClosers, setLoadingClosers] = useState(false);

  const accent = produto === "ONVOX" ? ONVOX : TAKE;
  const isPrivilegedCreator =
    primaryRole === "bko" || primaryRole === "admin" || primaryRole === "gestor";
  const canCreatePedido =
    isPrivilegedCreator || roles.includes("closer") || roles.includes("consultor");
  const selectedCloser = closerOptions.find((closer) => closer.id === selectedCloserId);
  const targetCloserId = isPrivilegedCreator ? selectedCloserId : user?.id ?? "";
  const targetCloserName = isPrivilegedCreator
    ? selectedCloser?.nome ?? null
    : profile?.nome_completo ?? user?.email ?? null;
  const clienteSelecionado = clientes.find((cliente) => cliente.id === clienteId) ?? null;
  const clientesFiltrados = useMemo(
    () => filterCloserClientOptions(clientes, clienteBusca).slice(0, 8),
    [clientes, clienteBusca],
  );

  useEffect(() => {
    if (!isPrivilegedCreator) return;

    let active = true;
    setLoadingClosers(true);
    const db = supabase as any;
    void db.rpc("closer_listar_responsaveis_criacao").then((result: any) => {
      if (!active) return;
      if (result.error) {
        toast.error("Não foi possível carregar os responsáveis", { description: result.error.message });
        setLoadingClosers(false);
        return;
      }

      const options = (result.data ?? []) as CloserCreationOption[];
      setCloserOptions(options);
      if (options.length === 1) setSelectedCloserId(options[0].id);
      setLoadingClosers(false);
    });

    return () => {
      active = false;
    };
  }, [isPrivilegedCreator]);

  useEffect(() => {
    if (!produtoTravado || !user?.id) return;

    let active = true;
    setLoadingClientes(true);
    const db = supabase as any;

    void db
      .from("closer_clientes")
      .select("id, razao_social, cnpj, contato, telefone, email, origem_lead")
      .order("razao_social", { ascending: true })
      .limit(1500)
      .then((result: any) => {
        if (!active) return;
        if (result.error) {
          toast.error("Não foi possível carregar os clientes", { description: result.error.message });
          setLoadingClientes(false);
          return;
        }

        setClientes((result.data ?? []) as CloserClientOption[]);
        setLoadingClientes(false);
      });

    return () => {
      active = false;
    };
  }, [produtoTravado, user?.id]);

  function resetQuickClient() {
    setRazao("");
    setCnpj("");
    setContato("");
    setTelefone("");
    setEmail("");
  }

  async function criarClienteRapido() {
    if (!user) return toast.error("Sessão não encontrada.");
    if (!targetCloserId) return toast.error("Responsável comercial não encontrado.");

    const razaoValue = razao.trim();
    const cnpjValue = cnpj.trim();
    const cnpjDigits = cnpjValue.replace(/\D/g, "");
    const contatoValue = contato.trim();
    const telefoneValue = telefone.trim();
    const emailValue = email.trim();

    if (razaoValue.length < 2) return toast.error("Informe a razão social.");
    if (cnpjDigits.length !== 14) return toast.error("Informe um CNPJ com 14 dígitos.");
    if (contatoValue.length < 2) return toast.error("Informe o nome do contato.");
    if (telefoneValue.replace(/\D/g, "").length < 10) return toast.error("Informe um número com DDD.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailValue)) return toast.error("Informe um e-mail válido.");

    const existente = clientes.find((cliente) =>
      normalizeCnpjKey(cliente.cnpj) === normalizeCnpjKey(cnpjValue)
    );
    if (existente) {
      setClienteId(existente.id);
      setClienteBusca("");
      setQuickClientOpen(false);
      resetQuickClient();
      toast.info("Empresa já cadastrada e selecionada.");
      return;
    }

    setQuickClientSaving(true);
    try {
      const db = supabase as any;
      const payload = {
        ...buildCloserClientPayload({
          closerId: targetCloserId,
          closerNome: targetCloserName,
          razaoSocial: razaoValue,
          cnpj: cnpjValue,
          contato: contatoValue,
          telefone: telefoneValue,
          email: emailValue,
        }),
        created_by: user.id,
      };

      const { data, error } = await db
        .from("closer_clientes")
        .insert(payload)
        .select("id, razao_social, cnpj, contato, telefone, email, origem_lead")
        .single();

      if (error) throw error;

      const novo = data as CloserClientOption;
      setClientes((current) => [novo, ...current.filter((cliente) => cliente.id !== novo.id)]);
      setClienteId(novo.id);
      setClienteBusca("");
      setQuickClientOpen(false);
      resetQuickClient();
      toast.success("Empresa cadastrada e selecionada.");
    } catch (error: any) {
      const duplicate =
        error?.code === "23505"
        || String(error?.message ?? "").includes("closer_clientes_cnpj_global_uidx");
      toast.error(duplicate ? "CNPJ já cadastrado" : "Não foi possível cadastrar a empresa", {
        description: duplicate
          ? "Este CNPJ já existe na Operação Closer."
          : error?.message ?? String(error),
      });
    } finally {
      setQuickClientSaving(false);
    }
  }

  async function getOrCreateCliente() {
    if (!user) throw new Error("Sessão não encontrada.");
    if (produtoTravado) {
      if (!clienteId) throw new Error("Selecione um cliente.");
      return clienteId;
    }

    const db = supabase as any;
    const cnpjValue = cnpj.trim();
    const cnpjKey = normalizeCnpjKey(cnpjValue);
    const existingResult = await db
      .from("closer_clientes")
      .select("id, closer_id, cnpj")
      .limit(2000);

    if (existingResult.error) throw existingResult.error;

    const existing = (existingResult.data ?? []).find((row: any) =>
      normalizeCnpjKey(String(row.cnpj ?? "")) === cnpjKey
    );

    if (!isPrivilegedCreator && existing?.id && existing.closer_id !== user.id) {
      const duplicate = new Error("Este CNPJ já está cadastrado no sistema por outro responsável comercial.");
      (duplicate as any).code = "CNPJ_DUPLICADO";
      throw duplicate;
    }

    if (existing?.id) {
      const update = await db
        .from("closer_clientes")
        .update({
          razao_social: razao.trim(),
          contato: contato.trim() || null,
          telefone: telefone.trim() || null,
          email: email.trim() || null,
          origem_lead: origem.trim() || null,
        })
        .eq("id", existing.id);

      if (update.error) throw update.error;
      return existing.id as string;
    }

    const insert = await db
      .from("closer_clientes")
      .insert({
        closer_id: targetCloserId,
        closer_nome: targetCloserName,
        razao_social: razao.trim(),
        cnpj: cnpjValue,
        contato: contato.trim() || null,
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        origem_lead: origem.trim() || null,
      })
      .select("id")
      .single();

    if (insert.error) throw insert.error;
    return insert.data.id as string;
  }

  async function save() {
    if (!canCreatePedido) return toast.error("Seu perfil não possui permissão para criar pedidos.");
    if (!user) return toast.error("Sessão não encontrada.");
    if (isPrivilegedCreator && !selectedCloserId) return toast.error("Selecione o Closer responsável pelo pedido.");
    if (produtoTravado) {
      if (!clienteId) return toast.error("Selecione ou cadastre um cliente.");
    } else {
      if (razao.trim().length < 2) return toast.error("Informe a razão social.");
      if (!cnpj.trim()) return toast.error("Informe o CNPJ.");
      if (!origem.trim()) return toast.error("Informe a origem do lead.");
      if (!contato.trim()) return toast.error("Informe o contato.");
      if (!telefone.trim()) return toast.error("Informe o telefone.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return toast.error("Informe um e-mail válido.");
    }
    if (produto === "ONVOX" && items.some((item) => !item.produto_item.trim())) {
      return toast.error("Informe o produto de todos os itens ONVOX.");
    }
    if (produto === "ONVOX") {
      if (!["Enterprise", "Ultimate"].includes(onvoxPlanoPabx)) {
        return toast.error("Selecione o Plano PABX.");
      }
      for (const item of items) {
        if (item.produto_item === "DID") {
          if (!somenteDigitosOnvox(item.ddd)) {
            return toast.error("Informe o DDD de todos os itens DID.");
          }
          if (onvoxDidUsaNumero(item.tipo_pedido, item.produto_item) && !somenteDigitosOnvox(item.numero)) {
            return toast.error("Informe o número de todos os DID de portabilidade.");
          }
        }
      }
    }
    if (produto === "ONVOX" || produto === "TAKE_FLOW") {
      if (representanteLegalNome.trim().length < 2) return toast.error("Informe o nome do Representante Legal.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(representanteLegalEmail.trim())) {
        return toast.error("Informe um e-mail válido para o Representante Legal.");
      }
      if (representanteLegalTelefone.replace(/\D/g, "").length < 10) {
        return toast.error("Informe o telefone do Representante Legal com DDD.");
      }

      if (gestorTecnicoOpen) {
        if (gestorTecnicoNome.trim().length < 2) return toast.error("Informe o nome do Gestor Técnico.");
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(gestorTecnicoEmail.trim())) {
          return toast.error("Informe um e-mail válido para o Gestor Técnico.");
        }
        if (gestorTecnicoTelefone.replace(/\D/g, "").length < 10) {
          return toast.error("Informe o telefone do Gestor Técnico com DDD.");
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(gestorTecnicoEmailFaturas.trim())) {
          return toast.error("Informe um e-mail válido para envio das faturas mensais.");
        }
      }
    }
    if (produto === "TAKE_FLOW") {
      if (takePedidos.length === 0) return toast.error("Preencha o pedido Take Flow.");
      if (!takeApiTipoValido(takeApiTipo)) return toast.error("Selecione o Tipo de API.");
      const linhaIncompleta = takeConexoesLinhas.some((linha) =>
        Boolean(linha.ddd || linha.numero) && (!linha.ddd || !linha.numero)
      );
      if (linhaIncompleta) return toast.error("Preencha DDD e Número em todas as linhas de conexão utilizadas.");
    }

    setSaving(true);
    const db = supabase as any;

    try {
      const clienteId = await getOrCreateCliente();
      let createdPedidoId: string | undefined;

      if (produto === "ONVOX") {
        const pedidoResult = await db
          .from("closer_pedidos")
          .insert({
            cliente_id: clienteId,
            closer_id: targetCloserId,
            closer_nome: targetCloserName,
            produto: "ONVOX",
            etapa: "CONTRATO",
            observacao: observacaoGeral.trim() || null,
            representante_legal_nome: representanteLegalNome.trim(),
            representante_legal_email: representanteLegalEmail.trim().toLowerCase(),
            representante_legal_telefone: representanteLegalTelefone.trim(),
            gestor_tecnico_nome: gestorTecnicoOpen ? gestorTecnicoNome.trim() || null : null,
            gestor_tecnico_email: gestorTecnicoOpen ? gestorTecnicoEmail.trim().toLowerCase() || null : null,
            gestor_tecnico_telefone: gestorTecnicoOpen ? gestorTecnicoTelefone.trim() || null : null,
            gestor_tecnico_email_faturas: gestorTecnicoOpen ? gestorTecnicoEmailFaturas.trim().toLowerCase() || null : null,
            onvox_plano_pabx: onvoxPlanoPabx,
            receita_total: items.reduce((sum, item) => sum + onvoxValorTotalLinha(
              item.produto_item,
              onvoxQuantidadePersistida(item.produto_item, item.quantidade, item.tipo_pedido),
              item.valor_unitario,
              item.receita,
            ), 0),
          })
          .select("id")
          .single();

        if (pedidoResult.error) throw pedidoResult.error;
        createdPedidoId = pedidoResult.data.id as string;

        const itemPayload = items.map((item) => ({
          pedido_id: pedidoResult.data.id,
          tipo_pedido: item.tipo_pedido || null,
          produto_item: item.produto_item.trim(),
          quantidade: onvoxQuantidadePersistida(item.produto_item, item.quantidade, item.tipo_pedido),
          receita: onvoxValorTotalLinha(
            item.produto_item,
            onvoxQuantidadePersistida(item.produto_item, item.quantidade, item.tipo_pedido),
            item.valor_unitario,
            item.receita,
          ),
          operadora_doadora: isPortabilidadeTipo(item.tipo_pedido) ? item.operadora_doadora.trim() || null : null,
          ddd: item.produto_item === "DID" ? somenteDigitosOnvox(item.ddd) || null : null,
          numero: onvoxDidUsaNumero(item.tipo_pedido, item.produto_item)
            ? somenteDigitosOnvox(item.numero) || null
            : null,
          equipamento: item.produto_item === "APARELHO" ? item.equipamento.trim() || null : null,
          modelo: null,
          quantidade_equipamentos: item.produto_item === "APARELHO" && item.quantidade_equipamentos
            ? Math.max(1, Number(item.quantidade_equipamentos))
            : null,
        }));

        const itemResult = await db.from("closer_pedido_itens").insert(itemPayload);
        if (itemResult.error) throw itemResult.error;

        toast.success("Pedido ONVOX cadastrado.");
      } else {
        const pedidoPayload = takePedidos.slice(0, 1).map((take) => {
          return {
            cliente_id: clienteId,
            closer_id: targetCloserId,
            closer_nome: targetCloserName,
            produto: "TAKE_FLOW",
            etapa: "CONTRATO",
            observacao: take.observacao.trim() || null,
            receita_total: money(take.receita),
            take_conexoes: take.conexoes ? Number(take.conexoes) : null,
            take_usuarios: take.usuarios ? Number(take.usuarios) : null,
            take_valor_implantacao: take.implantacao ? money(take.implantacao) : null,
            take_api_tipo: takeApiTipo,
            representante_legal_nome: representanteLegalNome.trim(),
            representante_legal_email: representanteLegalEmail.trim().toLowerCase(),
            representante_legal_telefone: representanteLegalTelefone.trim(),
            gestor_tecnico_nome: gestorTecnicoOpen ? gestorTecnicoNome.trim() || null : null,
            gestor_tecnico_email: gestorTecnicoOpen ? gestorTecnicoEmail.trim().toLowerCase() || null : null,
            gestor_tecnico_telefone: gestorTecnicoOpen ? gestorTecnicoTelefone.trim() || null : null,
            gestor_tecnico_email_faturas: gestorTecnicoOpen ? gestorTecnicoEmailFaturas.trim().toLowerCase() || null : null,
          };
        });

        const pedidoResult = await db.from("closer_pedidos").insert(pedidoPayload).select("id");
        if (pedidoResult.error) throw pedidoResult.error;
        createdPedidoId = pedidoResult.data?.[0]?.id as string | undefined;

        const conexoesPayload = takeConexoesLinhas
          .filter((linha) => linha.ddd && linha.numero)
          .map((linha, index) => ({
            pedido_id: createdPedidoId,
            ddd: linha.ddd,
            numero: linha.numero,
            ordem: index,
          }));

        if (conexoesPayload.length > 0) {
          const conexoesResult = await db.from("closer_take_conexoes").insert(conexoesPayload);
          if (conexoesResult.error) throw conexoesResult.error;
        }

        toast.success("Pedido Take Flow cadastrado.");
      }

      onSaved(createdPedidoId);
    } catch (error: any) {
      const duplicateCnpj =
        error?.code === "CNPJ_DUPLICADO"
        || (error?.code === "23505" && String(error?.message ?? "").includes("closer_clientes_cnpj_global_uidx"));

      toast.error(
        duplicateCnpj ? "CNPJ já cadastrado" : "Não foi possível criar o pedido",
        { description: duplicateCnpj ? "Este CNPJ já existe na Operação Closer e não pode ser cadastrado novamente." : error?.message ?? String(error) },
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo pedido</DialogTitle>
          <DialogDescription>
            {isPrivilegedCreator
              ? "Gestor, BKO e Admin podem criar pedidos ONVOX e Take Flow e atribuí-los ao Consultor/Closer responsável. O pedido começa em CONTRATO e segue o mesmo fluxo operacional."
              : "O Consultor/Closer cadastra o próprio pedido e as informações comerciais. Datas e movimentação operacional ficam com o BKO."}
          </DialogDescription>
        </DialogHeader>

        {produtoTravado ? (
          <div
            className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5"
            style={{
              borderColor: `${accent}55`,
              background: produto === "ONVOX" ? "rgba(217,47,160,.08)" : "rgba(122,61,168,.08)",
            }}
          >
            <div className="text-xs font-semibold text-muted-foreground">Pedido selecionado</div>
            <BrandLogo
              brand={produto}
              className="h-5 max-w-[120px]"
              imageClassName="h-full w-auto"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <BrandTile
              brand="ONVOX"
              active={produto === "ONVOX"}
              subtitle="Telefonia e itens do pedido"
              onClick={() => setProduto("ONVOX")}
              compact
            />
            <BrandTile
              brand="TAKE_FLOW"
              active={produto === "TAKE_FLOW"}
              subtitle="Atendimento e implantação"
              onClick={() => setProduto("TAKE_FLOW")}
              compact
            />
          </div>
        )}

        {isPrivilegedCreator && (
          <section className="space-y-3 rounded-xl border border-border bg-surface-1/55 p-3">
            <SectionTitle title="Consultor responsável" />
            <div className="space-y-1.5">
              <Label>Consultor / Closer responsável *</Label>
              <Select value={selectedCloserId} onValueChange={setSelectedCloserId} disabled={loadingClosers || saving}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={loadingClosers ? "Carregando responsáveis…" : "Selecione o responsável pela venda"} />
                </SelectTrigger>
                <SelectContent>
                  {closerOptions.map((closer) => (
                    <SelectItem key={closer.id} value={closer.id}>
                      {closer.nome}{closer.email ? ` · ${closer.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                O pedido aparecerá para este responsável como se ele próprio tivesse criado a venda e ficará registrado no histórico como criado por {profile?.nome_completo ?? user?.email ?? "você"}.
              </p>
              {!loadingClosers && closerOptions.length === 0 && (
                <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  Nenhum Consultor/Closer ativo foi encontrado. Cadastre ou ative um responsável antes de criar o pedido.
                </div>
              )}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <SectionTitle title="Dados do cliente" />

          {produtoTravado ? (
            <div className="space-y-3">
              {clienteSelecionado ? (
                <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{clienteSelecionado.razao_social}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {clienteSelecionado.cnpj}
                      {clienteSelecionado.contato ? ` · ${clienteSelecionado.contato}` : ""}
                      {clienteSelecionado.telefone ? ` · ${clienteSelecionado.telefone}` : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setClienteId("");
                      setClienteBusca("");
                    }}
                  >
                    Trocar cliente
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={clienteBusca}
                      onChange={(event) => setClienteBusca(event.target.value)}
                      placeholder="Buscar por razão social ou CNPJ"
                      className="pl-9"
                    />
                  </div>

                  {clienteBusca.trim() && (
                    <div className="max-h-52 overflow-y-auto rounded-xl border border-border bg-surface-1">
                      {loadingClientes ? (
                        <div className="px-3 py-4 text-xs text-muted-foreground">Carregando clientes…</div>
                      ) : clientesFiltrados.length > 0 ? (
                        clientesFiltrados.map((cliente) => (
                          <button
                            key={cliente.id}
                            type="button"
                            onClick={() => {
                              setClienteId(cliente.id);
                              setClienteBusca("");
                            }}
                            className="flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-background/70"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{cliente.razao_social}</div>
                              <div className="text-[11px] text-muted-foreground">{cliente.cnpj}</div>
                            </div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Selecionar</span>
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-4 text-xs text-muted-foreground">Nenhum cliente encontrado.</div>
                      )}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      resetQuickClient();
                      setQuickClientOpen(true);
                    }}
                    className="gap-1.5"
                  >
                    <Plus className="size-3.5" /> Cadastrar novo cliente
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Razão social *"><Input value={razao} onChange={(e) => setRazao(e.target.value)} /></Field>
              <Field label="CNPJ *">
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="Digite o CNPJ"
                />
              </Field>
              <Field label="Origem do lead *"><Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Indicação, inbound, outbound..." /></Field>
              <Field label="Contato *"><Input value={contato} onChange={(e) => setContato(e.target.value)} /></Field>
              <Field label="Telefone *"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Field>
              <Field label="E-mail *"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            </div>
          )}
        </section>

        {produto === "ONVOX" ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle title="Itens ONVOX" accent={ONVOX} />
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => [...current, emptyItem()])}>
                <Plus className="size-3.5 mr-1" /> Adicionar item
              </Button>
            </div>

            <div className="max-w-sm">
              <Field label="Plano PABX *">
                <Select value={onvoxPlanoPabx} onValueChange={setOnvoxPlanoPabx}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione o plano PABX" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Enterprise">Enterprise</SelectItem>
                    <SelectItem value="Ultimate">Ultimate</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <p className="mt-1 text-[10px] text-muted-foreground">Plano do pedido, sem vínculo com um produto específico.</p>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="rounded-xl border border-border bg-surface-1 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold">Item {index + 1}</div>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <Trash2 className="size-3.5 mr-1" /> Remover
                      </Button>
                    )}
                  </div>

                  <div className="grid md:grid-cols-4 gap-3">
                    <Field label="Tipo de pedido">
                      <CloserOptionSelect
                        category="onvox_order_type"
                        value={item.tipo_pedido}
                        onValueChange={(value) => setItems((current) => current.map((row, itemIndex) => {
                          if (itemIndex !== index) return row;
                          const permitidos = onvoxProdutosPermitidos(value);
                          const produtoAtualPermitido = permitidos.includes(row.produto_item);
                          return {
                            ...row,
                            tipo_pedido: value,
                            produto_item: produtoAtualPermitido ? row.produto_item : permitidos[0],
                            quantidade: produtoAtualPermitido && (row.produto_item === "RAMAIS" || row.produto_item === "DID")
                              ? (onvoxDidUsaNumero(value, row.produto_item) ? "1" : row.quantidade)
                              : "1",
                            valor_unitario: produtoAtualPermitido && (row.produto_item === "RAMAIS" || row.produto_item === "DID") ? row.valor_unitario : "",
                            operadora_doadora: isPortabilidadeTipo(value) ? row.operadora_doadora : "",
                            numero: onvoxDidUsaNumero(value, produtoAtualPermitido ? row.produto_item : permitidos[0]) ? row.numero : "",
                          };
                        }))}
                        canManage={false}
                        allowedValues={["NOVO", "PORTABILIDADE", "TT", "PORTABILIDADE PF"]}
                        label="Tipo de pedido"
                        controller={optionCatalog}
                      />
                    </Field>

                    <Field label="Tipo de produto">
                      <CloserOptionSelect
                        category="onvox_product"
                        value={item.produto_item}
                        allowedValues={onvoxProdutosPermitidos(item.tipo_pedido)}
                        onValueChange={(value) => setItems((current) => current.map((row, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...row,
                                produto_item: value,
                                quantidade: value === "RAMAIS" || value === "DID"
                                  ? (onvoxDidUsaNumero(row.tipo_pedido, value) ? "1" : row.quantidade || "1")
                                  : "1",
                                valor_unitario: value === "RAMAIS" || value === "DID" ? row.valor_unitario : "",
                                ddd: value === "DID" ? row.ddd : "",
                                numero: onvoxDidUsaNumero(row.tipo_pedido, value) ? row.numero : "",
                              }
                            : row
                        ))}
                        canManage={false}
                        label="Tipo de produto"
                        controller={optionCatalog}
                      />
                    </Field>

                    {(item.produto_item === "RAMAIS" || item.produto_item === "DID") ? (
                      <>
                        {item.produto_item === "DID" && (
                          <Field label="DDD *">
                            <Input
                              inputMode="numeric"
                              value={item.ddd}
                              onChange={(e) => setItems((current) => current.map((row, itemIndex) =>
                                itemIndex === index ? { ...row, ddd: somenteDigitosOnvox(e.target.value) } : row
                              ))}
                              placeholder="DDD"
                            />
                          </Field>
                        )}

                        {item.produto_item === "DID" && onvoxDidUsaNumero(item.tipo_pedido, item.produto_item) ? (
                          <Field label="Número *">
                            <Input
                              inputMode="numeric"
                              value={item.numero}
                              onChange={(e) => setItems((current) => current.map((row, itemIndex) =>
                                itemIndex === index ? { ...row, numero: somenteDigitosOnvox(e.target.value) } : row
                              ))}
                              placeholder="Número"
                            />
                          </Field>
                        ) : (
                          <Field label={item.produto_item === "DID" ? "Qtd. de DID" : "Qtd. de Ramais"}>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantidade}
                              onChange={(e) => setItems((current) => current.map((row, itemIndex) =>
                                itemIndex === index ? { ...row, quantidade: e.target.value } : row
                              ))}
                            />
                          </Field>
                        )}

                        <Field label="Valor unitário">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.valor_unitario}
                            onChange={(e) => setItems((current) => current.map((row, itemIndex) =>
                              itemIndex === index ? { ...row, valor_unitario: e.target.value } : row
                            ))}
                          />
                        </Field>

                        <Field label="Valor total">
                          <Input
                            value={brl(onvoxValorTotalLinha(
                              item.produto_item,
                              onvoxQuantidadePersistida(item.produto_item, item.quantidade, item.tipo_pedido),
                              item.valor_unitario,
                              "",
                            ))}
                            readOnly
                            className="bg-muted/40 font-semibold"
                          />
                        </Field>
                      </>
                    ) : (
                      <Field label="Valor">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.receita}
                          onChange={(e) => setItems((current) => current.map((row, itemIndex) =>
                            itemIndex === index ? { ...row, receita: e.target.value } : row
                          ))}
                        />
                      </Field>
                    )}

                    {isPortabilidadeTipo(item.tipo_pedido) && (
                      <Field label="Operadora doadora">
                        <Input
                          value={item.operadora_doadora}
                          onChange={(e) => setItems((current) => current.map((row, itemIndex) =>
                            itemIndex === index ? { ...row, operadora_doadora: e.target.value } : row
                          ))}
                        />
                      </Field>
                    )}

                    {item.produto_item === "APARELHO" && (
                      <>
                        <Field label="Equipamento / Modelo">
                          <Input
                            value={item.equipamento}
                            onChange={(e) => setItems((current) => current.map((row, itemIndex) =>
                              itemIndex === index ? { ...row, equipamento: e.target.value } : row
                            ))}
                            placeholder="Ex.: Headset Intelbras CHS 55"
                          />
                        </Field>

                        <Field label="Qtd. equipamentos">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantidade_equipamentos}
                            onChange={(e) => setItems((current) => current.map((row, itemIndex) =>
                              itemIndex === index ? { ...row, quantidade_equipamentos: e.target.value } : row
                            ))}
                          />
                        </Field>
                      </>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Portabilidade, entrega e demais datas serão preenchidas pelo BKO no acompanhamento.
                  </p>
                </div>
              ))}
            </div>

            <section className="space-y-3 rounded-xl border border-border bg-surface-1/55 p-3">
              <SectionTitle title="Representante Legal" accent={ONVOX} />
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Nome *">
                  <Input value={representanteLegalNome} onChange={(e) => setRepresentanteLegalNome(e.target.value)} />
                </Field>
                <Field label="E-mail *">
                  <Input type="email" value={representanteLegalEmail} onChange={(e) => setRepresentanteLegalEmail(e.target.value)} />
                </Field>
                <Field label="Telefone *">
                  <Input value={representanteLegalTelefone} onChange={(e) => setRepresentanteLegalTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                </Field>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border bg-surface-1/55 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <SectionTitle title="Gestor Técnico" accent={ONVOX} />
                  <p className="mt-1 text-[11px] text-muted-foreground">Opcional</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setGestorTecnicoOpen((current) => !current);
                    if (gestorTecnicoOpen) {
                      setGestorTecnicoNome("");
                      setGestorTecnicoEmail("");
                      setGestorTecnicoTelefone("");
                      setGestorTecnicoEmailFaturas("");
                    }
                  }}
                >
                  {gestorTecnicoOpen ? "Remover gestor técnico" : "Adicionar gestor técnico"}
                </Button>
              </div>

              {gestorTecnicoOpen && (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Nome *">
                    <Input value={gestorTecnicoNome} onChange={(e) => setGestorTecnicoNome(e.target.value)} />
                  </Field>
                  <Field label="E-mail *">
                    <Input type="email" value={gestorTecnicoEmail} onChange={(e) => setGestorTecnicoEmail(e.target.value)} />
                  </Field>
                  <Field label="Telefone *">
                    <Input value={gestorTecnicoTelefone} onChange={(e) => setGestorTecnicoTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                  </Field>
                  <Field label="E-mail para envio das faturas mensais *">
                    <Input type="email" value={gestorTecnicoEmailFaturas} onChange={(e) => setGestorTecnicoEmailFaturas(e.target.value)} />
                  </Field>
                </div>
              )}
            </section>
          </section>
        ) : (
          <section className="space-y-3">
            <SectionTitle title="Pedido Take Flow" accent={TAKE} dark />

            <div className="max-w-sm">
              <Field label="Tipo de API *">
                <Select value={takeApiTipo} onValueChange={setTakeApiTipo}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione o tipo de API" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="API OFICIAL">API OFICIAL</SelectItem>
                    <SelectItem value="API NÃO OFICIAL">API NÃO OFICIAL</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {takePedidos.slice(0, 1).map((take, index) => (
              <div key="take-unico" className="rounded-xl border border-border bg-surface-1 p-3 space-y-3">
                <div className="grid md:grid-cols-4 gap-3">
                  <Field label="Receita">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatBrlInput(take.receita)}
                      onChange={(e) => setTakePedidos((current) => current.map((row, itemIndex) =>
                        itemIndex === index ? { ...row, receita: parseBrlInput(e.target.value) } : row
                      ))}
                      placeholder="R$ 0,00"
                    />
                  </Field>
                  <Field label="Qtd. Conexões">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={take.conexoes}
                      onChange={(e) => setTakePedidos((current) => current.map((row, itemIndex) =>
                        itemIndex === index ? { ...row, conexoes: somenteDigitosTake(e.target.value) } : row
                      ))}
                    />
                  </Field>
                  <Field label="Qtd. Usuários">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={take.usuarios}
                      onChange={(e) => setTakePedidos((current) => current.map((row, itemIndex) =>
                        itemIndex === index ? { ...row, usuarios: somenteDigitosTake(e.target.value) } : row
                      ))}
                    />
                  </Field>
                  <Field label="Valor implantação">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={formatBrlInput(take.implantacao)}
                      onChange={(e) => setTakePedidos((current) => current.map((row, itemIndex) =>
                        itemIndex === index ? { ...row, implantacao: parseBrlInput(e.target.value) } : row
                      ))}
                      placeholder="R$ 0,00"
                    />
                  </Field>
                </div>

                <Field label="Observação deste pedido">
                  <textarea
                    className="min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    value={take.observacao}
                    onChange={(e) => setTakePedidos((current) => current.map((row, itemIndex) =>
                      itemIndex === index ? { ...row, observacao: e.target.value } : row
                    ))}
                  />
                </Field>

                <div className="space-y-2 rounded-xl border border-border bg-background/45 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold">Linhas de conexão</div>
                      <div className="text-[10px] text-muted-foreground">DDD e Número aceitam somente números.</div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTakeConexoesLinhas((current) => [...current, { ddd: "", numero: "" }])}
                    >
                      <Plus className="mr-1 size-3.5" /> Adicionar linha
                    </Button>
                  </div>

                  <div className="grid grid-cols-[90px_minmax(0,1fr)_44px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <div>DDD</div>
                    <div>Número</div>
                    <div />
                  </div>

                  <div className="space-y-2">
                    {takeConexoesLinhas.map((linha, linhaIndex) => (
                      <div key={linhaIndex} className="grid grid-cols-[90px_minmax(0,1fr)_44px] gap-2">
                        <Input
                          inputMode="numeric"
                          value={linha.ddd}
                          onChange={(e) => setTakeConexoesLinhas((current) => current.map((row, rowIndex) =>
                            rowIndex === linhaIndex ? { ...row, ddd: somenteDigitosTake(e.target.value) } : row
                          ))}
                          placeholder="DDD"
                        />
                        <Input
                          inputMode="numeric"
                          value={linha.numero}
                          onChange={(e) => setTakeConexoesLinhas((current) => current.map((row, rowIndex) =>
                            rowIndex === linhaIndex ? { ...row, numero: somenteDigitosTake(e.target.value) } : row
                          ))}
                          placeholder="Número"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          disabled={takeConexoesLinhas.length === 1}
                          onClick={() => setTakeConexoesLinhas((current) =>
                            current.filter((_, rowIndex) => rowIndex !== linhaIndex)
                          )}
                          title="Remover linha"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <section className="space-y-3 rounded-xl border border-border bg-surface-1/55 p-3">
              <SectionTitle title="Representante Legal" accent={TAKE} />
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Nome *">
                  <Input value={representanteLegalNome} onChange={(e) => setRepresentanteLegalNome(e.target.value)} />
                </Field>
                <Field label="E-mail *">
                  <Input type="email" value={representanteLegalEmail} onChange={(e) => setRepresentanteLegalEmail(e.target.value)} />
                </Field>
                <Field label="Telefone *">
                  <Input value={representanteLegalTelefone} onChange={(e) => setRepresentanteLegalTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                </Field>
              </div>
            </section>

            <section className="space-y-3 rounded-xl border border-border bg-surface-1/55 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <SectionTitle title="Gestor Técnico" accent={TAKE} />
                  <p className="mt-1 text-[11px] text-muted-foreground">Opcional</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setGestorTecnicoOpen((current) => !current);
                    if (gestorTecnicoOpen) {
                      setGestorTecnicoNome("");
                      setGestorTecnicoEmail("");
                      setGestorTecnicoTelefone("");
                      setGestorTecnicoEmailFaturas("");
                    }
                  }}
                >
                  {gestorTecnicoOpen ? "Remover gestor técnico" : "Adicionar gestor técnico"}
                </Button>
              </div>

              {gestorTecnicoOpen && (
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Nome *">
                    <Input value={gestorTecnicoNome} onChange={(e) => setGestorTecnicoNome(e.target.value)} />
                  </Field>
                  <Field label="E-mail *">
                    <Input type="email" value={gestorTecnicoEmail} onChange={(e) => setGestorTecnicoEmail(e.target.value)} />
                  </Field>
                  <Field label="Telefone *">
                    <Input value={gestorTecnicoTelefone} onChange={(e) => setGestorTecnicoTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                  </Field>
                  <Field label="E-mail para envio das faturas mensais *">
                    <Input type="email" value={gestorTecnicoEmailFaturas} onChange={(e) => setGestorTecnicoEmailFaturas(e.target.value)} />
                  </Field>
                </div>
              )}
            </section>
          </section>
        )}

        {produto === "ONVOX" && (
          <Field label="Observação geral">
            <textarea
              className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={observacaoGeral}
              onChange={(e) => setObservacaoGeral(e.target.value)}
              placeholder="Informações comerciais ou observações do Closer..."
            />
          </Field>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            onClick={save}
            disabled={saving || (isPrivilegedCreator && (!selectedCloserId || loadingClosers))}
            className={"text-white font-semibold"}
            style={{ backgroundColor: accent }}
          >
            {saving ? "Salvando…" : "Cadastrar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
      </Dialog>

      <Dialog
        open={quickClientOpen}
        onOpenChange={(open) => {
          if (!open && !quickClientSaving) {
            setQuickClientOpen(false);
            resetQuickClient();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar nova empresa</DialogTitle>
            <DialogDescription>
              Cadastre somente os dados essenciais. Ao salvar, a empresa já ficará selecionada neste pedido {productLabel(produto)}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Razão social *">
                <Input value={razao} onChange={(event) => setRazao(event.target.value)} />
              </Field>
            </div>
            <Field label="CNPJ *">
              <Input value={cnpj} onChange={(event) => setCnpj(event.target.value)} placeholder="00.000.000/0000-00" />
            </Field>
            <Field label="Contato *">
              <Input value={contato} onChange={(event) => setContato(event.target.value)} placeholder="Nome do contato" />
            </Field>
            <Field label="Número / telefone *">
              <Input value={telefone} onChange={(event) => setTelefone(event.target.value)} placeholder="(00) 00000-0000" />
            </Field>
            <Field label="E-mail *">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={quickClientSaving}
              onClick={() => {
                setQuickClientOpen(false);
                resetQuickClient();
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={quickClientSaving}
              onClick={criarClienteRapido}
              className="text-white font-semibold"
              style={{ backgroundColor: accent }}
            >
              {quickClientSaving ? "Cadastrando…" : "Cadastrar empresa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}

function SectionTitle({ title, accent, dark = false }: { title: string; accent?: string; dark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {accent && <span className="size-2.5 rounded-full" style={{ backgroundColor: accent }} />}
      <div className={cn("text-sm font-semibold", dark && "text-foreground")}>{title}</div>
    </div>
  );
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="size-3" />}{label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
