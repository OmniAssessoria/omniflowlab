import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarRange, Loader2, Settings2, ShieldCheck } from "lucide-react";
import { AcompanhamentoConfigDialog } from "@/components/acompanhamento/acompanhamento-config-dialog";
import { ConsultorWeeklyTable } from "@/components/acompanhamento/consultor-weekly-table";
import { MetaMensalCard } from "@/components/acompanhamento/meta-mensal-card";
import { MetaSemanalCard } from "@/components/acompanhamento/meta-semanal-card";
import { ProcessoOperadoraCard } from "@/components/acompanhamento/processo-operadora-card";
import { ResidualCard } from "@/components/acompanhamento/residual-card";
import { StatusOperationalCard } from "@/components/acompanhamento/status-operational-card";
import { TotalGeralCard } from "@/components/acompanhamento/total-geral-card";
import { WeeklyResultCard } from "@/components/acompanhamento/weekly-result-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAcompanhamentoBootstrap } from "@/lib/acompanhamento.functions";
import type { AcompanhamentoBootstrap } from "@/lib/acompanhamento.types";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_shell/acompanhamento")({
  component: AcompanhamentoPage,
});

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const totalFilters = ["Tudo", "Claro", "Vivo"] as const;

function getPendingClassificationCount(data: AcompanhamentoBootstrap) {
  const groupsByContext = new Map<string, Set<string>>();
  for (const group of data.grupos) {
    const set = groupsByContext.get(group.contexto) ?? new Set<string>();
    set.add(group.id);
    groupsByContext.set(group.contexto, set);
  }

  let count = 0;
  for (const tipo of data.tiposPedido) {
    for (const [context, groupIds] of groupsByContext) {
      if (context === "processo_claro" && tipo.operadora !== "CLARO") continue;
      if (context === "processo_vivo" && tipo.operadora !== "VIVO") continue;
      if (context === "processo_claro" || context === "processo_vivo") {
        const regras = data.classificacoesProcesso[tipo.operadora] ?? [];
        if (regras.some(regra => regra.tipoPedido.toLocaleUpperCase("pt-BR") === tipo.nome.toLocaleUpperCase("pt-BR"))) continue;
        if (tipo.operadora === "VIVO" && tipo.nome.toLocaleUpperCase("pt-BR") === "RENOVAÇÃO") continue;
      }
      const linked = data.vinculosTipo.some(
        link => link.tipo_pedido_id === tipo.id && groupIds.has(link.grupo_id),
      );
      if (!linked) count += 1;
    }
  }
  return count;
}

