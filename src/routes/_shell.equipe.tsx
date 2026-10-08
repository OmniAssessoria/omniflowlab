import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Users, Banknote, Briefcase, Activity, AlertTriangle, Trash2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useColaboradoresDB, type ColaboradorDB } from "@/lib/catalogos";
import { useAuth } from "@/lib/auth";
import { useFeatures } from "@/lib/features";
import { useServerFn } from "@tanstack/react-start";
import { deleteColaborador } from "@/lib/users.functions";
import { toast } from "sonner";
import { PermissionsDialog } from "@/components/permissions-dialog";


export const Route = createFileRoute("/_shell/equipe")({
  component: EquipePage,
});

interface VendaAg {
  consultor_colab_id: string | null;
  valor: number;
  etapa_id: string;
  funil: string;
  tem_erro: boolean | null;
  sla_status_calc: string | null;
  status_pedido: string | null;
  mes_ref: number;
  ano_ref: number;
}

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function EquipePage() {
  const { data: colabs, loading } = useColaboradoresDB();
  const { primaryRole } = useAuth();
  const { comissoesVisible } = useFeatures();
  const isBko = primaryRole === "bko";
  const podeCriar = primaryRole === "admin" || primaryRole === "gestor";
  const podeGerenciarPermissoes = primaryRole === "admin" || primaryRole === "bko";
  const [permissionUserId, setPermissionUserId] = useState<string | null>(null);
  const [vendas, setVendas] = useState<VendaAg[]>([]);
  const [q, setQ] = useState("");
  const [funcaoF, setFuncaoF] = useState("todos");
  const [opF, setOpF] = useState("todos");

  useEffect(() => {
    if (isBko) {
      setVendas([]);
      return;
    }

    let cancelled = false;
    async function reload() {
      const { data } = await supabase
        .from("vendas")
        .select("consultor_colab_id, valor, etapa_id, funil, tem_erro, sla_status_calc, status_pedido, mes_ref, ano_ref, deleted_at, is_deleted")
        .is("deleted_at", null)
        .is("is_deleted", false)
        .limit(20000);
      if (!cancelled) setVendas((data ?? []) as any[]);

    }
    reload();
    const channel = supabase
      .channel("equipe-vendas-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "vendas" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => reload())
      .subscribe();
    const iv = setInterval(reload, 30000);
    return () => { cancelled = true; clearInterval(iv); supabase.removeChannel(channel); };
  }, [isBko]);

  const stats = useMemo(() => {
    const map = new Map<string, {
      abertas: number; concluidas: number; total: number;
      receita: number; pendencias: number; suporte: number; receitaMes: Record<string, number>;
    }>();
    for (const v of vendas) {
      if (!v.consultor_colab_id || (v as any).deleted_at || (v as any).is_deleted) continue;
      const cur = map.get(v.consultor_colab_id) ?? {
        abertas: 0, concluidas: 0, total: 0, receita: 0, pendencias: 0, suporte: 0, receitaMes: {},
      };
      cur.total += 1;
      if (comissoesVisible && !isBko) {
        cur.receita += Number(v.valor ?? 0);
      }
      const terminal = v.status_pedido === "cancelado" || v.status_pedido === "reprovado";
      const concluida = (v.etapa_id ?? "").toLowerCase().includes("conclu") || v.status_pedido === "ativado";
      if (concluida) cur.concluidas += 1;
      else if (!terminal) cur.abertas += 1;
      
      const emSuporte = v.status_pedido === "prd_suporte";
      if (emSuporte) {
        cur.suporte += 1;
        cur.pendencias += 1;
      }
      
      if (v.tem_erro || v.sla_status_calc === "estourado") cur.pendencias += 1;
      const key = `${v.ano_ref}-${String(v.mes_ref).padStart(2,"0")}`;
      if (comissoesVisible && !isBko) {
        cur.receitaMes[key] = (cur.receitaMes[key] ?? 0) + Number(v.valor ?? 0);
      }
      map.set(v.consultor_colab_id, cur);
    }
    return map;
  }, [vendas, comissoesVisible, isBko]);

  const list = useMemo(() => {
    return colabs.filter(c => {
      const colabRaw = c as any;
      if (colabRaw.is_deleted || colabRaw.deleted_at) return false;
      if (isBko && !["gestor", "consultor"].includes(String(c.funcao ?? "").toLowerCase())) return false;
      if (funcaoF !== "todos" && (c.funcao ?? "") !== funcaoF) return false;
      if (opF !== "todos" && !c.operadoras?.includes(opF)) return false;
      if (q && !c.nome_exibicao.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });


  }, [colabs, q, funcaoF, opF, isBko]);

  const funcoes = useMemo(
    () => Array.from(new Set(colabs.map(c => c.funcao).filter(Boolean))) as string[],
    [colabs],
  );

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
            <Users className="size-6 text-omni" /> Equipe
          </h1>
          <p className="text-sm text-muted-foreground">
            {isBko
              ? `Administre permissões individuais de Gestores e Consultores · ${list.length} usuário(s)`
              : `Visualize os usuários ativos cadastrados em Configurações > Usuários · ${colabs.length} colaboradores`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" className="pl-9 bg-surface-1" />
          </div>
          <Select value={funcaoF} onValueChange={setFuncaoF}>
            <SelectTrigger className="w-36 bg-surface-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas funções</SelectItem>
              {funcoes.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={opF} onValueChange={setOpF}>
            <SelectTrigger className="w-32 bg-surface-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas op.</SelectItem>
              <SelectItem value="CLARO">Claro</SelectItem>
              <SelectItem value="VIVO">Vivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">Carregando equipe…</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {list.map(c => (
          <ColabCard
            key={c.id}
            colab={c}
            stats={stats.get(c.id)}
            podeGerenciar={podeCriar}
            podeGerenciarPermissoes={podeGerenciarPermissoes}
            onOpenPermissions={userId => setPermissionUserId(userId)}
            comissoesVisible={comissoesVisible && !isBko}
            permissionOnly={isBko}
          />
        ))}
        {!loading && list.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
            Nenhum colaborador encontrado.
          </div>
        )}
      </div>

      <PermissionsDialog
        userId={permissionUserId}
        open={Boolean(permissionUserId)}
        onOpenChange={open => {
          if (!open) setPermissionUserId(null);
        }}
      />
    </div>
  );
}

