import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Bot, Check, ChevronDown, Clock3, History, Pencil, Search, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getSlaState, type SlaVisualState } from "@/lib/status-sla";
import { getMissingAtivado100Dates } from "@/lib/ativado-100";
import { normalizedDisplayKey, uppercaseDisplay } from "@/lib/display-normalization";

type Operadora = "CLARO" | "VIVO";

type StatusCatalogo = {
  id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  sla_horas: number | null;
  is_final: boolean;
};

type HistoricoStatus = {
  id: string;
  venda_id: string;
  status_id: string | null;
  status_nome_snapshot: string;
  user_id: string | null;
  user_nome: string;
  user_role: string | null;
  observacao: string | null;
  observacao_user_nome: string | null;
  observacao_user_role: string | null;
  observacao_em: string | null;
  operadora_snapshot: Operadora | null;
  sla_horas_snapshot: number | null;
  sla_inicio_em: string | null;
  sla_metade_em: string | null;
  sla_limite_em: string | null;
  created_at: string;
};

type RobotStatusLog = {
  id: string;
  venda_id: string | null;
  venda_numero: string | null;
  created_at: string;
  robo_nome: string | null;
  origem: string | null;
  campo: string | null;
  campo_label: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  descricao: string | null;
  detalhes: Record<string, unknown> | null;
  observacao_bko: string | null;
  observacao_bko_user_nome: string | null;
  observacao_bko_user_role: string | null;
  observacao_bko_em: string | null;
};

type UnifiedStatusEvent =
  | {
      id: string;
      origem: "manual";
      created_at: string;
      nome: string;
      label: string;
      ator: string;
      atorRole: string | null;
      manual: HistoricoStatus;
    }
  | {
      id: string;
      origem: "robo";
      created_at: string;
      nome: string;
      label: string;
      ator: string;
      atorRole: "robo";
      robo: RobotStatusLog;
    };

const SLA_LABEL: Record<SlaVisualState, string> = {
  sem_sla: "Sem SLA",
  verde: "SLA verde",
  laranja: "SLA laranja",
  vermelho: "SLA vencido",
};

function roleLabel(role?: string | null) {
  if (!role) return "Usuário";
  if (role === "admin") return "Administrador";
  if (role === "bko") return "BKO";
  if (role === "gestor") return "Gestor";
  if (role === "consultor") return "Consultor";
  if (role === "suporte") return "Suporte";
  if (role === "robo") return "Automação";
  return role;
}