function AcompanhamentoPage() {
  const { primaryRole, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fetchBootstrap = useServerFn(getAcompanhamentoBootstrap);
  const today = new Date();
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [ano, setAno] = useState(today.getFullYear());
  const [data, setData] = useState<AcompanhamentoBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  const allowed = primaryRole === "admin" || primaryRole === "gestor";

  useEffect(() => {
    if (!authLoading && primaryRole && !allowed) {
      navigate({ to: "/dashboard" });
    }
  }, [authLoading, primaryRole, allowed, navigate]);

  const reload = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchBootstrap({ data: { ano, mes } } as any);
      setData(result as AcompanhamentoBootstrap);
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível carregar o acompanhamento.");
    } finally {
      setLoading(false);
    }
  }, [allowed, ano, mes, fetchBootstrap]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const pending = useMemo(() => data ? getPendingClassificationCount(data) : 0, [data]);

  if (authLoading || !allowed) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="size-5 animate-spin text-omni" />
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="text-center">
          <Loader2 className="mx-auto size-6 animate-spin text-omni" />
          <div className="mt-3 text-xs text-muted-foreground">Carregando Acompanhamento da Gestão…</div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="font-semibold text-destructive">Não foi possível abrir o acompanhamento.</div>
          <div className="mt-1 text-xs text-muted-foreground">{error}</div>
          <Button className="mt-4" onClick={() => void reload()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] space-y-5 p-4 sm:p-5 lg:p-6">
      <header className="relative overflow-hidden rounded-3xl border border-omni/20 bg-gradient-to-br from-omni/[0.12] via-card to-card p-5">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-omni/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge className="bg-omni text-black">GESTÃO</Badge>
              <Badge variant="outline" className="gap-1 border-success/30 text-success">
                <ShieldCheck className="size-3" /> Admin + Gestor
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">Aguardando configuração dos resultados</Badge>
            </div>
            <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Acompanhamento da Gestão</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Metas, ritmo semanal, classificação e pontos operacionais em um único lugar.
              Esta primeira etapa prepara as regras sem preencher resultados comerciais antes da validação da gestão.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              Mês
              <select
                value={mes}
                onChange={event => setMes(Number(event.target.value))}
                className="mt-1 block h-9 min-w-[145px] rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground"
              >
                {MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
              </select>
            </label>
            <label className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              Ano
              <input
                type="number"
                min={2020}
                max={2100}
                value={ano}
                onChange={event => setAno(Number(event.target.value))}
                className="mt-1 block h-9 w-24 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground"
              />
            </label>
            <Button variant="outline" onClick={() => setConfigOpen(true)} className="h-9 gap-1.5">
              <Settings2 className="size-3.5" /> Configurações
            </Button>
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/80 bg-background/45 p-3 backdrop-blur">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              <CalendarRange className="size-3.5 text-omni" /> Período
            </div>
            <div className="mt-1 font-display text-lg font-black">{MONTHS[mes - 1]} / {ano}</div>
          </div>
          <div className="rounded-2xl border border-border/80 bg-background/45 p-3 backdrop-blur">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              <AlertTriangle className="size-3.5 text-warning" /> Classificação pendente
            </div>
            <div className="mt-1 font-display text-lg font-black text-warning">{pending}</div>
          </div>
          <div className="rounded-2xl border border-border/80 bg-background/45 p-3 backdrop-blur">
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">Semanas operacionais</div>
            <div className="mt-1 font-display text-lg font-black">{data.semanas.length}</div>
          </div>
        </div>
      </header>

      {pending > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/35 bg-warning/[0.06] px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <div className="text-xs font-bold text-warning">Existem tipos de pedido sem classificação.</div>
              <div className="text-[10px] text-muted-foreground">
                Eles não serão enviados automaticamente para nenhum grupo até a gestão fazer o vínculo.
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>Classificar agora</Button>
        </div>
      )}

      <div aria-label="Meta mensal">
        <MetaMensalCard ano={ano} mes={mes} metas={data.metasMensais} onSaved={reload} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ProcessoOperadoraCard operadora="CLARO" title="Vendas em Processo Claro" regras={data.classificacoesProcesso.CLARO} />
        <ProcessoOperadoraCard operadora="VIVO" title="Vendas em Processo Vivo" regras={data.classificacoesProcesso.VIVO} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div aria-label="Total Geral">
          <TotalGeralCard filters={totalFilters} />
        </div>
        <div aria-label="Residual do Mês">
          <ResidualCard metas={data.metasMensais} />
        </div>
      </div>

      <div aria-label="Meta da semana">
        <MetaSemanalCard
          ano={ano}
          mes={mes}
          weeks={data.semanas}
          monthly={data.metasMensais}
          weekly={data.metasSemanais}
          onSaved={reload}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <WeeklyResultCard
          title="Contratos Gerados Semana / Data de Recebimento"
          subtitle="Quadro semanal com fonte própria de recebimento."
          quadroCodigo="contratos_gerados_semana"
          data={data}
          onSaved={reload}
        />
        <WeeklyResultCard
          title="Contratos Assinados Semana / Data de Aceite"
          subtitle="Quadro semanal com fonte própria de aceite."
          quadroCodigo="contratos_assinados_semana"
          data={data}
          onSaved={reload}
        />
      </div>

      <ConsultorWeeklyTable
        title="Enviados / Data de Recebimento"
        subtitle="Metas individuais livres por consultor. Resultados permanecem sem cálculo nesta etapa."
        quadro="enviados"
        quadroCodigo="meta_enviados_consultor"
        data={data}
        onSaved={reload}
      />

      <ConsultorWeeklyTable
        title="Assinados / Data de Aceite"
        subtitle="Cada consultor possui sua própria meta semanal para este quadro."
        quadro="assinados"
        quadroCodigo="meta_assinados_consultor"
        data={data}
        onSaved={reload}
      />

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-black">Quadros operacionais por status</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Status manual, status do robô e etapa do pipeline podem ser configurados independentemente em cada quadro.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <StatusOperationalCard
            quadroCodigo="aguardando_aceite"
            title="Aguardando Aceite"
            data={data}
            onSaved={reload}
          />
          <StatusOperationalCard
            quadroCodigo="troca_carteira_caso"
            title="Troca de Carteira / Caso"
            data={data}
            onSaved={reload}
          />
          <StatusOperationalCard
            quadroCodigo="confeccao_correcoes"
            title="Confecção / Correções"
            data={data}
            onSaved={reload}
          />
          <StatusOperationalCard
            quadroCodigo="tratativas_pendencias"
            title="Tratativas / Pendências"
            data={data}
            onSaved={reload}
          />
        </div>
      </section>

      <AcompanhamentoConfigDialog
        data={data}
        open={configOpen}
        onOpenChange={setConfigOpen}
        onReload={reload}
      />
    </div>
  );
}
