import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock3, GripVertical, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePipelineStructure } from "@/hooks/use-pipeline-structure";
import { useHorizontalDragScroll } from "@/hooks/use-horizontal-drag-scroll";
import { cn } from "@/lib/utils";
import { getSupportCases, getSupportUnreadMap, moveSupportCard, type SupportCase } from "@/lib/support.functions";
import { canMoveSupportCard } from "@/lib/support-flow";
import { toast } from "sonner";

export function SupportPipeline({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const { primaryRole, user } = useAuth();
  const { supportStages: stages, loading: structureLoading } = usePipelineStructure("support-pipeline-structure-live");
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [unread, setUnread] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canMove = canMoveSupportCard(primaryRole);
  const horizontalDrag = useHorizontalDragScroll();

  const load = useCallback(async () => {
    try {
      const data = await getSupportCases();
      const activeCases = data.filter(item => Boolean(item.ticket_id));
      setCases(activeCases);
      setUnread(
        user?.id
          ? await getSupportUnreadMap(user.id, activeCases.map(item => item.id))
          : {},
      );
    } catch (error: any) {
      console.error("Erro ao carregar funil de suporte", error);
      toast.error(error?.message || "Erro ao carregar funil de suporte");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("support-pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "suporte_solicitacoes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "suporte_mensagens" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  useEffect(() => {
    onCountChange?.(cases.length);
  }, [cases.length, onCountChange]);

  async function drop(stageId: string) {
    if (!canMove || !dragId) return;
    const item = cases.find(row => row.id === dragId);
    if (!item || item.ticket?.etapa_suporte_id === stageId) {
      setDragId(null);
      return;
    }
    try {
      await moveSupportCard(item.id, stageId);
      const stageName = stages.find(stage => stage.id === stageId)?.nome || stageId;
      toast.success(stageId === "s-concluido" ? "Atendimento concluído" : `Card movido para ${stageName}`);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível mover o card");
    } finally {
      setDragId(null);
    }
  }

  if (loading || structureLoading) {
    return <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Carregando cards de suporte…</div>;
  }

  return (
    <div className="space-y-3">
      <div
        {...horizontalDrag.bind}
        className={cn(
          "omni-kanban-scroll overflow-x-auto pb-4 -mx-4 sm:-mx-6 px-4 sm:px-6 cursor-grab",
          horizontalDrag.dragging && "cursor-grabbing select-none",
        )}
        title="Segure e arraste o fundo do Kanban para navegar horizontalmente"
      >
        <div className="flex gap-3 min-w-min">
          {stages.map(stage => {
            const cards = cases.filter(item => item.ticket?.etapa_suporte_id === stage.id);
            return (
              <div
                key={stage.id}
                onDragOver={event => { if (canMove) event.preventDefault(); }}
                onDrop={() => void drop(stage.id)}
                className="omni-kanban-column w-72 shrink-0 rounded-xl bg-surface-1 border border-border flex flex-col h-[clamp(400px,calc(100dvh-230px),940px)] max-h-[calc(100dvh-230px)] min-h-0"
              >
                <div className="px-3 py-2.5 border-b border-border flex items-center justify-between gap-2 sticky top-0 bg-surface-1 rounded-t-xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("size-2 rounded-full", `bg-[var(--${stage.cor})]`)} />
                    <span className="font-semibold text-xs uppercase tracking-wider truncate">{stage.nome}</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground">{cards.length}</span>
                </div>

                <div className="p-2 space-y-2 overflow-y-auto flex-1">
                  {cards.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground italic border border-dashed border-border/50 rounded-lg">
                      {canMove ? "arraste cards aqui" : "sem cards"}
                    </div>
                  )}
                  {cards.map(item => (
                    <SupportCard
                      key={item.id}
                      item={item}
                      draggable={canMove}
                      hasUnread={Boolean(unread[item.id])}
                      onDragStart={() => setDragId(item.id)}
                      onDragEnd={() => setDragId(null)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SupportCard({ item, draggable, hasUnread, onDragStart, onDragEnd }: {
  item: SupportCase;
  draggable: boolean;
  hasUnread: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const done = item.status === "concluido";
  return (
    <Link
      to="/suporte/$id"
      params={{ id: item.id }}
      draggable={draggable}
      onDragStart={event => {
        if (!draggable) {
          event.preventDefault();
          return;
        }
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group block rounded-lg bg-card border border-border p-3 transition-all relative overflow-hidden",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        "hover:border-omni/40 hover:shadow-[0_8px_24px_-12px_var(--omni)]",
        done && "opacity-85",
      )}
    >
      <span className={cn(
        "absolute left-0 top-0 bottom-0 w-1",
        item.prioridade === "urgente"
          ? "bg-destructive animate-pulse motion-reduce:animate-none"
          : "bg-warning",
      )} />
      <div className="flex items-start justify-between gap-2 pl-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="min-w-0 flex-1 truncate text-sm font-semibold">
              {item.venda?.cliente_razao_social || item.cliente_razao_social || item.cliente_nome || "Cliente não informado"}
            </div>
            {hasUnread && (
              <span className="inline-flex shrink-0 items-center rounded-md border border-yellow-400/45 bg-yellow-400/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-yellow-500">
                Novas Mensagens
              </span>
            )}
          </div>
        </div>
        {draggable && <GripVertical className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />}
      </div>

      <div className="mt-3 border-t border-border/60 pt-2 pl-1.5">
        <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <UserRound className="size-3 shrink-0" />
            <span className="truncate">{item.venda?.consultor_nome || item.criado_por_nome || "Consultor"}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <Clock3 className="size-3" />
            {new Date(item.updated_at).toLocaleDateString("pt-BR")}
          </span>
        </div>
      </div>
    </Link>
  );
}