function fmtDataHora(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function slaClass(state: SlaVisualState) {
  if (state === "verde") return "border-success/40 bg-success/10 text-success";
  if (state === "laranja") return "border-warning/50 bg-warning/10 text-warning";
  if (state === "vermelho") return "border-destructive/50 bg-destructive/10 text-destructive";
  return "border-border text-muted-foreground";
}

function extractMissingDates(message?: string | null) {
  if (!message?.includes("ATIVADO_100_DATAS_PENDENTES:")) return [];
  const raw = message.split("ATIVADO_100_DATAS_PENDENTES:")[1]?.split("\n")[0] ?? "";
  return raw.split("|").map(item => item.trim()).filter(Boolean);
}

export function StatusComercialPedido({
  vendaId,
  operadora,
  canEdit,
  onChanged,
}: {
  vendaId: string;
  operadora?: Operadora;
  canEdit: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const { user, profile, roles } = useAuth();
  const [catalogo, setCatalogo] = useState<StatusCatalogo[]>([]);
  const [historico, setHistorico] = useState<HistoricoStatus[]>([]);
  const [robotHistorico, setRobotHistorico] = useState<RobotStatusLog[]>([]);
  const [vendaNumero, setVendaNumero] = useState<string | null>(null);
  const [detectedOperadora, setDetectedOperadora] = useState<Operadora | null>(operadora ?? null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [novaObservacao, setNovaObservacao] = useState("");
  const [savingObservacao, setSavingObservacao] = useState(false);
  const [observacaoEditOpen, setObservacaoEditOpen] = useState(false);
  const [novaObservacaoRobo, setNovaObservacaoRobo] = useState("");
  const [savingObservacaoRobo, setSavingObservacaoRobo] = useState(false);
  const [observacaoRoboEditOpen, setObservacaoRoboEditOpen] = useState(false);
  const [operadoraAlteradaEm, setOperadoraAlteradaEm] = useState<string | null>(null);
  const [pendingFinal, setPendingFinal] = useState<StatusCatalogo | null>(null);
  const [clock, setClock] = useState(() => new Date());

  const rolePodeEditar = roles.includes("admin") || roles.includes("bko");
  const podeAlterar = canEdit && rolePodeEditar;
  const operadoraAtual = operadora ?? detectedOperadora;

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const carregar = useCallback(async () => {
    if (!vendaId) return;
    setLoading(true);
    try {
      const { data: vendaData, error: vendaError } = await (supabase as any)
        .from("vendas")
        .select("operadora, numero")
        .eq("id", vendaId)
        .maybeSingle();
      if (vendaError) throw vendaError;

      const resolvedOperadora = operadora ?? (vendaData?.operadora as Operadora | undefined);
      const resolvedNumero = (vendaData?.numero as string | undefined) ?? null;

      if (!resolvedOperadora) throw new Error("Operadora do pedido não encontrada.");
      setDetectedOperadora(resolvedOperadora);
      setVendaNumero(resolvedNumero);

      let robotQuery = (supabase as any)
        .from("venda_robo_logs")
        .select("id, venda_id, venda_numero, created_at, robo_nome, origem, campo, campo_label, valor_anterior, valor_novo, descricao, detalhes, observacao_bko, observacao_bko_user_nome, observacao_bko_user_role, observacao_bko_em")
        .in("campo", ["status_pedido", "status_comercial_nome", "status_portabilidade", "status_biometria"])
        .not("valor_novo", "is", null)
        .order("created_at", { ascending: false });

      robotQuery = resolvedNumero
        ? robotQuery.or(`venda_id.eq.${vendaId},venda_numero.eq.${resolvedNumero}`)
        : robotQuery.eq("venda_id", vendaId);

      const [
        { data: relationData, error: relationError },
        { data: historicoData, error: historicoError },
        { data: robotData, error: robotError },
        { data: operatorChangeData, error: operatorChangeError },
      ] = await Promise.all([
        (supabase as any)
          .from("status_comercial_operadoras")
          .select("status_id, nome, sla_horas, ativo, is_final, status_comercial_catalogo!inner(id, ordem, ativo)")
          .eq("operadora", resolvedOperadora)
          .eq("ativo", true)
          .eq("status_comercial_catalogo.ativo", true),
        (supabase as any)
          .from("venda_status_comercial_historico")
          .select("id, venda_id, status_id, status_nome_snapshot, user_id, user_nome, user_role, observacao, observacao_user_nome, observacao_user_role, observacao_em, operadora_snapshot, sla_horas_snapshot, sla_inicio_em, sla_metade_em, sla_limite_em, created_at")
          .eq("venda_id", vendaId)
          .order("created_at", { ascending: false }),
        robotQuery,
        (supabase as any)
          .from("venda_historico")
          .select("created_at")
          .eq("venda_id", vendaId)
          .eq("campo", "operadora")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (relationError) throw relationError;
      if (historicoError) throw historicoError;
      if (robotError) throw robotError;
      if (operatorChangeError) throw operatorChangeError;

      const itens = (relationData ?? []).map((row: any) => ({
        id: row.status_comercial_catalogo.id,
        nome: row.nome,
        ordem: row.status_comercial_catalogo.ordem,
        ativo: row.status_comercial_catalogo.ativo,
        sla_horas: row.sla_horas ?? null,
        is_final: Boolean(row.is_final),
      })).sort((a: StatusCatalogo, b: StatusCatalogo) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));

      const statusUnicos = new Map<string, StatusCatalogo>();
      for (const item of itens) {
        const key = normalizedDisplayKey(item.nome);
        if (key && !statusUnicos.has(key)) statusUnicos.set(key, item);
      }

      setCatalogo(Array.from(statusUnicos.values()));
      setHistorico((historicoData ?? []) as HistoricoStatus[]);
      setRobotHistorico((robotData ?? []) as RobotStatusLog[]);
      setOperadoraAlteradaEm(operatorChangeData?.created_at ?? null);
    } catch (error: any) {
      console.error("[STATUS COMERCIAL]", error);
      toast.error("Não foi possível carregar o Status Comercial.", { description: error?.message });
    } finally {
      setLoading(false);
    }
  }, [vendaId, operadora]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!vendaId) return;

    const manualChannel = supabase
      .channel(`status-comercial-manual-${vendaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venda_status_comercial_historico", filter: `venda_id=eq.${vendaId}` },
        () => void carregar(),
      )
      .subscribe();

    const robotChannel = supabase
      .channel(`status-comercial-robo-${vendaId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venda_robo_logs", filter: `venda_id=eq.${vendaId}` },
        (payload: any) => {
          const campo = payload?.new?.campo ?? payload?.old?.campo;
          if (["status_pedido", "status_comercial_nome", "status_portabilidade", "status_biometria"].includes(campo)) {
            void carregar();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(manualChannel);
      supabase.removeChannel(robotChannel);
    };
  }, [vendaId, vendaNumero, carregar]);

  const manualAtual = historico[0] ?? null;

  const timeline = useMemo<UnifiedStatusEvent[]>(() => {
    const manuais: UnifiedStatusEvent[] = historico.map(item => ({
      id: `manual-${item.id}`,
      origem: "manual",
      created_at: item.created_at,
      nome: item.status_nome_snapshot,
      label: "Status Comercial",
      ator: item.user_nome || "Usuário",
      atorRole: item.user_role,
      manual: item,
    }));

    const robos: UnifiedStatusEvent[] = robotHistorico
      .filter(item => Boolean(item.valor_novo))
      .map(item => ({
        id: `robo-${item.id}`,
        origem: "robo",
        created_at: item.created_at,
        nome: item.valor_novo || "Status atualizado",
        label: item.campo_label || "Status do pedido",
        ator: item.robo_nome || "Robô OMNI",
        atorRole: "robo",
        robo: item,
      }));

    return [...manuais, ...robos].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [historico, robotHistorico]);

  const timelineDaOperadoraAtual = useMemo(() => {
    if (!operadoraAlteradaEm) return timeline;
    const limite = new Date(operadoraAlteradaEm).getTime();
    return timeline.filter(item => new Date(item.created_at).getTime() >= limite);
  }, [timeline, operadoraAlteradaEm]);

  const atual = timelineDaOperadoraAtual[0] ?? null;
  const anteriores = atual
    ? timeline.filter(item => item.id !== atual.id)
    : timeline;
  const slaAtual = getSlaState({
    startedAt: atual?.origem === "manual" ? atual.manual.sla_inicio_em : null,
    slaHours: atual?.origem === "manual" ? atual.manual.sla_horas_snapshot : null,
    now: clock,
  });

  async function alterarStatus(status: StatusCatalogo) {
    if (!podeAlterar || saving) return;

    // Compara com o status realmente vigente na linha do tempo unificada.
    // O último status manual pode ter sido superado depois por uma atualização do robô;
    // nesse caso BKO/Admin precisam conseguir selecionar novamente o status manual
    // para corrigir o pedido, inclusive após a conclusão.
    if (normalizedDisplayKey(atual?.nome) === normalizedDisplayKey(status.nome)) {
      toast.info("Esse já é o Status Comercial ativo.");
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      const role = roles.includes("admin") ? "admin" : roles.includes("bko") ? "bko" : roles[0] || "consultor";
      const userNome = profile?.nome_completo ?? user?.email ?? "Sistema";

      if (status.is_final) {
        const { data: vendaDatas, error: datasError } = await (supabase as any)
          .from("vendas")
          .select("data_recebimento, data_preenchimento, data_aceite, data_input, data_ativacao, data_portabilidade, data_entrega")
          .eq("id", vendaId)
          .maybeSingle();
        if (datasError) throw datasError;

        const faltantes = getMissingAtivado100Dates(vendaDatas ?? {});
        if (faltantes.length > 0) {
          throw new Error(`ATIVADO_100_DATAS_PENDENTES:${faltantes.join("|")}`);
        }
      }

      const { error } = await (supabase as any)
        .from("venda_status_comercial_historico")
        .insert({
          venda_id: vendaId,
          status_id: status.id,
          status_nome_snapshot: status.nome,
          observacao: null,
          user_id: user?.id ?? null,
          user_nome: userNome,
          user_role: role,
        });

      if (error) throw error;

      const statusFinal = status.is_final;
      toast.success(statusFinal ? `Venda marcada como ${status.nome}.` : "Status Comercial atualizado.", {
        description: status.nome,
      });
      setOpen(false);
      setPendingFinal(null);
      setNovaObservacao("");
      await carregar();
      await onChanged?.();
    } catch (error: any) {
      console.error("[STATUS COMERCIAL]", error);
      const faltantes = extractMissingDates(error?.message);
      if (faltantes.length > 0) {
        toast.error(`Não é possível marcar ${status.nome}.`, {
          description: `Preencha as Datas do Sistema: ${faltantes.join(", ")}.`,
        });
      } else {
        toast.error("Não foi possível alterar o Status Comercial.", {
          description: error?.message,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  async function salvarObservacaoAtual() {
    const texto = novaObservacao.trim();
    if (!podeAlterar || !manualAtual || !texto || savingObservacao) return;

    setSavingObservacao(true);
    try {
      const { error } = await (supabase as any).rpc("atualizar_observacao_status_comercial", {
        p_venda_id: vendaId,
        p_observacao: texto,
      });
      if (error) throw error;

      setNovaObservacao("");
      setObservacaoEditOpen(false);
      await carregar();
      await onChanged?.();
      toast.success("Observação adicionada ao Status Comercial.");
    } catch (error: any) {
      console.error("[OBSERVAÇÃO STATUS COMERCIAL]", error);
      toast.error("Não foi possível salvar a observação.", { description: error?.message });
    } finally {
      setSavingObservacao(false);
    }
  }

  async function salvarObservacaoRoboAtual() {
    const texto = novaObservacaoRobo.trim();
    if (!podeAlterar || atual?.origem !== "robo" || !texto || savingObservacaoRobo) return;

    setSavingObservacaoRobo(true);
    try {
      const { error } = await (supabase as any).rpc("atualizar_observacao_status_robo", {
        p_venda_id: vendaId,
        p_robo_log_id: atual.robo.id,
        p_observacao: texto,
      });
      if (error) throw error;

      setNovaObservacaoRobo("");
      setObservacaoRoboEditOpen(false);
      await carregar();
      await onChanged?.();
      toast.success("Observação adicionada ao status do robô.");
    } catch (error: any) {
      console.error("[OBSERVAÇÃO STATUS ROBÔ]", error);
      toast.error("Não foi possível salvar a observação do status automático.", {
        description: error?.message,
      });
    } finally {
      setSavingObservacaoRobo(false);
    }
  }

  function selecionarStatus(status: StatusCatalogo) {
    if (status.is_final) {
      setPendingFinal(status);
      return;
    }
    void alterarStatus(status);
  }

  return (
    <div className="omni-status-card rounded-xl border border-border bg-card p-4 h-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-[var(--omni)]" />
            <h3 className="font-display font-semibold text-sm">Status Comercial</h3>
          </div>
        </div>

        {podeAlterar && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => setOpen(true)}
          >
            Alterar status <ChevronDown className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="rounded-xl border border-border/60 bg-background/30 p-5 text-sm text-muted-foreground">
            Carregando Status Comercial…
          </div>
        ) : atual ? (
          <div className="omni-status-active-card rounded-xl border border-[var(--omni)]/45 bg-[var(--omni)]/5 p-4 shadow-[0_0_24px_-16px_var(--omni)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--omni)] opacity-50" />
                  <span className="relative inline-flex size-3 rounded-full bg-[var(--omni)]" />
                </span>
                <span className="text-[10px] font-bold tracking-[0.18em] text-[var(--omni)]">STATUS ATIVO</span>
                {atual.origem === "robo" && (
                  <Badge variant="outline" className="gap-1 border-purple/35 bg-purple/10 text-[9px] font-bold text-purple">
                    <Bot className="size-3" /> ROBÔ
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="size-3.5" /> {fmtDataHora(atual.created_at)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {atual.origem === "robo" ? <Bot className="size-3.5 text-purple" /> : <UserRound className="size-3.5" />}
                    {atual.ator} · {roleLabel(atual.atorRole)}
                  </span>
                </div>
                {atual.origem === "manual" ? (
                  <Badge variant="outline" className={cn("text-[9px]", slaClass(slaAtual))}>
                    {SLA_LABEL[slaAtual]}
                    {atual.manual.sla_horas_snapshot ? ` · ${atual.manual.sla_horas_snapshot}h` : ""}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] border-purple/30 text-purple">
                    {atual.label}
                  </Badge>
                )}
              </div>
            </div>

            <div className="mt-2 text-lg font-display font-bold leading-tight">
              {uppercaseDisplay(atual.nome)}
            </div>

            {atual.origem === "robo" && atual.robo.valor_anterior && (
              <div className="mt-2 text-[11px] text-muted-foreground">
                <span className="font-medium">{atual.label}:</span>{" "}
                <span className="line-through opacity-65">{atual.robo.valor_anterior}</span>
                <span className="mx-1.5">→</span>
                <span className="font-semibold text-foreground">{atual.robo.valor_novo}</span>
              </div>
            )}

            {atual.origem === "manual" && atual.manual.observacao && (
              <div className="omni-status-observation mt-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">{atual.manual.observacao}</div>
                  {podeAlterar && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                      title="Editar observação"
                      onClick={() => {
                        setNovaObservacao(atual.manual.observacao ?? "");
                        setObservacaoEditOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                </div>
                {atual.manual.observacao_em && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {uppercaseDisplay(atual.manual.observacao_user_nome, "USUÁRIO")} · {roleLabel(atual.manual.observacao_user_role)} · {fmtDataHora(atual.manual.observacao_em)}
                  </div>
                )}
              </div>
            )}

            {podeAlterar && atual.origem === "manual" && !atual.manual.observacao && (
              <div className="mt-2">
                <Input
                  value={novaObservacao}
                  onChange={(event) => setNovaObservacao(event.target.value)}
                  placeholder="Adicionar observação e pressione Enter…"
                  disabled={savingObservacao}
                  className="h-9 bg-background/55 text-xs"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void salvarObservacaoAtual();
                    }
                  }}
                />
              </div>
            )}

            {atual.origem === "robo" && atual.robo.observacao_bko && (
              <div className="omni-status-observation mt-2 rounded-lg border border-purple/20 bg-purple/[0.035] px-3 py-2 text-xs">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">{atual.robo.observacao_bko}</div>
                  {podeAlterar && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                      title="Editar observação"
                      onClick={() => {
                        setNovaObservacaoRobo(atual.robo.observacao_bko ?? "");
                        setObservacaoRoboEditOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                </div>
                {atual.robo.observacao_bko_em && (
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {uppercaseDisplay(atual.robo.observacao_bko_user_nome, "USUÁRIO")} · {roleLabel(atual.robo.observacao_bko_user_role)} · {fmtDataHora(atual.robo.observacao_bko_em)}
                  </div>
                )}
              </div>
            )}

            {podeAlterar && atual.origem === "robo" && !atual.robo.observacao_bko && (
              <div className="mt-2">
                <Input
                  value={novaObservacaoRobo}
                  onChange={(event) => setNovaObservacaoRobo(event.target.value)}
                  placeholder="Adicionar informação sobre este status e pressione Enter…"
                  disabled={savingObservacaoRobo}
                  className="h-9 border-purple/20 bg-background/55 text-xs focus-visible:ring-purple/30"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void salvarObservacaoRoboAtual();
                    }
                  }}
                />
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Informação vinculada a este status automático. Fica registrada no histórico com usuário, data e hora.
                </div>
              </div>
            )}


          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-background/25 p-5">
            <div className="text-sm font-semibold">Nenhum status registrado</div>
            {!podeAlterar && (
              <p className="mt-1 text-xs text-muted-foreground">
                Aguardando atualização manual ou automática.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-border/60 pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <History className="size-3.5 text-muted-foreground" /> Histórico de Status
          </div>
          <span className="text-[10px] text-muted-foreground">
            {timeline.length} {timeline.length === 1 ? "movimentação" : "movimentações"}
          </span>
        </div>

        {anteriores.length === 0 ? (
          atual ? null : (
            <p className="text-[11px] text-muted-foreground">
              O histórico aparecerá após a primeira atualização manual ou automática.
            </p>
          )
        ) : (
          <div className="max-h-60 overflow-y-auto pr-1 space-y-1.5">
            {anteriores.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "relative rounded-lg border px-3 py-2.5",
                  item.origem === "robo"
                    ? "border-purple/20 bg-purple/[0.035]"
                    : "border-border/55 bg-background/25",
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex flex-col items-center">
                    {item.origem === "robo" ? (
                      <span className="grid size-5 place-items-center rounded-full border border-purple/30 bg-purple/10 text-purple">
                        <Bot className="size-3" />
                      </span>
                    ) : (
                      <span className="grid size-5 place-items-center rounded-full border border-border bg-surface-1 text-muted-foreground">
                        <UserRound className="size-3" />
                      </span>
                    )}
                    {index < anteriores.length - 1 && <span className="mt-1 h-7 w-px bg-border" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs font-semibold leading-snug">{uppercaseDisplay(item.nome)}</div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[8px]",
                          item.origem === "robo"
                            ? "border-purple/30 text-purple"
                            : "text-muted-foreground",
                        )}
                      >
                        {item.origem === "robo"
                          ? item.label
                          : item.manual.sla_horas_snapshot
                            ? `${item.manual.sla_horas_snapshot}h`
                            : "Sem SLA"}
                      </Badge>
                      <Badge variant="outline" className="text-[8px] text-muted-foreground">
                        {item.origem === "robo" ? "ROBÔ" : "MANUAL"}
                      </Badge>
                    </div>

                    {item.origem === "robo" && item.robo.valor_anterior && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {item.robo.valor_anterior} <span className="mx-1">→</span>{" "}
                        <span className="font-medium text-foreground">{item.robo.valor_novo}</span>
                      </div>
                    )}

                    {item.origem === "manual" && item.manual.observacao && (
                      <div className="mt-1 text-[11px] text-foreground/80">{item.manual.observacao}</div>
                    )}

                    {item.origem === "robo" && item.robo.observacao_bko && (
                      <div className="mt-1 rounded-md border border-purple/15 bg-purple/[0.025] px-2 py-1.5 text-[11px] text-foreground/80">
                        {item.robo.observacao_bko}
                        {item.robo.observacao_bko_em && (
                          <div className="mt-0.5 text-[9px] text-muted-foreground">
                            {uppercaseDisplay(item.robo.observacao_bko_user_nome, "USUÁRIO")} · {roleLabel(item.robo.observacao_bko_user_role)} · {fmtDataHora(item.robo.observacao_bko_em)}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                      <span>{fmtDataHora(item.created_at)}</span>
                      <span className="inline-flex items-center gap-1">
                        {item.origem === "robo" && <Bot className="size-3 text-purple" />}
                        {uppercaseDisplay(item.ator)} · {roleLabel(item.atorRole)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={observacaoRoboEditOpen}
        onOpenChange={(next) => {
          if (savingObservacaoRobo) return;
          setObservacaoRoboEditOpen(next);
          if (!next) setNovaObservacaoRobo("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar observação</DialogTitle>
            <DialogDescription>
              Altere a observação vinculada ao status automático atual.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={novaObservacaoRobo}
            onChange={(event) => setNovaObservacaoRobo(event.target.value)}
            disabled={savingObservacaoRobo}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void salvarObservacaoRoboAtual();
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              className="gap-1.5"
              disabled={!novaObservacaoRobo.trim() || savingObservacaoRobo}
              onClick={() => void salvarObservacaoRoboAtual()}
            >
              <Check className="size-3.5" />
              {savingObservacaoRobo ? "Alterando…" : "Alterar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={observacaoEditOpen}
        onOpenChange={(next) => {
          if (savingObservacao) return;
          setObservacaoEditOpen(next);
          if (!next) setNovaObservacao("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar observação</DialogTitle>
            <DialogDescription>
              Altere a observação vinculada ao Status Comercial atual.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={novaObservacao}
            onChange={(event) => setNovaObservacao(event.target.value)}
            disabled={savingObservacao}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void salvarObservacaoAtual();
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              className="gap-1.5"
              disabled={!novaObservacao.trim() || savingObservacao}
              onClick={() => void salvarObservacaoAtual()}
            >
              <Check className="size-3.5" />
              {savingObservacao ? "Alterando…" : "Alterar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-2">
            <DialogTitle>Alterar Status Comercial</DialogTitle>
            <DialogDescription>
              São exibidos somente os status disponíveis para {operadoraAtual ?? "a operadora do pedido"}. Cada troca inicia um novo ciclo de SLA e fica registrada no histórico.
            </DialogDescription>
          </DialogHeader>

          <Command className="border-t border-border">
            <CommandInput placeholder="Pesquisar status comercial..." aria-label="Pesquisar status" />
            <CommandList className="max-h-[420px]">
              <CommandEmpty>
                <div className="py-6 text-center text-sm text-muted-foreground">
                  <Search className="mx-auto mb-2 size-4" />
                  Nenhum status encontrado.
                </div>
              </CommandEmpty>

              <CommandGroup heading="STATUS DISPONÍVEIS">
                {catalogo.map((status) => {
                  const active = manualAtual?.status_id === status.id || normalizedDisplayKey(manualAtual?.status_nome_snapshot) === normalizedDisplayKey(status.nome);
                  return (
                    <CommandItem
                      key={status.id}
                      value={status.nome}
                      disabled={saving}
                      onSelect={() => selecionarStatus(status)}
                      className={cn(
                        "flex items-center gap-2 py-2.5",
                        active && "bg-[var(--omni)]/10 text-[var(--omni)]",
                      )}
                    >
                      <span className="min-w-0 flex-1 text-xs font-medium">{uppercaseDisplay(status.nome)}</span>
                      <span className="text-[9px] text-muted-foreground">{status.sla_horas ? `${status.sla_horas}h` : "Sem SLA"}</span>
                      {active && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-wider">
                          <Check className="size-3" /> ATIVO
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingFinal)} onOpenChange={(next) => !next && !saving && setPendingFinal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirmar {uppercaseDisplay(pendingFinal?.nome, "STATUS FINAL")}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este marco torna a venda contabilizável comercialmente e não conclui nem reabre o Pipeline. As Datas do Sistema obrigatórias precisam estar preenchidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingFinal || saving}
              onClick={() => pendingFinal && void alterarStatus(pendingFinal)}
            >
              {saving ? "Validando…" : `Confirmar ${uppercaseDisplay(pendingFinal?.nome, "STATUS FINAL")}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
