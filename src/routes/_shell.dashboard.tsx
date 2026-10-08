import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useOmni } from "@/lib/omni-store";
import { useAuth } from "@/lib/auth";
import { useFeatures } from "@/lib/features";
import { useMemo, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMinhasMetas } from "@/lib/comissoes.functions";
import { getDashboardData } from "@/lib/dashboard.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  MESES_LONG, MESES_PT, brl, FUNIS,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { getSlaState } from "@/lib/status-sla";
import {
  TrendingUp, Banknote, Hash, AlertTriangle, Zap,
  Activity, Award, Target, ArrowUpRight, ArrowDownRight, Flame,
  Lightbulb, Lock, Unlock, Trophy, Sparkles, CalendarCheck, Workflow,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ErrorBoundary } from "@/components/error-boundary";
import { BRAND_META, BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/_shell/dashboard")({
  component: DashboardPage,
});

interface MetaRow {
  id: string;
  nome: string;
  mes_ref: number;
  ano_ref: number;
  valor_meta: number;
  valor_vendido: number;
  status: string;
  operadora: string | null;
  produto: string | null;
}

function DashboardPage() {
  const { ambiente, mesRef, anoRef, vendas: vendasRealtime } = useOmni();
  const { primaryRole, user } = useAuth();
  const navigate = useNavigate();
  const { comissoesVisible } = useFeatures();

  const fetchDashboardData = useServerFn(getDashboardData);
  const [data, setData] = useState<{
    vendas: any[];
    colaboradores: Record<string, string>;
    role: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const vendasRealtimeRevision = useMemo(
    () => vendasRealtime
      .map(v => [
        v.id,
        v.atualizadoEm ?? "",
        v.etapaId,
        v.statusPedido ?? "",
        v.concluidoEm ?? "",
        v.dataAtivacao ?? "",
      ].join(":"))
      .join("|"),
    [vendasRealtime],
  );

  useEffect(() => {
    if (primaryRole === "bko") {
      navigate({ to: "/suporte" });
      return;
    }

    if (primaryRole === "closer") {
      navigate({ to: "/operacao-closer" });
      return;
    }

    setLoading(true);
    fetchDashboardData({ data: { mes: mesRef, ano: anoRef, ambiente } } as any)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        console.error("Dashboard error:", err);
        // If unauthorized/unauthenticated, we might want to redirect to login
        // But the middleware should have handled the 401 redirect if configured
        if (err.message?.includes("Unauthorized")) {
          navigate({ to: "/auth" });
        }
        setLoading(false);
      });
  }, [primaryRole, navigate, mesRef, anoRef, ambiente, fetchDashboardData, vendasRealtimeRevision]);

  const allVendas = useMemo(() => {
    if (!data?.vendas) return [];
    // Mapear campos do banco para o formato VendaLike esperado pelos componentes legados
    return data.vendas.map(v => ({
      id: v.id,
      numero: v.numero,
      operadora: v.operadora,
      receita: Number(v.valor || 0),
      valor: Number(v.valor || 0),
      quantidadeLinhas: Number(v.quantidade_linhas || 0),
      quantidade_linhas: Number(v.quantidade_linhas || 0),
      statusPedido: v.status_pedido,
      status_pedido: v.status_pedido,
      dataAtivacao: v.data_ativacao,
      data_ativacao: v.data_ativacao,
      mesRef: v.mes_ref,
      mes_ref: v.mes_ref,
      anoRef: v.ano_ref,
      ano_ref: v.ano_ref,
      consultorId: v.consultor_id,
      consultor_id: v.consultor_id,
      funil: v.funil,
      etapa_id: v.etapa_id,
      etapaId: v.etapa_id,
      slaStatus: v.sla_status,
      sla_status: v.sla_status,
      produto: v.produto,
      tipoPedido: v.tipo_pedido,
      concluidoEm: v.concluido_em,
      statusComercialEm: v.status_comercial_em,
      slaHorasAtual: v.sla_horas_atual,
      slaDueAt: v.sla_due_at,
    }));

  }, [data?.vendas]);

  const isConsultor = data?.role === "consultor";
  const canSeeTeamDashboard = data?.role === "admin" || data?.role === "gestor";

  const vendasAtivadasMes = useMemo(() => {
    return allVendas.filter(v => {
      if (!v.dataAtivacao) return false;
      const d = new Date(v.dataAtivacao);
      return d.getMonth() + 1 === mesRef && d.getFullYear() === anoRef;
    });
  }, [allVendas, mesRef, anoRef]);

  const vendasPipeline = useMemo(() => {
    return allVendas.filter(v => !v.concluidoEm);
  }, [allVendas]);

  const kpis = useMemo(() => {
    const totalAtivadas = vendasAtivadasMes.length;
    const claro = vendasAtivadasMes.filter(v => v.operadora === "CLARO").length;
    const vivo = vendasAtivadasMes.filter(v => v.operadora === "VIVO").length;
    const receita = vendasAtivadasMes.reduce((s, v) => s + v.receita, 0);
    const linhas = vendasAtivadasMes.reduce((s, v) => s + v.quantidadeLinhas, 0);
    const agora = Date.now();
    const atrasadas = vendasPipeline.filter(v => {
      const slaComercialVencido = getSlaState({
        startedAt: v.statusComercialEm,
        slaHours: v.slaHorasAtual,
      }) === "vermelho";
      const slaEtapaVencido = v.slaDueAt
        ? new Date(v.slaDueAt).getTime() < agora
        : false;
      return slaComercialVencido || slaEtapaVencido;
    }).length;
    return { totalAtivadas, claro, vivo, receita, linhas, atrasadas };
  }, [vendasAtivadasMes, vendasPipeline]);

  const porFunil = useMemo(() =>
    FUNIS.map(f => ({
      name: f.nome,
      value: vendasPipeline.filter(v => v.funil === f.id).length,
      fill: f.id === "prospeccao" ? "var(--purple)" : f.id === "followup" ? "var(--info)" : f.id === "processos_bko" ? "var(--warning)" : f.id === "assinatura" ? "var(--omni)" : "var(--success)",
    })), [vendasPipeline]);

  const porMes = useMemo(() => {
    const hoje = new Date(anoRef, mesRef - 1, 1);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const filt = allVendas.filter(v => {
        if (!v.dataAtivacao) return false;
        const dd = new Date(v.dataAtivacao);
        const vm = dd.getMonth() + 1;
        const vy = dd.getFullYear();
        return vm === m && vy === y;
      });
      return {
        mes: MESES_PT[m - 1],
        Claro: filt.filter(v => v.operadora === "CLARO").reduce((s, v) => s + v.receita, 0),
        Vivo: filt.filter(v => v.operadora === "VIVO").reduce((s, v) => s + v.receita, 0),
      };
    });
  }, [allVendas, mesRef, anoRef]);

  const ranking = useMemo(() => {
    if (!canSeeTeamDashboard || !data?.colaboradores) return [];
    const map = new Map<string, { nome: string; receita: number; vendas: number; cor: string }>();
    vendasAtivadasMes.forEach(v => {
      const consultorId = v.consultorId;
      if (!consultorId) return;
      const nome = data.colaboradores[consultorId] || "Desconhecido";
      const cur = map.get(consultorId) ?? { nome, receita: 0, vendas: 0, cor: "omni" };
      cur.receita += v.receita;
      cur.vendas += 1;
      map.set(consultorId, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.receita - a.receita).slice(0, 6);
  }, [vendasAtivadasMes, canSeeTeamDashboard, data?.colaboradores]);



  const opPie = [
    { name: "Claro", value: kpis.claro, fill: "var(--claro)" },
    { name: "Vivo", value: kpis.vivo, fill: "var(--vivo)" },
  ];

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Activity className="size-8 text-omni animate-pulse" />
          <p className="text-sm text-muted-foreground animate-pulse font-mono uppercase tracking-widest">Sincronizando Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">


      {/* HERO */}
      <div
        className="relative overflow-hidden rounded-3xl border border-border p-6 bg-grid"
        style={ambiente === "GERAL" ? undefined : {
          background: `linear-gradient(135deg, color-mix(in srgb, ${BRAND_META[ambiente].accent} 12%, var(--card)) 0%, var(--card) 62%)`,
        }}
      >
        <div className="absolute -top-32 -right-32 size-64 rounded-full bg-[var(--omni)]/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 size-48 rounded-full bg-[var(--vivo)]/10 blur-3xl" />
        {ambiente !== "GERAL" && (
          <img
            src={BRAND_META[ambiente].src}
            alt=""
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -right-10 -bottom-12 opacity-[0.055]",
              ambiente === "CLARO" ? "h-64" : "h-44",
            )}
          />
        )}
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-omni font-semibold mb-1 flex items-center gap-2">
              <Activity className="size-3" /> Centro de Comando
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">
              {ambiente === "GERAL" ? "Visão Geral OMNI" : `Ambiente ${ambiente}`}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {MESES_LONG[mesRef - 1]} / {anoRef} · competência por ativação
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {ambiente === "GERAL" ? (
              <>
                <span className="inline-flex h-14 items-center rounded-2xl border border-[var(--claro)]/20 bg-white px-4 shadow-sm">
                  <BrandLogo brand="CLARO" className="h-10 max-w-[76px]" imageClassName="h-full w-auto" />
                </span>
                <span className="inline-flex h-14 items-center rounded-2xl border border-[var(--vivo)]/20 bg-white px-4 shadow-sm">
                  <BrandLogo brand="VIVO" className="h-8 max-w-[112px]" imageClassName="h-full w-auto" />
                </span>
              </>
            ) : (
              <span className="inline-flex h-16 items-center rounded-2xl border border-white/15 bg-white px-5 shadow-lg">
                <BrandLogo
                  brand={ambiente}
                  className={ambiente === "CLARO" ? "h-12 max-w-[92px]" : "h-9 max-w-[132px]"}
                  imageClassName="h-full w-auto"
                />
              </span>
            )}
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2 backdrop-blur-sm">
              <div className="size-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-muted-foreground font-mono">SISTEMA ONLINE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Minha Meta do Mês (consultor) */}
      {isConsultor && comissoesVisible && (
        <ErrorBoundary name="Meta do Mês">
          <MinhaMetaCard mesRef={mesRef} anoRef={anoRef} />
        </ErrorBoundary>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Ativadas no mês" value={String(kpis.totalAtivadas)} icon={<TrendingUp />} delta="mês" up tone="omni" />
        {comissoesVisible && <Kpi label="Receita ativada" value={brl(kpis.receita)} icon={<Banknote />} delta="competência" up tone="success" />}
        <Kpi label="Linhas ativadas" value={String(kpis.linhas)} icon={<Hash />} delta="no mês" up tone="info" />
        <Kpi label="Atrasadas (pipeline)" value={String(kpis.atrasadas)} icon={<AlertTriangle />} delta="ativos" up={false} tone="destructive" />
      </div>

      {canSeeTeamDashboard && (
        <>
        {/* Mid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {comissoesVisible && (
            <Panel 
              title="Receita Claro × Vivo" 
              subtitle="Ativações por mês (últimos 6)" 
              className="lg:col-span-2"
              isEmpty={porMes.every(d => d.Claro === 0 && d.Vivo === 0)}
              emptyMessage="Nenhuma receita registrada nestes meses."
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={porMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => brl(v)}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Claro" fill="var(--claro)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Vivo" fill="var(--vivo)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>
          )}

        </div>
        </>
      )}

      {/* Bottom row */}
      {canSeeTeamDashboard && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Panel 
            title="Operadoras" 
            subtitle="Mix de ativações do mês"
            isEmpty={kpis.totalAtivadas === 0}
            emptyMessage="Sem ativações para exibir este gráfico."
          >
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={opPie} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={4} stroke="none">
                  {opPie.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Panel>

          <Panel 
            title="Ranking de Consultores" 
            subtitle="Ativações do mês" 
            className="lg:col-span-2"
            isEmpty={ranking.length === 0}
            emptyMessage="Sem ativações neste mês ainda."
          >
            <div className="space-y-2.5">
              {ranking.map((r, i) => (
                <div key={r.nome} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-1 transition-colors">
                  <div className={cn(
                    "size-7 rounded-lg grid place-items-center text-xs font-bold font-display",
                    i === 0 ? "bg-[var(--omni)] text-black" : "bg-surface-2 text-muted-foreground"
                  )}>
                    {i + 1}
                  </div>
                  <div className={cn("size-8 rounded-full grid place-items-center text-[10px] font-bold text-black", `bg-omni`)}>
                    {r.nome.split(" ").map(x => x[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{r.nome}</div>
                    <div className="text-[10px] text-muted-foreground">{r.vendas} ativações</div>
                  </div>
                  {comissoesVisible && (
                    <div className="text-right">
                      <div className="text-sm font-bold text-success font-mono">{brl(r.receita)}</div>
                      <div className="h-1 w-20 rounded-full bg-surface-2 mt-1 overflow-hidden">
                        <div className="h-full bg-[var(--omni)]" style={{ width: `${Math.min(100, (r.receita / (ranking[0]?.receita || 1)) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {canSeeTeamDashboard && (
        <>
        {/* Alerts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="Em prospecção" value={porFunil[0].value} icon={<Target className="size-4" />} tone="purple" />
          <MiniStat label="Em follow up" value={porFunil[1].value} icon={<Activity className="size-4" />} tone="info" />
          <MiniStat label="Em BKO" value={porFunil[2].value} icon={<Workflow className="size-4" />} tone="warning" />
          <MiniStat label="Em assinatura" value={porFunil[3].value} icon={<Award className="size-4" />} tone="omni" />
          <MiniStat label="Em suporte" value={porFunil[4].value} icon={<Zap className="size-4" />} tone="success" />
        </div>
        </>
      )}

      {/* Wave 4: Insights Mensais + Fechamento */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ErrorBoundary name="Insights Mensais">
          <InsightsMensais
            vendas={allVendas}
            ambiente={ambiente}
            mesRef={mesRef}
            anoRef={anoRef}
            isConsultor={isConsultor}
            colaboradores={data?.colaboradores}
            comissoesVisible={comissoesVisible}
            className={cn(isConsultor && !comissoesVisible ? "lg:col-span-3" : "lg:col-span-2")}
          />
        </ErrorBoundary>
        {comissoesVisible && (
          <ErrorBoundary name="Fechamento Mensal">
            <FechamentoMensalCard mesRef={mesRef} anoRef={anoRef} />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}

function MinhaMetaCard({ mesRef, anoRef }: { mesRef: number; anoRef: number }) {
  const fetchMetas = useServerFn(listMinhasMetas);
  const [metas, setMetas] = useState<MetaRow[]>([]);

  useEffect(() => {
    fetchMetas().then(d => setMetas((d as unknown as MetaRow[]) ?? [])).catch(() => setMetas([]));
  }, [fetchMetas]);

  const meta = useMemo(
    () => metas.find(m => m.mes_ref === mesRef && m.ano_ref === anoRef && !m.operadora && !m.produto)
      ?? metas.find(m => m.mes_ref === mesRef && m.ano_ref === anoRef),
    [metas, mesRef, anoRef],
  );

  if (!meta) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="size-10 rounded-lg bg-surface-2 grid place-items-center text-muted-foreground">
          <Flame className="size-5" />
        </div>
        <div>
          <div className="text-sm font-semibold">Minha Meta do Mês</div>
          <div className="text-xs text-muted-foreground">
            Nenhuma meta cadastrada para {MESES_LONG[mesRef - 1]}/{anoRef}. Fale com seu gestor.
          </div>
        </div>
      </div>
    );
  }

  const pct = meta.valor_meta > 0 ? Math.min(999, (meta.valor_vendido / meta.valor_meta) * 100) : 0;
  const batida = meta.status === "batida" || pct >= 100;
  const restante = Math.max(0, meta.valor_meta - meta.valor_vendido);
  const proj10 = Math.round((restante * 0.10) * 100) / 100; // 10% base
  const proj20 = Math.round((meta.valor_vendido * 0.20 + (batida ? 0 : restante * 0.20)) * 100) / 100;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border p-5 transition-all",
      batida
        ? "border-[var(--omni)]/60 bg-gradient-to-br from-[var(--omni)]/15 via-black/30 to-black text-foreground"
        : "border-[var(--omni)]/40 bg-gradient-to-br from-[var(--omni)]/20 via-[var(--omni)]/5 to-transparent",
    )}>
      <div className="absolute -top-16 -right-10 size-48 rounded-full bg-[var(--omni)]/20 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Flame className={cn("size-4", batida ? "text-[var(--omni)]" : "text-omni")} />
            <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-omni">
              Minha Meta do Mês
            </span>
            {batida && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[var(--omni)] text-black uppercase tracking-wider">
                Batida · comissão 20%
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight truncate">
            {meta.nome}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {MESES_LONG[meta.mes_ref - 1]}/{meta.ano_ref}
            {meta.operadora ? ` · ${meta.operadora}` : ""}
            {meta.produto ? ` · ${meta.produto}` : ""}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Progresso</div>
          <div className="font-display text-3xl font-bold text-[var(--omni)] font-mono">
            {pct.toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="h-3 rounded-full bg-surface-2 overflow-hidden">
          <div
            className={cn("h-full transition-all", batida ? "bg-[var(--omni)]" : "bg-gradient-to-r from-[var(--omni)]/70 to-[var(--omni)]")}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className="text-muted-foreground font-mono">{brl(meta.valor_vendido)}</span>
          <span className="text-foreground font-semibold font-mono">{brl(meta.valor_meta)}</span>
        </div>
      </div>

      <div className="relative grid grid-cols-3 gap-3 mt-5">
        <div className="rounded-lg bg-black/30 border border-border/50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Faltam</div>
          <div className="font-display text-lg font-bold font-mono">{brl(restante)}</div>
        </div>
        <div className="rounded-lg bg-black/30 border border-border/50 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Comissão 10%</div>
          <div className="font-display text-lg font-bold text-success font-mono">
            {brl(Math.round(meta.valor_vendido * 0.10 * 100) / 100)}
          </div>
          <div className="text-[10px] text-muted-foreground">+ {brl(proj10)} se completar</div>
        </div>
        <div className="rounded-lg bg-black/30 border border-[var(--omni)]/30 p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--omni)]">Se bater · 20%</div>
          <div className="font-display text-lg font-bold text-[var(--omni)] font-mono">
            {brl(proj20)}
          </div>
          <div className="text-[10px] text-muted-foreground">projeção total</div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, delta, up, tone }: {
  label: string; value: string; icon: React.ReactNode; delta: string; up: boolean; tone: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 hover:border-[var(--omni)]/30 transition-all">
      <div className={cn("absolute -top-6 -right-6 size-20 rounded-full opacity-10 blur-2xl", `bg-[var(--${tone})]`)} />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">{label}</span>
        <div className={cn("size-7 rounded-lg grid place-items-center", `bg-[var(--${tone})]/15 text-[var(--${tone})]`)}>
          <span className="*:size-4">{icon}</span>
        </div>
      </div>
      <div className="font-display text-2xl sm:text-3xl font-bold tracking-tight">{value}</div>
      <div className="flex items-center gap-1 mt-1.5">
        {up ? <ArrowUpRight className="size-3 text-success" /> : <ArrowDownRight className="size-3 text-destructive" />}
        <span className={cn("text-xs font-mono", up ? "text-success" : "text-destructive")}>{delta}</span>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-3 flex items-center gap-3">
      <div className={cn("size-9 rounded-lg grid place-items-center", `bg-[var(--${tone})]/15 text-[var(--${tone})]`)}>
        {icon}
      </div>
      <div>
        <div className="font-display text-xl font-bold leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, className, isEmpty, emptyMessage }: { 
  title: string; 
  subtitle?: string; 
  children: React.ReactNode; 
  className?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 flex flex-col min-h-[180px]", className)}>
      <div className="mb-3">
        <h3 className="font-display font-semibold">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex-1 relative">
        {isEmpty ? (
          <div className="absolute inset-0 grid place-items-center text-[11px] text-muted-foreground italic text-center p-4">
            {emptyMessage || "Sem dados para este período."}
          </div>
        ) : children}
      </div>
    </div>
  );
}

// ============================================================
// Wave 4 — Insights Mensais (competência por data_ativacao)
// ============================================================
type VendaLike = {
  operadora: string;
  receita: number;
  quantidadeLinhas: number;
  statusPedido?: string | null;
  dataAtivacao?: string | null;
  produto?: string | null;
  consultorId?: string | null;
};

function InsightsMensais({
  vendas, ambiente, mesRef, anoRef, isConsultor, className, colaboradores, comissoesVisible,
}: {
  vendas: VendaLike[];
  ambiente: string;
  mesRef: number;
  anoRef: number;
  isConsultor: boolean;
  className?: string;
  colaboradores?: Record<string, string>;
  comissoesVisible: boolean;
}) {
  const insights = useMemo(() => {
    const prevDate = new Date(anoRef, mesRef - 2, 1);
    const prevMes = prevDate.getMonth() + 1;
    const prevAno = prevDate.getFullYear();

    const inMes = (v: VendaLike, m: number, y: number) => {
      if (!v.dataAtivacao) return false;
      if (ambiente !== "GERAL" && v.operadora !== ambiente) return false;
      const d = new Date(v.dataAtivacao);
      return d.getMonth() + 1 === m && d.getFullYear() === y;
    };
    const atual = vendas.filter(v => inMes(v, mesRef, anoRef));
    const anterior = vendas.filter(v => inMes(v, prevMes, prevAno));

    const sum = (arr: VendaLike[], f: (v: VendaLike) => number) => arr.reduce((s, v) => s + f(v), 0);
    const rec = sum(atual, v => v.receita);
    const recAnt = sum(anterior, v => v.receita);
    const deltaPct = recAnt > 0 ? ((rec - recAnt) / recAnt) * 100 : (rec > 0 ? 100 : 0);
    const ticket = atual.length ? rec / atual.length : 0;

    // Top consultor
    const porCons = new Map<string, { nome: string; receita: number }>();
    atual.forEach(v => {
      if (!v.consultorId) return;
      const nome = colaboradores?.[v.consultorId] ?? "Consultor";
      const cur = porCons.get(v.consultorId) ?? { nome, receita: 0 };
      cur.receita += v.receita;
      porCons.set(v.consultorId, cur);
    });
    const topCons = Array.from(porCons.values()).sort((a, b) => b.receita - a.receita)[0] || null;

    // Top produto (ignora registros sem produto informado)
    const porProd = new Map<string, { receita: number; qtd: number }>();
    atual.forEach(v => {
      const k = (v.produto ?? "").trim();
      if (!k) return;
      const cur = porProd.get(k) ?? { receita: 0, qtd: 0 };
      cur.receita += v.receita;
      cur.qtd += 1;
      porProd.set(k, cur);
    });
    const topProdEntry = Array.from(porProd.entries())
      .sort((a, b) => (b[1].receita - a[1].receita) || (b[1].qtd - a[1].qtd))[0] || null;
    const topProd: [string, number] | null = topProdEntry ? [topProdEntry[0], topProdEntry[1].receita] : null;
    const topProdQtd = topProdEntry ? topProdEntry[1].qtd : 0;


    // Melhor dia
    const porDia = new Map<string, number>();
    atual.forEach(v => {
      if (!v.dataAtivacao) return;
      const dia = v.dataAtivacao.slice(0, 10);
      porDia.set(dia, (porDia.get(dia) ?? 0) + v.receita);
    });
    const bestDia = Array.from(porDia.entries()).sort((a, b) => b[1] - a[1])[0] || null;

    // Operadora dominante
    const claroR = sum(atual.filter(v => v.operadora === "CLARO"), v => v.receita);
    const vivoR = sum(atual.filter(v => v.operadora === "VIVO"), v => v.receita);
    const opDom = claroR === vivoR ? null : (claroR > vivoR ? "CLARO" : "VIVO");

    return { atual, anterior, rec, recAnt, deltaPct, ticket, topCons, topProd, topProdQtd, bestDia, opDom, claroR, vivoR };
  }, [vendas, ambiente, mesRef, anoRef, colaboradores]);

  const up = insights.deltaPct >= 0;
  const fmtDia = (s?: string) => {
    if (!s) return "—";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex items-center gap-2 mb-3">
        <div className="size-8 rounded-lg bg-[var(--omni)]/15 grid place-items-center text-[var(--omni)]">
          <Lightbulb className="size-4" />
        </div>
        <div>
          <h3 className="font-display font-semibold">Insights do Mês</h3>
          <p className="text-[11px] text-muted-foreground">
            {isConsultor ? "Seus resultados" : "Resultados da equipe"} · {MESES_LONG[mesRef - 1]}/{anoRef} vs {MESES_LONG[(mesRef + 10) % 12]}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {comissoesVisible && (
          <>
            <InsightCell
              icon={up ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
              tone={up ? "success" : "destructive"}
              label="Receita vs mês anterior"
              value={`${up ? "+" : ""}${insights.deltaPct.toFixed(1)}%`}
              hint={`${brl(insights.rec)} · ant ${brl(insights.recAnt)}`}
            />
            <InsightCell
              icon={<Banknote className="size-4" />}
              tone="omni"
              label="Ticket médio"
              value={brl(insights.ticket)}
              hint={`${insights.atual.length} ativações`}
            />
            <InsightCell
              icon={<Trophy className="size-4" />}
              tone="warning"
              label={isConsultor ? "Minha melhor operadora" : "Operadora dominante"}
              value={insights.opDom ?? "Equilibrado"}
              hint={`Claro ${brl(insights.claroR)} · Vivo ${brl(insights.vivoR)}`}
            />
          </>
        )}
        {!isConsultor && comissoesVisible && (
          <InsightCell
            icon={<Sparkles className="size-4" />}
            tone="purple"
            label="Top consultor"
            value={insights.topCons?.nome ?? "—"}
            hint={insights.topCons ? brl(insights.topCons.receita) : "sem ativações"}
          />
        )}
        <InsightCell
          icon={<Award className="size-4" />}
          tone="info"
          label="Produto destaque"
          value={insights.topProd?.[0] ?? "—"}
          hint={insights.topProd ? (comissoesVisible ? brl(insights.topProd[1]) : `${insights.topProdQtd} ativações`) : "sem ativações"}
        />
        <InsightCell
          icon={<CalendarCheck className="size-4" />}
          tone="success"
          label="Melhor dia"
          value={fmtDia(insights.bestDia?.[0])}
          hint={comissoesVisible && insights.bestDia ? brl(insights.bestDia[1]) : insights.bestDia ? `${insights.atual.filter(v => v.dataAtivacao?.startsWith(insights.bestDia![0])).length} ativações` : "—"}
        />
        {!comissoesVisible && (
          <InsightCell
            icon={<TrendingUp className="size-4" />}
            tone="omni"
            label="Total ativado"
            value={String(insights.atual.length)}
            hint="no mês atual"
          />
        )}
      </div>
    </div>
  );
}

function InsightCell({ icon, tone, label, value, hint }: {
  icon: React.ReactNode; tone: string; label: string; value: string; hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface-1 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={cn("size-6 rounded grid place-items-center", `bg-[var(--${tone})]/15 text-[var(--${tone})]`)}>
          {icon}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      </div>
      <div className="font-display font-bold text-base truncate">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground font-mono truncate">{hint}</div>}
    </div>
  );
}

// ============================================================
// Wave 4 — Fechamento Mensal (status do snapshot)
// ============================================================
function FechamentoMensalCard({ mesRef, anoRef }: { mesRef: number; anoRef: number }) {
  const [f, setF] = useState<{ status: string; total_bruto: number; total_comissao: number; fechado_em: string | null; pago_em: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);

    const checkAndLoad = async () => {
      // Verifica se o módulo está ativo antes de consultar a tabela restrita
      const { data: setting } = await supabase
        .from("app_settings")
        .select("valor")
        .eq("chave", "commissions_enabled")
        .maybeSingle();

      const isEnabled = setting?.valor !== false;
      if (!isEnabled) {
        if (!cancel) {
          setF(null);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("comissao_fechamentos")
        .select("status,total_bruto,total_comissao,fechado_em,pago_em")
        .eq("ano", anoRef)
        .eq("mes", mesRef)
        .maybeSingle();

      if (cancel) return;
      if (error) {
        console.error("Erro ao carregar fechamento:", error);
        setF(null);
      } else {
        setF(data ? {
          status: data.status,
          total_bruto: Number(data.total_bruto ?? 0),
          total_comissao: Number(data.total_comissao ?? 0),
          fechado_em: data.fechado_em,
          pago_em: data.pago_em,
        } : null);
      }
      setLoading(false);
    };

    checkAndLoad();
    return () => { cancel = true; };
  }, [mesRef, anoRef]);

  const status = f?.status ?? "sem_fechamento";
  const badge =
    status === "pago" ? { cls: "bg-success/15 text-success border-success/30", label: "Pago", icon: <Lock className="size-3" /> } :
    status === "fechado" ? { cls: "bg-[var(--omni)]/15 text-[var(--omni)] border-[var(--omni)]/40", label: "Fechado", icon: <Lock className="size-3" /> } :
    status === "aberto" ? { cls: "bg-info/15 text-info border-info/30", label: "Em andamento", icon: <Unlock className="size-3" /> } :
    { cls: "bg-surface-2 text-muted-foreground border-border", label: "Sem fechamento", icon: <Unlock className="size-3" /> };

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <div className="size-8 rounded-lg bg-[var(--omni)]/15 grid place-items-center text-[var(--omni)]">
          <CalendarCheck className="size-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display font-semibold">Fechamento do Mês</h3>
          <p className="text-[11px] text-muted-foreground truncate">{MESES_LONG[mesRef - 1]}/{anoRef}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", badge.cls)}>
          {badge.icon}{badge.label}
        </span>
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground italic">Carregando…</div>
      ) : (
        <div className="space-y-1.5 text-xs">
          <Line label="Base bruta" value={brl(f?.total_bruto ?? 0)} />
          <Line label="Comissão total" value={brl(f?.total_comissao ?? 0)} strong />
          {f?.fechado_em && (
            <Line label="Fechado em" value={new Date(f.fechado_em).toLocaleDateString("pt-BR")} />
          )}
          {f?.pago_em && (
            <Line label="Pago em" value={new Date(f.pago_em).toLocaleDateString("pt-BR")} />
          )}
        </div>
      )}

      <p className="mt-auto pt-3 text-[10px] text-muted-foreground leading-snug border-t border-border/50 mt-3">
        O fechamento congela comissões e resultados do mês, mas <span className="text-foreground font-semibold">não altera o pipeline</span> — cards continuam ativos até serem concluídos.
      </p>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono", strong && "font-bold text-[var(--omni)]")}>{value}</span>
    </div>
  );
}
