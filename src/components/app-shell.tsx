import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, KanbanSquare, UsersRound, Upload, Settings,
  Search, Bell, BellRing, ChevronDown, ChevronLeft, ChevronRight, LogOut, User as UserIcon,
  BarChart3, LifeBuoy, AlertTriangle, Zap, FileText, CheckCheck, Wallet, Inbox, MessageCircle, Handshake, Target, X, Sun, Moon, Eye, Building2, Bot, Tv2,
} from "lucide-react";
import { useOmni } from "@/lib/omni-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth, ROLE_LABEL, ROLE_COLOR, type AppRole } from "@/lib/auth";
import { useFeatures } from "@/lib/features";
import { BrandLogo, OperatorBrandPill } from "@/components/brand-logo";

import { useNotificacoes, type NotificationChannel, type Notificacao } from "@/lib/notifications";
import { NotificationDetailsDialog } from "@/components/notification-details-dialog";
import { ACOMPANHAMENTO_ROLES, canAccessRoute, landingForRole } from "@/lib/permissions";
import { getWaitingSupportRequestCount } from "@/lib/support.functions";
import { clearNavigationMemory, recordInternalNavigation } from "@/lib/navigation-memory";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MeusClientesEmpresasPanel } from "@/components/clientes-pedidos";

const NAV: { to: string; label: string; icon: any; roles: AppRole[]; exact?: boolean }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "gestor", "consultor"] },
  { to: "/acompanhamento", label: "Acompanhamento", icon: Target, roles: ACOMPANHAMENTO_ROLES },
  { to: "/pipeline", label: "Pipeline", icon: KanbanSquare, roles: ["admin", "gestor", "consultor", "bko"] },
  { to: "/operacao-closer", label: "Operação Closer", icon: Handshake, roles: ["admin", "gestor", "bko", "closer", "consultor"] },
  { to: "/suporte", label: "Suporte", icon: LifeBuoy, roles: ["admin", "gestor", "consultor", "bko"], exact: true },
  { to: "/suporte", label: "Meus Suportes", icon: LifeBuoy, roles: ["closer"], exact: true },
  { to: "/comissoes", label: "Comissões", icon: Wallet, roles: ["admin", "gestor", "consultor"] },
  { to: "/meus-clientes", label: "Meus Pedidos", icon: FileText, roles: ["admin", "gestor", "consultor", "bko"] },
  { to: "/equipe", label: "Equipe", icon: UsersRound, roles: ["admin", "gestor", "bko"] },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, roles: ["admin", "gestor"] },
  { to: "/logs-robo", label: "Logs do Robô", icon: Bot, roles: ["admin", "bko", "gestor"] },
  { to: "/importar", label: "Importar", icon: Upload, roles: ["admin"] },
  { to: "/config", label: "Metas TV", icon: Tv2, roles: ["gestor"] },
  { to: "/config", label: "Config.", icon: Settings, roles: ["admin", "bko"] },
];

