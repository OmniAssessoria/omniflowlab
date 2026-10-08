import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listFechamentos, getFechamento, criarFechamento, fecharPeriodo, marcarPago,
  ajustarItem, listMinhasComissoes,
  listComissoesAll, confirmarComissao, cancelarComissao,
  listMetas, salvarMeta, removerMeta, listMinhasMetas, excluirComissao,
} from "@/lib/comissoes.functions";
import { listUsuarios } from "@/lib/users.functions";
import { useConsultoresReais } from "@/lib/catalogos";
import { useAuth } from "@/lib/auth";
import { useFeatures } from "@/lib/features";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Wallet, Plus, Lock, Check, Pencil, Trash2, Calculator, AlertTriangle, CheckCircle2, XCircle, Clock, Trophy, Zap, Target } from "lucide-react";
import { MESES_LONG } from "@/lib/mock-data";
import { ErrorBoundary } from "@/components/error-boundary";
import { buildVendaDetailUrl } from "@/lib/rotas";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_shell/comissoes")({
  component: ComissoesPage,
});

const BRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function ComissoesPage() {
  const navigate = useNavigate();
  const { primaryRole } = useAuth();
  const { comissoesVisible, comissoesEnabled, loading: flagLoading } = useFeatures();
  const isBko = primaryRole === "bko";
  const isAdmin = primaryRole === "admin";
  const isMgmt = primaryRole === "admin" || primaryRole === "gestor";
  const [tab, setTab] = useState(isMgmt ? "comissoes" : "minhas");

  if (!flagLoading && (!comissoesVisible || isBko)) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-16 rounded-xl border border-border bg-card p-8 text-center space-y-4 shadow-lg shadow-black/20">
        <div className="size-12 rounded-full bg-muted grid place-items-center mx-auto">
          <Lock className="size-6 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-display font-bold">Acesso restrito</h2>
          <p className="text-sm text-muted-foreground">
            {!comissoesEnabled 
              ? "Módulo de Comissões desativado." 
              : "Você não tem acesso ao módulo de Comissões."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary name="Página de Comissões">
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-xl bg-omni/15 grid place-items-center"><Wallet className="size-6 text-omni" /></div>
        <div>
          <h1 className="text-2xl font-display font-bold">Comissionamento</h1>
          <p className="text-sm text-muted-foreground">Comissões geradas por venda e metas mensais (10% base · 20% ao bater a meta).</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {isMgmt && <TabsTrigger value="comissoes">Comissões</TabsTrigger>}
          {isMgmt && <TabsTrigger value="metas">Metas do Mês</TabsTrigger>}
          {!isMgmt && <TabsTrigger value="minhas">Minhas comissões</TabsTrigger>}
        </TabsList>

        {isMgmt && <TabsContent value="comissoes" className="mt-4"><Pendentes /></TabsContent>}
        {isMgmt && <TabsContent value="metas" className="mt-4"><MetasPanel /></TabsContent>}
        {!isMgmt && <TabsContent value="minhas" className="mt-4"><MinhasComissoes /></TabsContent>}
      </Tabs>
      </div>
    </ErrorBoundary>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pendente_regra: "Pendente",
  pendente_confirmacao: "Pendente",
  confirmada: "Confirmada",
  paga: "Paga",
  cancelada: "Cancelada",
};
const STATUS_CLASS: Record<string, string> = {
  pendente_regra: "bg-warning/15 text-warning border-warning/40",
  pendente_confirmacao: "bg-warning/15 text-warning border-warning/40",
  confirmada: "bg-success/15 text-success border-success/40",
  paga: "bg-info/15 text-info border-info/40",
  cancelada: "bg-destructive/15 text-destructive border-destructive/40",
};

function Pendentes() {
  const { primaryRole } = useAuth();
  const isAdmin = primaryRole === "admin";
  const navigate = useNavigate();
  const list = useServerFn(listComissoesAll);
  const confirmar = useServerFn(confirmarComissao);
  const cancelar = useServerFn(cancelarComissao);
  const listarMetas = useServerFn(listMetas);
  const deleteComissao = useServerFn(excluirComissao);
  const [items, setItems] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [selExcluir, setSelExcluir] = useState<any | null>(null);
  const [motivoExclusao, setMotivoExclusao] = useState("");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);
  const [filtroConsultor, setFiltroConsultor] = useState<string>("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const now = new Date();
  const [filtroMes, setFiltroMes] = useState<number>(now.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState<number>(now.getFullYear());
  const [filtroOperadora, setFiltroOperadora] = useState<string>("todas");
  const [filtroProduto, setFiltroProduto] = useState<string>("todos");

  async function reload() { setItems(await list()); listarMetas().then(setMetas).catch(() => {}); }
  useEffect(() => { reload(); }, []);

  // Base filtrada por competência mensal (data_ativacao_100)
  const itemsMes = useMemo(() => items.filter(i => {
    if (!i.data_ativacao_100 || i.deleted_at || i.status === "cancelada") return false;
    const d = new Date(i.data_ativacao_100);
    return d.getMonth() + 1 === filtroMes && d.getFullYear() === filtroAno;
  }), [items, filtroMes, filtroAno]);

  const produtosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    itemsMes.forEach(i => { const p = i.vendas?.produto ?? i.produto; if (p) set.add(p); });
    return Array.from(set).sort();
  }, [itemsMes]);


  const totalPend = itemsMes.filter(i => i.status === "pendente_confirmacao" || i.status === "pendente_regra").reduce((s, i) => s + Number(i.valor_comissao || 0), 0);
  const totalConf = itemsMes.filter(i => i.status === "confirmada" || i.status === "paga").reduce((s, i) => s + Number(i.valor_comissao || 0), 0);

  async function handleConfirm() {
    if (!sel) return;
    setLoading(true);
    try {
      await confirmar({ data: { id: sel.id, observacao: obs || undefined } });
      toast.success("Comissão confirmada com sucesso");
      setSel(null); setObs(""); reload();
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }

  async function handleCancel(id: string) {
    const motivo = prompt("Motivo do cancelamento (opcional):") ?? undefined;
    if (motivo === null) return;
    try { await cancelar({ data: { id, motivo } }); toast.success("Comissão cancelada"); reload(); }
    catch (e: any) { toast.error(e.message); }
  }
  
  async function handleExcluir() {
    if (!selExcluir || !motivoExclusao) return;
    setLoading(true);
    try {
      await deleteComissao({ data: { id: selExcluir.id, motivo: motivoExclusao } });
      toast.success("Comissão excluída com sucesso.");
      setSelExcluir(null); setMotivoExclusao(""); reload();
    } catch (e: any) {
      toast.error(e.message || "Não foi possível excluir a comissão.");
    } finally {
      setLoading(false);
    }
  }

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    items.forEach(i => { if (i.data_ativacao_100) set.add(new Date(i.data_ativacao_100).getFullYear()); });
    return Array.from(set).sort((a, b) => b - a);
  }, [items]);

  const hasFiltroExtra = filtroConsultor || filtroStatus !== "todos" || filtroOperadora !== "todas" || filtroProduto !== "todos";

  return (
    <div className="space-y-4">
      {/* Barra de competência mensal */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-1 p-3">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Competência</span>
        <Select value={String(filtroMes)} onValueChange={v => setFiltroMes(Number(v))}>
          <SelectTrigger className="h-8 text-xs min-w-[140px]"><SelectValue/></SelectTrigger>
          <SelectContent>
            {MESES_LONG.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(filtroAno)} onValueChange={v => setFiltroAno(Number(v))}>
          <SelectTrigger className="h-8 text-xs w-[90px]"><SelectValue/></SelectTrigger>
          <SelectContent>
            {anosDisponiveis.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-[11px] text-muted-foreground ml-2">
          {itemsMes.length} comissão(ões) na competência selecionada
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-warning font-semibold"><Clock className="size-4"/>Pendentes de confirmação</div>
          <div className="font-display text-2xl font-bold mt-1">{itemsMes.filter(i => i.status === "pendente_confirmacao" || i.status === "pendente_regra").length}</div>
          <div className="text-xs text-muted-foreground">Valor previsto: <span className="text-warning font-semibold">{BRL(totalPend)}</span></div>
        </div>
        <div className="rounded-xl border border-success/40 bg-success/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-success font-semibold"><CheckCircle2 className="size-4"/>Confirmadas / pagas</div>
          <div className="font-display text-2xl font-bold mt-1">{itemsMes.filter(i => i.status === "confirmada" || i.status === "paga").length}</div>
          <div className="text-xs text-muted-foreground">Total: <span className="text-success font-semibold">{BRL(totalConf)}</span></div>
        </div>
        <div className="rounded-xl border border-omni/30 bg-omni/5 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-omni font-semibold"><Wallet className="size-4"/>Total do mês</div>
          <div className="font-display text-2xl font-bold mt-1 text-omni">{BRL(itemsMes.reduce((s, i) => s + Number(i.valor_comissao || 0), 0))}</div>
        </div>
      </div>

      {/* Cards metas + Visão por colaborador */}
      <VisaoColaboradores items={itemsMes} metas={metas} filtro={filtroConsultor} onFiltrar={setFiltroConsultor} />

      <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
        <div className="px-3 py-2 border-b border-border bg-surface-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-semibold uppercase tracking-wider text-muted-foreground">Comissões {hasFiltroExtra && <span className="text-omni normal-case">· filtro ativo</span>}</div>
          <div className="flex flex-wrap items-center gap-2 normal-case">
            <Select value={filtroOperadora} onValueChange={setFiltroOperadora}>
              <SelectTrigger className="h-7 text-[11px] min-w-[120px]"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas operadoras</SelectItem>
                <SelectItem value="CLARO">Claro</SelectItem>
                <SelectItem value="VIVO">Vivo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filtroProduto} onValueChange={setFiltroProduto}>
              <SelectTrigger className="h-7 text-[11px] min-w-[140px]"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos produtos</SelectItem>
                {produtosDisponiveis.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="h-7 text-[11px] min-w-[160px]"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="confirmada">Confirmadas</SelectItem>
                <SelectItem value="paga">Pagas</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
              </SelectContent>
            </Select>
            {hasFiltroExtra && <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setFiltroConsultor(""); setFiltroStatus("todos"); setFiltroOperadora("todas"); setFiltroProduto("todos"); }}>Limpar</Button>}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-surface-2"><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Cliente / Venda</th>
            <th className="px-3 py-2">Consultor</th>
            <th className="px-3 py-2">Operadora · Produto · Tipo</th>
            <th className="px-3 py-2 text-right">Linhas</th>
            <th className="px-3 py-2 text-right">Receita</th>
            <th className="px-3 py-2 text-right">10%</th>
            <th className="px-3 py-2 text-right">20% meta</th>
            <th className="px-3 py-2 text-right">Comissão</th>
            <th className="px-3 py-2">Meta</th>
            <th className="px-3 py-2 text-right">Ações</th>
          </tr></thead>
          <tbody>
            {(() => {
              let filtered = itemsMes;
              if (filtroConsultor) filtered = filtered.filter(i => i.consultor_id === filtroConsultor);
              if (filtroOperadora !== "todas") filtered = filtered.filter(i => i.operadora === filtroOperadora);
              if (filtroProduto !== "todos") filtered = filtered.filter(i => (i.vendas?.produto ?? i.produto) === filtroProduto);
              if (filtroStatus !== "todos") {
                filtered = filtered.filter(i => {
                  if (filtroStatus === "pendente") return (i.status === "pendente_confirmacao" || i.status === "pendente_regra");
                  return i.status === filtroStatus;
                });
              }
              // Ocultar logicamente as excluídas da visão operacional
              filtered = filtered.filter(i => !i.deleted_at);

              if (filtered.length === 0) return <tr><td colSpan={11} className="text-center text-muted-foreground italic py-10 text-sm">Nenhuma comissão encontrada nesta competência.</td></tr>;
              return filtered.map(it => {
              const isPend = it.status === "pendente_confirmacao" || it.status === "pendente_regra";
              const canConfirm = it.status === "pendente_confirmacao" || it.status === "pendente_regra";
              return (
                <tr key={it.id} className="border-t border-border hover:bg-surface-2/50">
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase ${STATUS_CLASS[it.status] ?? "bg-muted text-muted-foreground border-border"}`}>
                      {STATUS_LABEL[it.status] ?? it.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-[11px]">{it.vendas?.numero}</div>
                    <div className="text-xs truncate max-w-[220px]">{it.vendas?.cliente_razao_social}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{it.profiles?.nome_completo ?? it.vendas?.consultor_nome ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{it.operadora ?? "—"} · {it.vendas?.produto ?? it.produto ?? "—"} · {it.vendas?.tipo_pedido ?? it.tipo_pedido ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-xs">{it.vendas?.quantidade_linhas ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-xs">{BRL(Number(it.base_calculo))}</td>
                  <td className="px-3 py-2 text-right text-xs">{BRL(Number(it.base_calculo) * 0.10)}</td>
                  <td className="px-3 py-2 text-right text-xs text-yellow-600 font-semibold">{BRL(Number(it.base_calculo) * 0.20)}</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-omni">{BRL(Number(it.valor_comissao))}<div className="text-[10px] text-muted-foreground">{Number(it.percentual_aplicado).toFixed(0)}%</div></td>
                  <td className="px-3 py-2 text-xs">
                    {it.metas_mensais ? (
                      <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase ${it.metas_mensais.status === "batida" ? "bg-yellow-400/20 text-yellow-600 border-yellow-500/50" : "bg-info/15 text-info border-info/40"}`}>{it.metas_mensais.status === "batida" ? "Batida" : "Em curso"}</span>
                    ) : <span className="text-muted-foreground italic">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => {
                      const detail = buildVendaDetailUrl(it.venda_id);
                      navigate({ to: detail.to, params: detail.params });
                    }}>Ver venda</Button>
                    {canConfirm && <Button size="sm" onClick={() => { setSel(it); setObs(""); }} className="h-7 bg-success text-white hover:bg-success/90 ml-1"><Check className="size-3.5 mr-1"/>Confirmar</Button>}
                    {isPend && <Button size="sm" variant="ghost" className="h-7 text-destructive ml-1" onClick={() => handleCancel(it.id)}><XCircle className="size-3.5"/></Button>}
                    {isAdmin && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 text-destructive hover:bg-destructive/10 ml-1" 
                        onClick={() => { setSelExcluir(it); setMotivoExclusao(""); }}
                      >
                        <Trash2 className="size-3.5"/>
                      </Button>
                    )}
                  </td>
                </tr>
              );
            });
            })()}
          </tbody>
        </table>
      </div>

      <Dialog open={!!sel} onOpenChange={(o) => { if (!o) { setSel(null); setObs(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar comissão do consultor</DialogTitle>
            <DialogDescription>Deseja confirmar a comissão desta venda para o consultor responsável?</DialogDescription>
          </DialogHeader>
          {sel && (() => {
            const base = Number(sel.base_calculo || 0);
            const com10 = base * 0.10;
            const com20 = base * 0.20;
            const batida = sel.metas_mensais?.status === "batida";
            const finalV = Number(sel.valor_comissao || 0);
            return (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-border pb-1"><span className="text-muted-foreground">Cliente</span><span className="font-medium truncate max-w-[220px]">{sel.vendas?.cliente_razao_social}</span></div>
                <div className="flex justify-between border-b border-border pb-1"><span className="text-muted-foreground">Consultor</span><span className="font-medium">{sel.profiles?.nome_completo ?? sel.vendas?.consultor_nome ?? "—"}</span></div>
                <div className="flex justify-between border-b border-border pb-1"><span className="text-muted-foreground">Venda</span><span className="font-mono text-xs">{sel.vendas?.numero}</span></div>
                <div className="flex justify-between border-b border-border pb-1"><span className="text-muted-foreground">Receita</span><span className="font-bold">{BRL(base)}</span></div>
                <div className="flex justify-between border-b border-border pb-1"><span className="text-muted-foreground">Data ativação</span><span className="font-medium">{sel.data_ativacao_100 ? new Date(sel.data_ativacao_100).toLocaleString("pt-BR") : "—"}</span></div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className={`rounded-lg border p-2 ${!batida ? "border-omni bg-omni/5" : "border-border opacity-60"}`}>
                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">Comissão 10%</div>
                    <div className="font-bold">{BRL(com10)}</div>
                  </div>
                  <div className={`rounded-lg border p-2 ${batida ? "border-yellow-500 bg-yellow-500/10" : "border-border opacity-60"}`}>
                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">Meta batida 20%</div>
                    <div className="font-bold text-yellow-600">{BRL(com20)}</div>
                  </div>
                </div>

                <div className="rounded-lg bg-surface-2 p-2 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">Status da meta</div>
                    <div className="text-xs font-semibold">{sel.metas_mensais?.nome ?? "Sem meta vinculada"} — {batida ? "Meta batida ✓" : sel.metas_mensais ? "Em andamento" : "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">Valor final</div>
                    <div className="font-display text-lg font-bold text-omni">{BRL(finalV)}</div>
                  </div>
                </div>

                <div className="pt-2"><Label className="text-xs">Observação (opcional)</Label><Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} /></div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setSel(null); setObs(""); }}>Cancelar</Button>
            <Button disabled={loading} onClick={handleConfirm} className="bg-success text-white hover:bg-success/90"><Check className="size-4 mr-1"/>Confirmar Comissão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão */}
      <Dialog open={!!selExcluir} onOpenChange={(o) => { if (!o) { setSelExcluir(null); setMotivoExclusao(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Excluir comissão
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta comissão? Ela será removida da tela de Comissões, dos totais do mês e da visão do consultor.
            </DialogDescription>
          </DialogHeader>
          
          {selExcluir && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2 text-xs border rounded-lg p-3 bg-muted/30">
                <div className="text-muted-foreground font-medium">Pedido:</div>
                <div className="font-mono">{selExcluir.vendas?.numero}</div>
                <div className="text-muted-foreground font-medium">Cliente:</div>
                <div className="truncate">{selExcluir.vendas?.cliente_razao_social}</div>
                <div className="text-muted-foreground font-medium">Consultor:</div>
                <div>{selExcluir.profiles?.nome_completo ?? selExcluir.vendas?.consultor_nome}</div>
                <div className="text-muted-foreground font-medium">Valor:</div>
                <div className="text-omni font-bold">{BRL(Number(selExcluir.valor_comissao))}</div>
                <div className="text-muted-foreground font-medium">Status Atual:</div>
                <div className="uppercase font-bold">{STATUS_LABEL[selExcluir.status]}</div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="motivo-exclusao" className="text-xs font-semibold uppercase tracking-wider">Motivo da exclusão *</Label>
                <Textarea 
                  id="motivo-exclusao"
                  placeholder="Informe o motivo real desta exclusão para fins de auditoria..."
                  value={motivoExclusao}
                  onChange={(e) => setMotivoExclusao(e.target.value)}
                  className="text-xs min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelExcluir(null)} disabled={loading}>Cancelar</Button>
            <Button 
              variant="destructive" 
              onClick={handleExcluir} 
              disabled={loading || !motivoExclusao.trim()}
            >
              {loading ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fechamentos() {
  const navigate = useNavigate();
  const list = useServerFn(listFechamentos);
  const get = useServerFn(getFechamento);
  const criar = useServerFn(criarFechamento);
  const fechar = useServerFn(fecharPeriodo);
  const pago = useServerFn(marcarPago);
  const ajustar = useServerFn(ajustarItem);

  const [items, setItems] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [detail, setDetail] = useState<{ fechamento: any; itens: any[] } | null>(null);
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);

  async function reload() { setItems(await list()); }
  useEffect(() => { reload(); }, []);
  useEffect(() => { if (sel) get({ data: { id: sel.id } }).then(setDetail); else setDetail(null); }, [sel]);

  async function handleCriar() {
    try { await criar({ data: { ano, mes } }); toast.success("Período criado"); reload(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function handleFechar(id: string) {
    if (!confirm("Fechar este período? Não poderá ser reaberto.")) return;
    await fechar({ data: { id } }); toast.success("Período fechado"); reload(); if (sel?.id === id) get({ data: { id } }).then(setDetail);
  }
  async function handlePago(id: string) {
    await pago({ data: { id } }); toast.success("Marcado como pago"); reload(); if (sel?.id === id) get({ data: { id } }).then(setDetail);
  }

  return (
    <div className="grid lg:grid-cols-[380px_1fr] gap-4">
      <div className="space-y-3">
        <div className="rounded-xl border border-border p-3 bg-surface-1 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Criar período</div>
          <div className="flex gap-2">
            <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{MESES_LONG.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
              <SelectTrigger className="h-9 w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>{[2025,2026,2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={handleCriar} className="bg-omni text-black hover:bg-omni/90"><Plus className="size-4" /></Button>
          </div>
        </div>

        <div className="space-y-1.5">
          {items.length === 0 && <div className="text-center text-xs text-muted-foreground p-6 italic">Nenhum período ainda.</div>}
          {items.map(f => (
            <button key={f.id} onClick={() => setSel(f)}
              className={`w-full text-left rounded-lg border p-3 transition-all ${sel?.id === f.id ? "border-omni bg-omni/5" : "border-border hover:bg-surface-1"}`}>
              <div className="flex items-center justify-between">
                <div className="font-display font-semibold">{MESES_LONG[f.mes-1]}/{f.ano}</div>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  f.status === "pago" ? "bg-success/15 text-success" :
                  f.status === "fechado" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"}`}>{f.status}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div><div className="text-muted-foreground">Base</div><div className="font-semibold">{BRL(Number(f.total_bruto))}</div></div>
                <div><div className="text-muted-foreground">Comissão</div><div className="font-semibold text-omni">{BRL(Number(f.total_comissao))}</div></div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-1 p-4">
        {!detail && <div className="text-center text-sm text-muted-foreground py-20">Selecione um período.</div>}
        {detail?.fechamento && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-display text-xl font-bold">{MESES_LONG[detail.fechamento.mes-1]} de {detail.fechamento.ano}</div>
                <div className="text-xs text-muted-foreground">{detail.itens.length} itens · base {BRL(Number(detail.fechamento.total_bruto))} · comissão {BRL(Number(detail.fechamento.total_comissao))}</div>
              </div>
              <div className="flex gap-2">
                {detail.fechamento.status === "aberto" && (
                  <Button onClick={() => handleFechar(detail.fechamento.id)} variant="outline"><Lock className="size-4 mr-1.5"/>Fechar</Button>
                )}
                {detail.fechamento.status === "fechado" && (
                  <Button onClick={() => handlePago(detail.fechamento.id)} className="bg-success text-white hover:bg-success/90"><Check className="size-4 mr-1.5"/>Marcar pago</Button>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-2">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Venda</th><th className="px-3 py-2">Consultor</th><th className="px-3 py-2">Operadora</th>
                    <th className="px-3 py-2 text-right">Base</th><th className="px-3 py-2 text-right">%</th>
                    <th className="px-3 py-2 text-right">Comissão</th><th className="px-3 py-2 text-right">Ajuste</th><th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {detail.itens.map((it: any) => (
                    <tr key={it.id} className="border-t border-border cursor-pointer hover:bg-surface-2/50"
                      onClick={() => {
                        const detail = buildVendaDetailUrl(it.venda_id);
                        navigate({ to: detail.to, params: detail.params });
                      }}>
                      <td className="px-3 py-2"><div className="font-mono text-xs">{it.vendas?.numero}</div><div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{it.vendas?.cliente_razao_social}</div></td>
                      <td className="px-3 py-2 text-xs">{it.profiles?.nome_completo ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{it.operadora}</td>
                      <td className="px-3 py-2 text-right text-xs">{BRL(Number(it.base_calculo))}</td>
                      <td className="px-3 py-2 text-right text-xs">{Number(it.percentual_aplicado).toFixed(2)}%</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold text-omni">{BRL(Number(it.valor_comissao))}</td>
                      <td className="px-3 py-2 text-right text-xs">{BRL(Number(it.ajuste_manual))}</td>
                      <td className="px-3 py-2 text-right">
                        <AjusteDialog item={it} onSave={async (v, obs) => { await ajustar({ data: { id: it.id, ajuste_manual: v, observacao: obs } }); toast.success("Ajuste salvo"); if (sel) get({ data: { id: sel.id } }).then(setDetail); }} />
                      </td>
                    </tr>
                  ))}
                  {detail.itens.length === 0 && <tr><td colSpan={8} className="text-center text-muted-foreground italic py-8 text-sm">Nenhuma venda concluída neste período ainda.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AjusteDialog({ item, onSave }: { item: any; onSave: (ajuste: number, obs: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(String(item.ajuste_manual ?? 0));
  const [obs, setObs] = useState(item.observacao ?? "");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" className="size-7"><Pencil className="size-3.5" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajuste manual</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Ajuste (R$)</Label><Input type="number" step="0.01" value={v} onChange={e => setV(e.target.value)} /></div>
          <div><Label>Observação</Label><Input value={obs} onChange={e => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={async () => { await onSave(Number(v) || 0, obs); setOpen(false); }} className="bg-omni text-black hover:bg-omni/90">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MinhasComissoes() {
  const navigate = useNavigate();
  const list = useServerFn(listMinhasComissoes);
  const listMetasFn = useServerFn(listMinhasMetas);
  const [items, setItems] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);
  useEffect(() => { list().then(setItems); listMetasFn().then(setMetas).catch(() => {}); }, []);

  const porMes = useMemo(() => {
    const map: Record<string, { label: string; total: number; status: string; itens: any[] }> = {};
    for (const it of items) {
      const f = it.comissao_fechamentos;
      const key = f ? `${f.ano}-${String(f.mes).padStart(2,'0')}` : "sem";
      if (!map[key]) map[key] = { label: f ? `${MESES_LONG[f.mes-1]}/${f.ano}` : "Sem fechamento", total: 0, status: f?.status ?? "—", itens: [] };
      map[key].total += Number(it.valor_comissao) + Number(it.ajuste_manual ?? 0);
      map[key].itens.push(it);
    }
    return Object.entries(map).sort(([a],[b]) => b.localeCompare(a));
  }, [items]);

  const metasAtivas = metas.filter(m => m.status === "em_andamento" || m.status === "batida");

  return (
    <div className="space-y-4">
      {metasAtivas.map((m: any) => <MetaHero key={m.id} meta={m} />)}
      {items.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground p-12 rounded-xl border border-border bg-surface-1">Nenhuma comissão ainda. Conclua uma venda para gerar.</div>
      ) : porMes.map(([k, grp]) => (
        <div key={k} className="rounded-xl border border-border bg-surface-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="font-display font-semibold">{grp.label}</div>
              <div className="text-xs text-muted-foreground">{grp.itens.length} itens · status <span className="uppercase font-semibold">{grp.status}</span></div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-display text-xl font-bold text-omni">{BRL(grp.total)}</div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface-2"><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Venda</th><th className="px-3 py-2">Operadora</th>
              <th className="px-3 py-2 text-right">Base</th><th className="px-3 py-2 text-right">%</th><th className="px-3 py-2 text-right">Comissão</th>
            </tr></thead>
            <tbody>
              {grp.itens.map((it: any) => (
                <tr key={it.id} className="border-t border-border cursor-pointer hover:bg-surface-2/50"
                  onClick={() => {
                    const detail = buildVendaDetailUrl(it.venda_id);
                    navigate({ to: detail.to, params: detail.params });
                  }}>
                  <td className="px-3 py-2"><div className="font-mono text-xs">{it.vendas?.numero}</div><div className="text-[11px] text-muted-foreground truncate max-w-[260px]">{it.vendas?.cliente_razao_social}</div></td>
                  <td className="px-3 py-2 text-xs">{it.operadora}</td>
                  <td className="px-3 py-2 text-right text-xs">{BRL(Number(it.base_calculo))}</td>
                  <td className="px-3 py-2 text-right text-xs">{Number(it.percentual_aplicado).toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-omni">{BRL(Number(it.valor_comissao) + Number(it.ajuste_manual ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}


function MetaHero({ meta }: { meta: any }) {
  const total = Number(meta.valor_meta || 0);
  const vendido = Number(meta.valor_vendido || 0);
  const pct = total > 0 ? Math.min(100, (vendido / total) * 100) : 0;
  const faltam = Math.max(0, total - vendido);
  const batida = meta.status === "batida";
  const com10 = vendido * 0.10;
  const com20 = vendido * 0.20;
  const extra = com20 - com10;

  return (
    <div className={`rounded-2xl border-2 p-5 relative overflow-hidden ${
      batida
        ? "border-yellow-400 bg-gradient-to-br from-yellow-300 via-yellow-200 to-amber-100 text-black shadow-lg shadow-yellow-400/30"
        : "border-yellow-500/40 bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent"
    }`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`size-14 rounded-2xl grid place-items-center ${batida ? "bg-black text-yellow-400" : "bg-yellow-500/20 text-yellow-500"}`}>
            {batida ? <Trophy className="size-7"/> : <Zap className="size-7"/>}
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{batida ? "🎉 Meta Batida" : "Meta Batida — Potencial de Comissão"}</div>
            <div className="font-display text-xl font-bold">{meta.nome}</div>
            <div className="text-xs opacity-80">{new Date(meta.data_inicio).toLocaleDateString("pt-BR")} → {new Date(meta.data_fim).toLocaleDateString("pt-BR")}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider opacity-80">Meta</div>
          <div className="font-display text-2xl font-bold">{BRL(total)}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex justify-between text-xs mb-1.5 font-semibold">
          <span>Vendido: {BRL(vendido)}</span>
          <span>{pct.toFixed(1)}%</span>
        </div>
        <div className={`h-3 rounded-full overflow-hidden ${batida ? "bg-black/20" : "bg-yellow-500/10"}`}>
          <div className={`h-full transition-all ${batida ? "bg-black" : "bg-gradient-to-r from-yellow-500 to-amber-500"}`} style={{ width: `${pct}%` }} />
        </div>
        {!batida && <div className="text-xs mt-1.5 opacity-80">Faltam <span className="font-bold">{BRL(faltam)}</span> para bater a meta.</div>}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div className={`rounded-lg p-2 ${batida ? "bg-black/10" : "bg-surface-1/60"}`}>
          <div className="text-[10px] uppercase opacity-70">Comissão 10%</div>
          <div className="font-bold">{BRL(com10)}</div>
        </div>
        <div className={`rounded-lg p-2 ${batida ? "bg-black text-yellow-400" : "bg-yellow-500/20"}`}>
          <div className="text-[10px] uppercase opacity-70">{batida ? "Confirmada 20%" : "Se bater 20%"}</div>
          <div className="font-bold">{BRL(com20)}</div>
        </div>
        <div className={`rounded-lg p-2 ${batida ? "bg-black/10" : "bg-surface-1/60"}`}>
          <div className="text-[10px] uppercase opacity-70">Ganho extra</div>
          <div className="font-bold">+{BRL(extra)}</div>
        </div>
      </div>

      <div className={`mt-3 text-xs font-semibold ${batida ? "" : "opacity-80"}`}>
        {batida
          ? "Meta batida! Suas comissões deste período foram dobradas para 20%."
          : "Você ainda está no modo 10%. Bata a meta e dobre sua comissão para 20%."}
      </div>
    </div>
  );
}

function MetasPanel() {
  const list = useServerFn(listMetas);
  const salvar = useServerFn(salvarMeta);
  const remover = useServerFn(removerMeta);
  const listU = useServerFn(listUsuarios);
  const { data: consultoresReais } = useConsultoresReais();
  const [items, setItems] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);

  async function reload() { setItems(await list()); }
  useEffect(() => { reload(); listU().then((u: any) => setUsers(u ?? [])).catch(() => {}); }, []);

  // Prioriza a lista via server fn (admin); se vazia (gestor), usa fallback público via profiles + user_roles.
  // Metas só podem ser vinculadas a perfis cadastrados como consultor.
  const consultores = useMemo(() => {
    const fromUsers = users.filter((u: any) => {
      const roles: string[] = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
      return u.ativo !== false && roles.includes("consultor");
    });
    if (fromUsers.length > 0) return fromUsers;
    return (consultoresReais ?? [])
      .filter(c => c.roles.includes("consultor"))
      .map(c => ({ id: c.id, nome_completo: c.nome_completo, email: c.email, roles: c.roles, ativo: true }));
  }, [users, consultoresReais]);
  const totalMetas = items.length;
  const batidas = items.filter(i => i.status === "batida").length;
  const andamento = items.filter(i => i.status === "em_andamento").length;
  const naoBatidas = items.filter(i => i.status === "nao_batida").length;
  const totalVendido = items.reduce((s, i) => s + Number(i.valor_vendido || 0), 0);

  const STATUS_LABEL: Record<string, { l: string; c: string }> = {
    em_andamento: { l: "Em andamento", c: "bg-info/15 text-info border-info/40" },
    batida: { l: "Meta batida", c: "bg-yellow-400/20 text-yellow-600 border-yellow-500/50" },
    nao_batida: { l: "Não batida", c: "bg-destructive/15 text-destructive border-destructive/40" },
    encerrada: { l: "Encerrada", c: "bg-muted text-muted-foreground border-border" },
    cancelada: { l: "Cancelada", c: "bg-muted text-muted-foreground border-border" },
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card label="Total" value={totalMetas} icon={<Target className="size-4"/>} />
        <Card label="Em andamento" value={andamento} tone="text-info" />
        <Card label="Batidas" value={batidas} tone="text-yellow-500" icon={<Trophy className="size-4"/>} />
        <Card label="Não batidas" value={naoBatidas} tone="text-destructive" />
        <Card label="Vendido total" value={BRL(totalVendido)} tone="text-omni" />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => { setEdit(null); setOpen(true); }} className="bg-omni text-black hover:bg-omni/90"><Plus className="size-4 mr-1.5"/>Nova meta</Button>
      </div>

      <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2"><tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-3 py-2">Meta</th>
            <th className="px-3 py-2">Consultor</th>
            <th className="px-3 py-2">Período</th>
            <th className="px-3 py-2 text-right">Meta</th>
            <th className="px-3 py-2 text-right">Vendido</th>
            <th className="px-3 py-2">Progresso</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Comissão</th>
            <th className="px-3 py-2"></th>
          </tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={9} className="text-center italic text-muted-foreground py-8">Nenhuma meta cadastrada.</td></tr>}
            {items.map(m => {
              const total = Number(m.valor_meta);
              const vend = Number(m.valor_vendido);
              const pct = total > 0 ? Math.min(100, (vend/total)*100) : 0;
              const st = STATUS_LABEL[m.status] ?? STATUS_LABEL.em_andamento;
              const comPct = m.status === "batida" ? 0.20 : 0.10;
              return (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2"><div className="font-semibold">{m.nome}</div>{m.operadora && <div className="text-[10px] text-muted-foreground">{m.operadora}{m.produto ? ` · ${m.produto}`:""}</div>}</td>
                  <td className="px-3 py-2 text-xs">{m.profiles?.nome_completo ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{new Date(m.data_inicio).toLocaleDateString("pt-BR")} → {new Date(m.data_fim).toLocaleDateString("pt-BR")}</td>
                  <td className="px-3 py-2 text-right text-xs">{BRL(total)}</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold">{BRL(vend)}</td>
                  <td className="px-3 py-2 w-[140px]">
                    <div className="h-2 rounded bg-muted overflow-hidden">
                      <div className={`h-full ${m.status==="batida"?"bg-yellow-500":"bg-omni"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{pct.toFixed(0)}%</div>
                  </td>
                  <td className="px-3 py-2"><span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${st.c}`}>{st.l}</span></td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-omni">{BRL(vend * comPct)}<div className="text-[10px] text-muted-foreground">{(comPct*100).toFixed(0)}%</div></td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => { setEdit(m); setOpen(true); }}><Pencil className="size-3.5"/></Button>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={async () => { if(confirm("Excluir meta?")){ await remover({ data: { id: m.id } }); reload(); } }}><Trash2 className="size-3.5"/></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <MetaDialog open={open} onOpenChange={setOpen} initial={edit} consultores={consultores}
        onSave={async (payload: any) => {
          try {
            const { consultor_ids, ...base } = payload;
            const ids: string[] = consultor_ids ?? [];
            if (base.id) {
              await salvar({ data: { ...base, consultor_id: ids[0] } });
            } else {
              for (const cid of ids) {
                const nome = ids.length > 1
                  ? `${base.nome} — ${(consultores.find((c: any) => c.id === cid)?.nome_completo) ?? ""}`.trim()
                  : base.nome;
                await salvar({ data: { ...base, consultor_id: cid, nome } });
              }
            }
            toast.success(ids.length > 1 ? `${ids.length} metas criadas` : "Meta salva");
            setOpen(false); reload();
          }
          catch (e: any) { toast.error(e.message); }
        }} />
    </div>
  );
}

function Card({ label, value, tone, icon }: { label: string; value: any; tone?: string; icon?: any }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{icon}{label}</div>
      <div className={`font-display text-xl font-bold mt-1 ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function MetaDialog({ open, onOpenChange, initial, consultores, onSave }: any) {
  const [f, setF] = useState<any>({});
  const [selecionados, setSelecionados] = useState<string[]>([]);
  useEffect(() => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const last = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
    setF(initial ? { ...initial } : {
      nome: `Meta ${MESES_LONG[now.getMonth()]} ${now.getFullYear()}`,
      mes_ref: now.getMonth()+1, ano_ref: now.getFullYear(),
      data_inicio: first, data_fim: last, valor_meta: 0,
      consultor_id: "", status: "em_andamento",
    });
    setSelecionados(initial?.consultor_id ? [initial.consultor_id] : []);
  }, [initial, open]);

  const allIds = consultores.map((u: any) => u.id);
  const todosMarcados = allIds.length > 0 && selecionados.length === allIds.length;
  const toggle = (id: string, on: boolean) => {
    setSelecionados(prev => on ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id));
  };
  const toggleTodos = (on: boolean) => setSelecionados(on ? allIds : []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "Editar meta" : "Nova meta"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Nome</Label><Input value={f.nome ?? ""} onChange={e => setF({ ...f, nome: e.target.value })} /></div>
          <div><Label>Mês ref.</Label>
            <Select value={String(f.mes_ref ?? 1)} onValueChange={v => setF({ ...f, mes_ref: Number(v) })}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{MESES_LONG.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Ano ref.</Label><Input type="number" value={f.ano_ref ?? ""} onChange={e => setF({ ...f, ano_ref: Number(e.target.value) })}/></div>
          <div><Label>Data inicial</Label><Input type="date" value={f.data_inicio ?? ""} onChange={e => setF({ ...f, data_inicio: e.target.value })}/></div>
          <div><Label>Data final</Label><Input type="date" value={f.data_fim ?? ""} onChange={e => setF({ ...f, data_fim: e.target.value })}/></div>
          <div className="col-span-2">
            <Label>Colaborador{!initial && selecionados.length > 1 ? ` (${selecionados.length} selecionados)` : ""}</Label>
            {initial ? (
              <Select value={f.consultor_id ?? ""} onValueChange={v => { setF({ ...f, consultor_id: v }); setSelecionados([v]); }}>
                <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                <SelectContent>{consultores.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.nome_completo ?? u.email}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <div className="rounded-md border border-border bg-surface-1 max-h-48 overflow-auto">
                <label className="flex items-center gap-2 px-3 py-2 border-b border-border cursor-pointer hover:bg-surface-2 font-medium">
                  <Checkbox checked={todosMarcados} onCheckedChange={v => toggleTodos(!!v)} />
                  <span>Todos ({allIds.length})</span>
                </label>
                {consultores.map((u: any) => (
                  <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-surface-2 text-sm">
                    <Checkbox checked={selecionados.includes(u.id)} onCheckedChange={v => toggle(u.id, !!v)} />
                    <span>{u.nome_completo ?? u.email}</span>
                  </label>
                ))}
                {consultores.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum consultor cadastrado</div>}
              </div>
            )}
          </div>
          <div><Label>Valor da meta (R$)</Label><Input type="number" step="0.01" value={f.valor_meta ?? 0} onChange={e => setF({ ...f, valor_meta: Number(e.target.value) })}/></div>
          <div><Label>Status</Label>
            <Select value={f.status ?? "em_andamento"} onValueChange={v => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="batida">Meta batida</SelectItem>
                <SelectItem value="nao_batida">Não batida</SelectItem>
                <SelectItem value="encerrada">Encerrada</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Operadora (opcional)</Label>
            <Select value={f.operadora ?? "todas"} onValueChange={v => setF({ ...f, operadora: v === "todas" ? null : v })}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="todas">Todas</SelectItem><SelectItem value="CLARO">Claro</SelectItem><SelectItem value="VIVO">Vivo</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Produto (opcional)</Label><Input value={f.produto ?? ""} onChange={e => setF({ ...f, produto: e.target.value || null })}/></div>
          <div className="col-span-2"><Label>Observação</Label><Textarea rows={2} value={f.observacao ?? ""} onChange={e => setF({ ...f, observacao: e.target.value })}/></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => {
            const ids = initial ? (f.consultor_id ? [f.consultor_id] : []) : selecionados;
            if (ids.length === 0) { toast.error("Selecione ao menos um colaborador"); return; }
            onSave({
              id: f.id, nome: f.nome, mes_ref: f.mes_ref, ano_ref: f.ano_ref,
              data_inicio: f.data_inicio, data_fim: f.data_fim,
              valor_meta: Number(f.valor_meta ?? 0),
              consultor_ids: ids,
              operadora: f.operadora ?? null, produto: f.produto ?? null,
              status: f.status ?? "em_andamento", observacao: f.observacao ?? null,
            });
          }} className="bg-omni text-black hover:bg-omni/90">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VisaoColaboradores({ items, metas, filtro, onFiltrar }: { items: any[]; metas: any[]; filtro: string; onFiltrar: (id: string) => void }) {
  const metasEm = metas.filter(m => m.status === "em_andamento").length;
  const metasBatidas = metas.filter(m => m.status === "batida").length;
  const metasNaoBatidas = metas.filter(m => m.status === "nao_batida").length;

  // Agrupa por consultor: soma comissão pendente + total vendido a partir das metas
  const porConsultor: Record<string, { id: string; nome: string; comissoes: number; qtd: number; metas: any[] }> = {};
  for (const it of items) {
    if (it.deleted_at || it.status === "cancelada") continue;
    const id = it.consultor_id ?? "sem";
    if (!porConsultor[id]) porConsultor[id] = { id, nome: it.profiles?.nome_completo ?? it.vendas?.consultor_nome ?? "—", comissoes: 0, qtd: 0, metas: [] };
    porConsultor[id].comissoes += Number(it.valor_comissao || 0);
    porConsultor[id].qtd += 1;
  }
  for (const m of metas) {
    const id = m.consultor_id;
    if (!porConsultor[id]) porConsultor[id] = { id, nome: m.profiles?.nome_completo ?? "—", comissoes: 0, qtd: 0, metas: [] };
    porConsultor[id].metas.push(m);
  }
  const rows = Object.values(porConsultor).sort((a, b) => b.comissoes - a.comissoes);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-info/30 bg-info/5 p-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-info">Metas em andamento</div>
          <div className="font-display text-2xl font-bold mt-1">{metasEm}</div>
        </div>
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-yellow-600 flex items-center gap-1"><Trophy className="size-3"/>Metas batidas</div>
          <div className="font-display text-2xl font-bold mt-1 text-yellow-600">{metasBatidas}</div>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-destructive">Não batidas</div>
          <div className="font-display text-2xl font-bold mt-1">{metasNaoBatidas}</div>
        </div>
        <div className="rounded-xl border border-omni/30 bg-omni/5 p-3">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-omni">Colaboradores</div>
          <div className="font-display text-2xl font-bold mt-1 text-omni">{rows.length}</div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="rounded-xl border border-border bg-surface-1 overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-surface-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visão por colaborador</div>
          <table className="w-full text-sm">
            <thead className="bg-surface-2/50"><tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2">Colaborador</th>
              <th className="px-3 py-2 text-right">Comissões pendentes</th>
              <th className="px-3 py-2 text-right">Valor previsto</th>
              <th className="px-3 py-2">Meta do período</th>
              <th className="px-3 py-2">Progresso</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr></thead>
            <tbody>
              {rows.map(r => {
                const metaAtiva = r.metas.find((m: any) => m.status === "batida" || m.status === "em_andamento");
                const total = metaAtiva ? Number(metaAtiva.valor_meta) : 0;
                const vend = metaAtiva ? Number(metaAtiva.valor_vendido) : 0;
                const pct = total > 0 ? Math.min(100, (vend/total)*100) : 0;
                const batida = metaAtiva?.status === "batida";
                return (
                  <tr key={r.id} className={`border-t border-border ${filtro === r.id ? "bg-omni/5" : ""}`}>
                    <td className="px-3 py-2 font-medium">{r.nome}</td>
                    <td className="px-3 py-2 text-right text-xs">{r.qtd}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-omni">{BRL(r.comissoes)}</td>
                    <td className="px-3 py-2 text-xs">
                      {metaAtiva ? (
                        <div>
                          <div className="font-medium">{metaAtiva.nome}</div>
                          <div className="text-[10px] text-muted-foreground">{BRL(vend)} / {BRL(total)}</div>
                        </div>
                      ) : <span className="text-muted-foreground italic">Sem meta ativa</span>}
                    </td>
                    <td className="px-3 py-2 w-[130px]">
                      {metaAtiva ? (
                        <>
                          <div className="h-2 rounded bg-muted overflow-hidden">
                            <div className={`h-full ${batida ? "bg-yellow-500" : "bg-omni"}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-[10px] mt-0.5 flex items-center gap-1">
                            {batida && <Trophy className="size-3 text-yellow-500"/>}
                            <span className={batida ? "text-yellow-600 font-semibold" : "text-muted-foreground"}>{pct.toFixed(0)}%</span>
                          </div>
                        </>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onFiltrar(filtro === r.id ? "" : r.id)}>
                        {filtro === r.id ? "Limpar" : "Ver vendas"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