function ColabCard({ colab, stats, podeGerenciar, podeGerenciarPermissoes, onOpenPermissions, comissoesVisible, permissionOnly }: {
  colab: ColaboradorDB;
  stats?: { abertas: number; concluidas: number; total: number; receita: number; pendencias: number; suporte: number; receitaMes: Record<string, number> };
  podeGerenciar: boolean;
  podeGerenciarPermissoes: boolean;
  onOpenPermissions: (userId: string) => void;
  comissoesVisible: boolean;
  permissionOnly: boolean;
}) {

  const iniciais = colab.nome_exibicao.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();
  const mesesOrdenados = stats
    ? Object.entries(stats.receitaMes).sort(([a],[b]) => b.localeCompare(a)).slice(0, 3)
    : [];

  return (
    <div className="rounded-xl border border-border bg-card p-4 hover:border-[var(--omni)]/40 transition-all">
      <div className="flex items-center gap-3 mb-3">
        <div className="size-12 rounded-full grid place-items-center text-sm font-bold text-black bg-[var(--omni)]">
          {iniciais || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{colab.nome_exibicao}</div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {colab.funcao && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider">
                {colab.funcao}
              </Badge>
            )}
            {colab.funcao === "Consultor" && colab.operadoras?.map(op => (
              <Badge key={op} variant="outline" className={cn(
                "text-[9px] px-1.5 py-0 h-4 uppercase tracking-wider",
                op === "CLARO" ? "border-[var(--claro)]/40 text-[var(--claro)]" : "border-[var(--vivo)]/40 text-[var(--vivo)]"
              )}>{op}</Badge>
            ))}
          </div>
        </div>
        <span className={cn("size-2 rounded-full", colab.ativo ? "bg-success" : "bg-muted")} />
      </div>

      {!permissionOnly && (
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border text-center">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
              <Activity className="size-3" /> Abertas
            </div>
            <div className="font-display text-lg font-bold text-omni">{stats?.abertas ?? 0}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
              <Briefcase className="size-3" /> Concluídas
            </div>
            <div className="font-display text-lg font-bold">{stats?.concluidas ?? 0}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center justify-center gap-1">
              <AlertTriangle className="size-3" /> Pendências
            </div>
            <div className={cn("font-display text-lg font-bold", (stats?.pendencias ?? 0) > 0 ? "text-warning" : "text-muted-foreground")}>
              {stats?.pendencias ?? 0}
              {stats?.suporte !== undefined && stats.suporte > 0 && (
                <span className="text-[10px] ml-1 text-success">(+{stats.suporte} suporte)</span>
              )}
            </div>
          </div>
        </div>
      )}

      {comissoesVisible && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
            <Banknote className="size-3" /> Receita últimos meses
          </div>
          {mesesOrdenados.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">Sem dados</div>
          ) : (
            <div className="space-y-1">
              {mesesOrdenados.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-mono">{k}</span>
                  <span className="font-semibold text-success">{brl(v)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs pt-1 mt-1 border-t border-border/50">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{brl(stats?.receita ?? 0)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {(podeGerenciar || (podeGerenciarPermissoes && ["gestor", "consultor"].includes(String(colab.funcao).toLowerCase()))) && (
        <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-muted-foreground flex-1">
            {podeGerenciarPermissoes && ["gestor", "consultor"].includes(String(colab.funcao).toLowerCase())
              ? "Permissões individuais organizadas por tela e função."
              : "Gestão de acesso, perfil e senha em Configurações > Usuários."}
          </span>

          {podeGerenciarPermissoes
            && colab.user_id
            && ["gestor", "consultor"].includes(String(colab.funcao).toLowerCase()) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-[10px]"
                onClick={() => onOpenPermissions(colab.user_id!)}
              >
                <ShieldCheck className="size-3.5 text-omni" />
                Permissões
              </Button>
            )}

          {podeGerenciar && <ExcluirColaboradorBtn colab={colab} />}
        </div>
      )}

    </div>
  );
}


function ExcluirColaboradorBtn({ colab }: { colab: ColaboradorDB }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const deletar = useServerFn(deleteColaborador);
  const { primaryRole } = useAuth();

  if (primaryRole !== "admin") return null;

  async function handleConfirm() {
    if (!reason.trim()) return toast.error("Informe o motivo da exclusão");
    setLoading(true);
    try {
      await deletar({ data: { id: colab.id, reason: reason.trim() } });
      toast.success("Colaborador e dados vinculados excluídos com sucesso.");
      setOpen(false);
      setTimeout(() => window.location.reload(), 500);
    } catch (e: any) {
      toast.error("Erro ao excluir", { description: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="size-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="bg-surface-2 border-border max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5" /> Excluir Colaborador
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground pt-2">
              Tem certeza que deseja excluir <strong>{colab.nome_exibicao}</strong>? 
              <br /><br />
              Todos os clientes, pedidos, cards, valores e registros operacionais vinculados a este colaborador serão removidos das áreas principais do sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4 space-y-2">
            <Label className="text-xs">Motivo da exclusão (obrigatório)</Label>
            <textarea
              className="w-full h-24 rounded-md border border-border bg-surface-1 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-omni"
              placeholder="Desligamento, erro de cadastro, etc..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading} className="bg-surface-3 border-border">
              Cancelar
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={loading || !reason.trim()}
              className="font-semibold"
            >
              {loading ? "Excluindo..." : "Confirmar exclusão"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