export function AppShell() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const locationHref = useRouterState({ select: s => s.location.href });
  const { ambiente, setAmbiente, vendas, vendasPipeline } = useOmni();
  const { primaryRole, user } = useAuth();
  const navigate = useNavigate();
  const { comissoesVisible, comissoesEnabled } = useFeatures();
  const visibleNav = NAV.filter(item => (!primaryRole || item.roles.includes(primaryRole))
    && (item.to !== "/comissoes" || comissoesVisible));
  const isBko = primaryRole === "bko";
  const isCloser = primaryRole === "closer";
  const isAcompanhamento = pathname.startsWith("/acompanhamento");
  const isOperacaoCloser = pathname.startsWith("/operacao-closer");
  const [solicitacoesAguardando, setSolicitacoesAguardando] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [visualTheme, setVisualTheme] = useState<"dark" | "light">("dark");
  const [closerCounts, setCloserCounts] = useState({ total: 0, onvox: 0, take: 0 });

  const closerMarca = useMemo<"TODOS" | "ONVOX" | "TAKE_FLOW">(() => {
    const query = locationHref.includes("?") ? locationHref.split("?")[1]?.split("#")[0] ?? "" : "";
    const marca = new URLSearchParams(query).get("marca");
    return marca === "ONVOX" || marca === "TAKE_FLOW" ? marca : "TODOS";
  }, [locationHref]);

  const operatorCounts = useMemo(() => {
    const finais = new Set(["cancelado", "reprovado"]);
    const ativos = vendas.filter(venda => {
      if (venda.statusPedido && finais.has(venda.statusPedido)) return false;
      if (venda.concluidoEm) return false;
      if (venda.etapaId === "s-concluido") return false;
      return true;
    });
    return {
      claro: ativos.filter(venda => venda.operadora === "CLARO").length,
      vivo: ativos.filter(venda => venda.operadora === "VIVO").length,
    };
  }, [vendas]);

  useEffect(() => {
    recordInternalNavigation(locationHref);
  }, [locationHref]);

  useEffect(() => {
    const saved = window.localStorage.getItem("omni-visual-theme");
    const initialTheme = saved === "light" ? "light" : "dark";
    setVisualTheme(initialTheme);

    const root = document.documentElement;
    root.classList.toggle("light", initialTheme === "light");
    root.classList.toggle("dark", initialTheme === "dark");

    return () => {
      // A tela de autenticação mantém o visual escuro original.
      root.classList.remove("light");
      root.classList.add("dark");
    };
  }, []);

  function aplicarTemaVisual(theme: "dark" | "light") {
    setVisualTheme(theme);
    window.localStorage.setItem("omni-visual-theme", theme);
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
  }


  useEffect(() => {
    if (!isBko) {
      setSolicitacoesAguardando(0);
      return;
    }
    let active = true;
    const loadSupportCount = async () => {
      try {
        const count = await getWaitingSupportRequestCount();
        if (active) setSolicitacoesAguardando(count);
      } catch (error) {
        console.error("Erro ao contar solicitações de suporte", error);
      }
    };
    void loadSupportCount();
    const channel = supabase
      .channel("app-shell-support-waiting")
      .on("postgres_changes", { event: "*", schema: "public", table: "suporte_solicitacoes" }, loadSupportCount)
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [isBko]);

  useEffect(() => {
    if (!isOperacaoCloser) {
      setCloserCounts({ total: 0, onvox: 0, take: 0 });
      return;
    }
    if ((primaryRole === "closer" || primaryRole === "consultor") && !user?.id) return;

    let active = true;
    const db = supabase as any;

    const loadCloserCounts = async () => {
      let request = db
        .from("closer_pedidos")
        .select("produto,closer_id");

      if ((primaryRole === "closer" || primaryRole === "consultor") && user?.id) {
        request = request.eq("closer_id", user.id);
      }

      const result = await request;
      if (!active) return;

      if (result.error) {
        console.error("Erro ao carregar totalizadores da Operação Closer", result.error);
        return;
      }

      const rows = result.data ?? [];
      setCloserCounts({
        total: rows.length,
        onvox: rows.filter((row: any) => row.produto === "ONVOX").length,
        take: rows.filter((row: any) => row.produto === "TAKE_FLOW").length,
      });
    };

    void loadCloserCounts();
    const channel = db
      .channel(`app-shell-closer-counts-${primaryRole ?? "guest"}-${user?.id ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "closer_pedidos" }, loadCloserCounts)
      .subscribe();

    return () => {
      active = false;
      db.removeChannel(channel);
    };
  }, [isOperacaoCloser, primaryRole, user?.id]);

  useEffect(() => {
    if (primaryRole && !canAccessRoute(pathname, primaryRole)) {
      const target = landingForRole(primaryRole);
      navigate({ to: target });
    }
  }, [pathname, primaryRole, navigate]);

  return (
    <div className="omni-command-center flex h-screen w-full overflow-hidden bg-background text-foreground" data-ambiente={ambiente}>
      <div className="omni-shell-aurora omni-shell-aurora-a pointer-events-none fixed" />
      <div className="omni-shell-aurora omni-shell-aurora-b pointer-events-none fixed" />
      <div className="omni-shell-stars pointer-events-none fixed inset-0" />

      <aside
        className={cn(
          "omni-sidebar relative hidden h-screen shrink-0 overflow-hidden md:flex flex-col border-r border-border bg-sidebar transition-[width] duration-300 ease-out",
          sidebarCollapsed ? "w-12" : "w-40",
        )}
      >
        <div className={cn("omni-sidebar-brand shrink-0 border-b border-sidebar-border transition-all", sidebarCollapsed ? "px-1 py-2" : "px-2.5 py-2.5")}>
          <Link to={landingForRole(primaryRole)} className="group block">
            {sidebarCollapsed ? (
              <div className="flex flex-col items-center gap-2">
                <div className="grid size-9 place-items-center rounded-xl border border-omni/20 bg-omni/5 font-display text-sm font-black text-white">
                  O
                </div>
                <span className="size-1.5 rounded-full bg-success shadow-[0_0_10px_var(--success)] animate-pulse" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <img
                    src="/brands/omni-official.svg"
                    alt="OMNI Assessoria"
                    className="h-6 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03]"
                    draggable={false}
                  />
                  <span className="h-8 w-px bg-[var(--omni)]/55 shadow-[0_0_14px_var(--omni)]" />
                  <div className="leading-tight">
                    <div className="font-display font-bold text-[11px] tracking-tight text-white">
                      Flow <span className="text-omni">Lab</span>
                    </div>
                    <div className="text-[6px] uppercase tracking-[0.16em] text-muted-foreground">
                      Centro de comando
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-success shadow-[0_0_10px_var(--success)] animate-pulse" />
                  <span className="text-[7px] uppercase tracking-[0.18em] text-white/30">Sistema conectado</span>
                </div>
              </>
            )}
          </Link>
        </div>

        <div className={cn(
          "flex h-8 shrink-0 items-center border-b border-sidebar-border/60",
          sidebarCollapsed ? "justify-center px-1" : "justify-end px-2.5",
        )}>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(value => !value)}
            className="omni-sidebar-toggle grid size-6 place-items-center rounded-full border border-border bg-background/90 text-muted-foreground shadow-sm transition-all hover:border-omni/50 hover:bg-surface-1 hover:text-omni"
            title={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={sidebarCollapsed ? "Expandir menu" : "Recolher menu"}
          >
            {sidebarCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
          </button>
        </div>

        <TooltipProvider delayDuration={120}>
          <nav className={cn("omni-sidebar-nav min-h-0 flex-1 overflow-y-auto overscroll-contain pt-1.5 pb-1.5 space-y-0.5", sidebarCollapsed ? "px-1" : "px-1.5")}>
            {visibleNav.map(item => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const link = (
                <Link
                  to={item.to}
                  className={cn(
                    "omni-nav-item group relative flex items-center rounded-xl text-[11px] font-medium transition-all",
                    sidebarCollapsed ? "h-8 justify-center px-0" : "gap-1.5 px-1.5 py-1.5",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
                  )}
                  aria-label={item.label}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[var(--omni)] shadow-[0_0_12px_var(--omni)]" />
                  )}
                  <item.icon className={cn("size-3.5 shrink-0", active && "text-omni")} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );

              return sidebarCollapsed ? (
                <Tooltip key={item.label + item.to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div key={item.label + item.to}>{link}</div>
              );
            })}
          </nav>
        </TooltipProvider>

        {!isCloser && (
          <div className={cn("shrink-0 border-t border-sidebar-border", sidebarCollapsed ? "p-1" : "p-2")}>
            {sidebarCollapsed ? (
              <TooltipProvider delayDuration={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="grid h-10 place-items-center rounded-xl border border-border bg-surface-1 font-mono text-xs font-black text-omni">
                      {isBko ? solicitacoesAguardando : vendasPipeline.length}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    {isBko ? "Solicitações aguardando BKO" : vendasPipeline.length + " cards ativos"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div className="omni-sidebar-stat glass rounded-2xl p-3">
                <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {isBko ? "Solicitações aguardando criação" : "Carga ativa"}
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold text-omni">
                    {isBko ? solicitacoesAguardando : vendasPipeline.length}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isBko ? "aguardando BKO" : "cards ativos"}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>

      <div className="flex h-screen min-h-0 flex-1 flex-col min-w-0">
        <header className="omni-topbar sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex items-center gap-2.5 px-3 sm:px-4 py-2">
            {isOperacaoCloser ? (
              <div className="omni-operator-switch flex items-center gap-1.5 p-1 rounded-2xl bg-surface-1 border border-border shadow-sm">
                <button
                  type="button"
                  onClick={() => navigate({ to: "/operacao-closer", search: { marca: "TODOS" } })}
                  className={cn(
                    "omni-general-pill h-9 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.13em] transition-all flex items-center gap-1.5",
                    closerMarca === "TODOS"
                      ? "is-active bg-[var(--omni)] text-black shadow-[0_8px_24px_-16px_var(--omni)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
                  )}
                >
                  <span className="size-2 rounded-full bg-current opacity-70" />
                  Geral Closer
                  <span className="min-w-5 rounded-full bg-black/15 px-1.5 py-0.5 text-[9px] leading-none">
                    {closerCounts.total}
                  </span>
                </button>

                <CloserHeaderPill
                  brand="ONVOX"
                  count={closerCounts.onvox}
                  active={closerMarca === "ONVOX"}
                  onClick={() => navigate({ to: "/operacao-closer", search: { marca: "ONVOX" } })}
                />
                <CloserHeaderPill
                  brand="TAKE_FLOW"
                  count={closerCounts.take}
                  active={closerMarca === "TAKE_FLOW"}
                  onClick={() => navigate({ to: "/operacao-closer", search: { marca: "TAKE_FLOW" } })}
                />
              </div>
            ) : !isCloser && !isAcompanhamento ? (
              <div className="omni-operator-switch flex items-center gap-1.5 p-1 rounded-2xl bg-surface-1 border border-border shadow-sm">
                <button
                  type="button"
                  onClick={() => setAmbiente("GERAL")}
                  className={cn(
                    "omni-general-pill h-9 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.13em] transition-all flex items-center gap-1.5",
                    ambiente === "GERAL"
                      ? "is-active bg-[var(--omni)] text-black shadow-[0_8px_24px_-16px_var(--omni)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-2",
                  )}
                >
                  <span className="size-2 rounded-full bg-current opacity-70" />
                  Geral OMNI
                </button>
                <OperatorBrandPill brand="CLARO" count={operatorCounts.claro} active={ambiente === "CLARO"} onClick={() => setAmbiente("CLARO")} />
                <OperatorBrandPill brand="VIVO" count={operatorCounts.vivo} active={ambiente === "VIVO"} onClick={() => setAmbiente("VIVO")} />
              </div>
            ) : null}

            <div className="flex-1" />

            <GlobalSearch isCloser={isCloser} />

            {isBko ? (
              <>
                <NotifBell canal="closer" label="Operação Closer" />
                <NotifBell canal="operadoras" label="PABX / Claro e Vivo" />
              </>
            ) : (
              <>
                <PushToggle />
                <NotifBell />
              </>
            )}
            <UserMenu visualTheme={visualTheme} onThemeChange={aplicarTemaVisual} />
          </div>
        </header>

        <main className="omni-main min-h-0 flex-1 min-w-0 overflow-y-auto overscroll-contain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}


function CloserHeaderPill({
  brand,
  count,
  active,
  onClick,
}: {
  brand: "ONVOX" | "TAKE_FLOW";
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const label = brand === "ONVOX" ? "ONVOX" : "TAKE";
  const activeSurface = brand === "ONVOX"
    ? "linear-gradient(135deg, rgba(217,47,160,.95), rgba(122,47,211,.9))"
    : "linear-gradient(135deg, rgba(113,55,165,.96), rgba(43,180,94,.72))";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[10px] font-black uppercase tracking-[0.12em] transition-all",
        active
          ? "text-white shadow-sm"
          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
      )}
      style={active ? { background: activeSurface } : undefined}
    >
      <BrandLogo
        brand={brand}
        className="h-3.5 max-w-[64px]"
        imageClassName="h-full w-auto"
      />
      <span className="sr-only">{label}</span>
      <span className={cn(
        "min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] leading-none",
        active ? "bg-black/20 text-white" : "bg-surface-2 text-muted-foreground",
      )}>
        {count}
      </span>
    </button>
  );
}


type GlobalSearchResult = {
  id: string;
  numero: string;
  cliente: string;
  cnpj: string;
  operadora: string;
  detalhe?: string;
  closer?: boolean;
};

function cleanSearchTerm(value: string) {
  return value.trim().replace(/[%(),]/g, "");
}

function GlobalSearch({ isCloser }: { isCloser: boolean }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const term = cleanSearchTerm(query);
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const db = supabase as any;

        if (isCloser) {
          const [pedidosResult, clientesResult] = await Promise.all([
            db
              .from("closer_pedidos")
              .select("id,numero,produto,etapa,cliente_id,closer_clientes(cnpj,razao_social)")
              .order("updated_at", { ascending: false })
              .limit(100),
            db
              .from("closer_clientes")
              .select("id,cnpj,razao_social")
              .or(`razao_social.ilike.%${term}%,cnpj.ilike.%${term}%`)
              .limit(20),
          ]);

          if (pedidosResult.error) throw pedidosResult.error;
          if (clientesResult.error) throw clientesResult.error;

          const clienteIds = new Set((clientesResult.data ?? []).map((row: any) => row.id));
          const compact = term.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

          const rows = (pedidosResult.data ?? []).filter((row: any) => {
            const cliente = row.closer_clientes;
            const numero = String(row.numero ?? "");
            const cnpj = String(cliente?.cnpj ?? "");
            const cnpjCompact = cnpj.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
            return numero.includes(term)
              || String(cliente?.razao_social ?? "").toLowerCase().includes(term.toLowerCase())
              || cnpj.toLowerCase().includes(term.toLowerCase())
              || (compact.length >= 3 && cnpjCompact.includes(compact))
              || clienteIds.has(row.cliente_id);
          }).slice(0, 8).map((row: any) => ({
            id: row.id,
            numero: `#${String(row.numero ?? "—").padStart(4, "0")}`,
            cliente: row.closer_clientes?.razao_social ?? "Cliente não informado",
            cnpj: row.closer_clientes?.cnpj ?? "—",
            operadora: row.produto === "TAKE_FLOW" ? "Take Flow" : "ONVOX",
            detalhe: row.etapa ?? "",
            closer: true,
          })) as GlobalSearchResult[];

          if (active) {
            setResults(rows);
            setOpen(true);
          }
          return;
        }

        const like = `%${term}%`;
        const compact = term.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
        const compactLike = `%${compact}%`;

        const baseSelect = "id,numero,numero_pedido,cliente_razao_social,cliente_cnpj,operadora,tipo_pedido,produto";
        const [numeroRes, pedidoRes, clienteRes, cnpjRes, cnpjCompactRes, linhasRes] = await Promise.all([
          db.from("vendas").select(baseSelect).is("deleted_at", null).ilike("numero", like).limit(8),
          db.from("vendas").select(baseSelect).is("deleted_at", null).ilike("numero_pedido", like).limit(8),
          db.from("vendas").select(baseSelect).is("deleted_at", null).ilike("cliente_razao_social", like).limit(8),
          db.from("vendas").select(baseSelect).is("deleted_at", null).ilike("cliente_cnpj", like).limit(8),
          compact.length >= 3
            ? db.from("vendas").select(baseSelect).is("deleted_at", null).ilike("cliente_cnpj", compactLike).limit(8)
            : Promise.resolve({ data: [], error: null }),
          db.from("venda_linhas").select("venda_id,numero").ilike("numero", like).limit(12),
        ]);

        for (const response of [numeroRes, pedidoRes, clienteRes, cnpjRes, cnpjCompactRes, linhasRes]) {
          if (response.error) throw response.error;
        }

        const lineVendaIds = Array.from(new Set((linhasRes.data ?? []).map((row: any) => row.venda_id).filter(Boolean)));
        const lineVendaRes = lineVendaIds.length
          ? await db.from("vendas").select(baseSelect).is("deleted_at", null).in("id", lineVendaIds).limit(8)
          : { data: [], error: null };

        if (lineVendaRes.error) throw lineVendaRes.error;

        const lineByVenda = new Map<string, string[]>();
        for (const row of linhasRes.data ?? []) {
          const list = lineByVenda.get(row.venda_id) ?? [];
          if (row.numero) list.push(String(row.numero));
          lineByVenda.set(row.venda_id, list);
        }

        const unique = new Map<string, any>();
        for (const source of [numeroRes.data, pedidoRes.data, clienteRes.data, cnpjRes.data, cnpjCompactRes.data, lineVendaRes.data]) {
          for (const row of source ?? []) {
            if (!unique.has(row.id)) unique.set(row.id, row);
          }
        }

        const rows = Array.from(unique.values()).slice(0, 8).map((row: any) => {
          const linhas = lineByVenda.get(row.id) ?? [];
          return {
            id: row.id,
            numero: row.numero || row.numero_pedido || "Pedido",
            cliente: row.cliente_razao_social || "Cliente não informado",
            cnpj: row.cliente_cnpj || "—",
            operadora: row.operadora || "—",
            detalhe: linhas.length ? `Linha: ${linhas.slice(0, 2).join(", ")}` : [row.tipo_pedido, row.produto].filter(Boolean).join(" · "),
            closer: false,
          } as GlobalSearchResult;
        });

        if (active) {
          setResults(rows);
          setOpen(true);
        }
      } catch (error) {
        console.error("[Busca global]", error);
        if (active) {
          setResults([]);
          setOpen(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, isCloser]);

  const goToResult = (result: GlobalSearchResult) => {
    setOpen(false);
    setQuery("");
    if (result.closer) {
      navigate({ to: "/operacao-closer/$id", params: { id: result.id } });
    } else {
      navigate({ to: "/vendas/$id", params: { id: result.id } });
    }
  };

  return (
    <div className="relative hidden md:block w-72">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground z-10" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => query.trim().length >= 2 && setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 180)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results[0]) {
            event.preventDefault();
            goToResult(results[0]);
          }
          if (event.key === "Escape") setOpen(false);
        }}
        placeholder={isCloser ? "Buscar cliente, CNPJ ou pedido…" : "Buscar venda, cliente, CNPJ, linha…"}
        className="omni-global-search pl-8 h-9 bg-surface-1 border-border"
      />

      {open && query.trim().length >= 2 && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-[100] w-[420px] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
          <div className="border-b border-border px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
            {loading ? "Buscando…" : `${results.length} resultado(s)`}
          </div>

          {!loading && results.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nenhum pedido encontrado para “{query.trim()}”.
            </div>
          )}

          <div className="max-h-[360px] overflow-y-auto">
            {results.map((result) => (
              <button
                key={(result.closer ? "closer-" : "telecom-") + result.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => goToResult(result)}
                className="flex w-full items-start gap-3 border-b border-border/70 px-3 py-3 text-left transition-colors last:border-0 hover:bg-surface-1"
              >
                <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-omni/10 text-omni">
                  <Search className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-omni">{result.numero}</span>
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-muted-foreground">
                      {result.operadora}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs font-semibold">{result.cliente}</div>
                  <div className="mt-0.5 flex items-center gap-2 truncate text-[10px] text-muted-foreground">
                    <span className="font-mono">{result.cnpj}</span>
                    {result.detalhe && <span>· {result.detalhe}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {results.length > 0 && (
            <div className="border-t border-border bg-surface-1/60 px-3 py-2 text-[9px] text-muted-foreground">
              Clique em um resultado ou pressione Enter para abrir o primeiro.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UserMenu({
  visualTheme,
  onThemeChange,
}: {
  visualTheme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
}) {
  const { user, profile, primaryRole, signOut } = useAuth();
  const navigate = useNavigate();
  const nome = profile?.nome_completo || user?.email?.split("@")[0] || "Usuário";
  const iniciais = nome.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  const role = primaryRole;
  const [empresasOpen, setEmpresasOpen] = useState(false);

  async function handleLogout() {
    clearNavigationMemory();
    await signOut();
    navigate({ to: "/auth" });
  }

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="omni-user-trigger flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-surface-1 transition-colors">
          <div className="omni-user-avatar size-8 rounded-full bg-gradient-to-br from-[var(--omni)] to-[var(--warning)] grid place-items-center text-black font-bold text-xs">
            {iniciais}
          </div>
          <div className="hidden lg:block leading-tight text-left">
            <div className="text-xs font-semibold truncate max-w-[140px]">{nome}</div>
            <div className="flex items-center gap-1 mt-0.5">
              {role && (
                <span className={cn("text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold", ROLE_COLOR[role])}>
                  {ROLE_LABEL[role]}
                </span>
              )}
            </div>
          </div>
          <ChevronDown className="size-3 text-muted-foreground hidden lg:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="font-semibold">{nome}</span>
          <span className="text-xs text-muted-foreground font-normal truncate">{user?.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/auth/nova-senha" })}>
          <UserIcon className="size-4 mr-2" /> Alterar minha senha
        </DropdownMenuItem>
        <div className="px-2 py-1.5">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-surface-1 p-1">
            <button
              type="button"
              onClick={() => onThemeChange("light")}
              className={cn(
                "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[10px] font-medium transition-colors",
                visualTheme === "light"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
              aria-pressed={visualTheme === "light"}
            >
              <Sun className="size-3.5" />
              Claro
            </button>
            <button
              type="button"
              onClick={() => onThemeChange("dark")}
              className={cn(
                "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2 text-[10px] font-medium transition-colors",
                visualTheme === "dark"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
              aria-pressed={visualTheme === "dark"}
            >
              <Moon className="size-3.5" />
              Escuro
            </button>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setEmpresasOpen(true)}>
          <Building2 className="size-4 mr-2" /> Minhas Empresas
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="size-4 mr-2" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <Dialog open={empresasOpen} onOpenChange={setEmpresasOpen}>
      <DialogContent className="flex h-[94dvh] w-[min(97vw,1500px)] max-w-[1500px] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-omni" /> Minhas Empresas
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <MeusClientesEmpresasPanel />
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

const NOTIF_ICON: Record<string, React.ReactNode> = {
  sla_alerta: <AlertTriangle className="size-3.5" />,
  sla_estouro: <Zap className="size-3.5" />,
  nova_venda: <FileText className="size-3.5" />,
  ticket_novo: <LifeBuoy className="size-3.5" />,
  suporte_solicitacao: <Inbox className="size-3.5" />,
  suporte_mensagem: <MessageCircle className="size-3.5" />,
};

const NOTIF_BRAND_COLOR: Record<string, string> = {
  ONVOX: "#D92FA0",
  TAKE_FLOW: "#7A3DA8",
  CLARO: "#E30613",
  VIVO: "#7A2CF3",
  PABX: "#FEA801",
};

function NotifBell({
  canal,
  label = "Notificações",
}: {
  canal?: NotificationChannel;
  label?: string;
}) {
  const { items, naoLidas, marcarLida, marcarTodas, remover } = useNotificacoes(canal ? 30 : 10, canal);
  const navigate = useNavigate();
  const [detailsNotification, setDetailsNotification] = useState<Notificacao | null>(null);
  const unreadBrands = Array.from(new Set(
    items.filter((item) => !item.lida && item.marca).map((item) => String(item.marca)),
  ));
  const primaryUnreadColor = unreadBrands.length === 1 ? NOTIF_BRAND_COLOR[unreadBrands[0]] : undefined;

  return (
    <>
      <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          title={label}
          style={primaryUnreadColor ? { color: primaryUnreadColor } : undefined}
        >
          <Bell className={cn("size-4", naoLidas > 0 && "drop-shadow-[0_0_8px_currentColor]")} />
          {canal ? (
            unreadBrands.length > 0 && (
              <span className="absolute -right-1 -top-1 flex items-center gap-0.5 rounded-full border border-background bg-background/95 p-0.5">
                {unreadBrands.slice(0, 3).map((brand) => (
                  <span
                    key={brand}
                    className="size-2 rounded-full animate-pulse"
                    style={{
                      backgroundColor: NOTIF_BRAND_COLOR[brand] ?? "#FEA801",
                      boxShadow: `0 0 8px ${NOTIF_BRAND_COLOR[brand] ?? "#FEA801"}`,
                    }}
                  />
                ))}
              </span>
            )
          ) : naoLidas > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold grid place-items-center pulse-ring">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div>
            <div className="font-display font-semibold text-sm">{label}</div>
            <div className="text-[10px] text-muted-foreground">{naoLidas} não lidas</div>
          </div>
          {naoLidas > 0 && (
            <button onClick={marcarTodas} className="text-[10px] text-omni hover:underline flex items-center gap-1">
              <CheckCheck className="size-3" /> Marcar lidas
            </button>
          )}
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {items.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground italic">Sem notificações.</div>
          )}
          {items.map((n) => {
            const brandColor = n.marca ? NOTIF_BRAND_COLOR[String(n.marca)] : undefined;
            return (
              <div
                key={n.id}
                className={cn(
                  "group/notif relative border-b border-border last:border-0 transition-colors hover:bg-surface-1",
                  !n.lida && "bg-omni/5",
                )}
              >
                <button
                  type="button"
                  onClick={() => { void marcarLida(n.id); if (n.link) navigate({ to: n.link }); }}
                  className="flex w-full items-start gap-2 px-3 py-2.5 pr-14 text-left"
                >
                  <div
                    className={cn(
                      "size-7 rounded-md grid place-items-center shrink-0",
                      !brandColor && (
                        n.criticidade === "alta" ? "bg-destructive/15 text-destructive" :
                        n.criticidade === "media" ? "bg-warning/15 text-warning" :
                        "bg-info/15 text-info"
                      ),
                    )}
                    style={brandColor ? {
                      color: brandColor,
                      backgroundColor: `${brandColor}18`,
                      boxShadow: !n.lida ? `inset 0 0 0 1px ${brandColor}33` : undefined,
                    } : undefined}
                  >
                    {NOTIF_ICON[n.tipo] ?? <Bell className="size-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="text-xs font-semibold truncate">{n.titulo}</div>
                      {n.marca && brandColor && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider"
                          style={{ color: brandColor, backgroundColor: `${brandColor}18` }}
                        >
                          {String(n.marca).replace("_", " ")}
                        </span>
                      )}
                    </div>
                    {n.descricao && <div className="text-[10px] text-muted-foreground truncate">{n.descricao}</div>}
                  </div>
                  {!n.lida && (
                    <span
                      className="size-1.5 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: brandColor ?? "var(--omni)" }}
                    />
                  )}
                </button>
                {(n.tipo === "pedido_alterado_grupo" || n.tipo === "pedido_alterado_importante") && (
                  <button
                    type="button"
                    aria-label="Ver alterações"
                    title="Ver alterações"
                    onClick={(event) => {
                      event.stopPropagation();
                      void marcarLida(n.id);
                      setDetailsNotification(n);
                    }}
                    className="absolute right-8 top-2 grid size-5 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  >
                    <Eye className="size-3" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Remover notificação"
                  title="Remover notificação"
                  onClick={(event) => {
                    event.stopPropagation();
                    void remover(n.id);
                  }}
                  className="absolute right-2 top-2 grid size-5 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover/notif:opacity-100 focus:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
        {!canal && (
          <div className="border-t border-border p-2">
            <button onClick={() => navigate({ to: "/notificacoes" })} className="w-full text-xs text-center py-1.5 rounded-md hover:bg-surface-1 transition-colors text-muted-foreground hover:text-foreground">
              Ver todas →
            </button>
          </div>
        )}
      </DropdownMenuContent>
      </DropdownMenu>
      <NotificationDetailsDialog
        notification={detailsNotification}
        open={Boolean(detailsNotification)}
        onOpenChange={(open) => !open && setDetailsNotification(null)}
      />
    </>
  );
}

function PushToggle() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
      const { pushSupported } = await import("@/lib/push-client");
      if (!pushSupported()) return;
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (mounted) setEnabled(!!sub && Notification.permission === "granted");
    })();
    return () => { mounted = false; };
  }, [user]);

  async function toggle() {
    if (busy || !user) return;
    setBusy(true);
    try {
      const { pushSupported, subscribeToPush, subscriptionToJSON, unsubscribeFromPush } = await import("@/lib/push-client");
      const { salvarPushSubscription, removerPushSubscription } = await import("@/lib/push.functions");
      if (!pushSupported()) {
        const { toast } = await import("sonner");
        toast.error("Notificações push não suportadas neste navegador.");
        return;
      }
      if (enabled) {
        const endpoint = await unsubscribeFromPush();
        if (endpoint) await removerPushSubscription({ data: { endpoint } });
        setEnabled(false);
      } else {
        const sub = await subscribeToPush();
        if (!sub) {
          const { toast } = await import("sonner");
          toast.error("Permissão de notificação negada.");
          return;
        }
        const j = subscriptionToJSON(sub);
        await salvarPushSubscription({ data: { ...j, userAgent: navigator.userAgent } });
        setEnabled(true);
        const { toast } = await import("sonner");
        toast.success("Notificações push ativadas.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title={enabled ? "Notificações ativas" : "Ativar notificações push"}
      className={cn(enabled && "text-omni")}
    >
      <BellRing className="size-4" />
    </Button>
  );
}
