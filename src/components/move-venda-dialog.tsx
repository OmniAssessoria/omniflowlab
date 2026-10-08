import { useMemo, useState } from "react";
import { Check, MoveRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useOmni } from "@/lib/omni-store";
import {
  availableCommercialDestinations,
  canMoveCommercialOrder,
  type CommercialMovementRole,
} from "@/lib/pipeline-movement";
import type { PipelineEtapa, PipelineFunil } from "@/lib/pipeline-structure";

type Props = {
  vendaId: string;
  vendaNumero: string;
  currentFunilId: string;
  currentEtapaId: string;
  role: CommercialMovementRole | null | undefined;
  funis: PipelineFunil[];
  etapas: PipelineEtapa[];
  visibleCommercialFunilIds: string[];
  compact?: boolean;
  onMoved?: () => void | Promise<void>;
};

export function MoveVendaDialog({
  vendaId,
  vendaNumero,
  currentFunilId,
  currentEtapaId,
  role,
  funis,
  etapas,
  visibleCommercialFunilIds,
  compact = false,
  onMoved,
}: Props) {
  const { moveVenda, vendas } = useOmni();
  const [open, setOpen] = useState(false);
  const [selectedEtapaId, setSelectedEtapaId] = useState("");
  const [working, setWorking] = useState(false);
  const operadora = vendas.find(item => item.id === vendaId)?.operadora ?? null;

  const destinations = useMemo(
    () => availableCommercialDestinations({
      funis,
      etapas,
      visibleFunilIds: visibleCommercialFunilIds,
      currentFunilId,
      currentEtapaId,
      role,
      operadora,
    }),
    [funis, etapas, visibleCommercialFunilIds, currentFunilId, currentEtapaId, role, operadora],
  );

  const selected = destinations.find(item => item.etapaId === selectedEtapaId) ?? null;
  const allowed = canMoveCommercialOrder(role);

  const reset = () => {
    setSelectedEtapaId("");
  };

  async function confirmMove() {
    if (!selected || working) return;
    setWorking(true);
    try {
      const moved = await moveVenda(vendaId, selected.etapaId);
      if (!moved) return;
      setOpen(false);
      reset();
      await onMoved?.();
    } finally {
      setWorking(false);
    }
  }

  if (!allowed) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={compact ? "h-7 px-2 gap-1 text-[10px]" : "gap-2"}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <MoveRight className={compact ? "size-3" : "size-4"} /> Mover
          </Button>
        </DialogTrigger>
        <DialogContent
          className="sm:max-w-lg"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>Mover pedido {vendaNumero}</DialogTitle>
            <DialogDescription>
              Selecione a etapa de destino permitida para o seu perfil e confirme em Mover.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label>Destino comercial</Label>

            <div className="max-h-[320px] space-y-1.5 overflow-y-auto rounded-lg border border-border p-1.5">
              {destinations.map(item => {
                const active = item.etapaId === selectedEtapaId;
                return (
                  <button
                    key={item.etapaId}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedEtapaId(item.etapaId);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left transition-all",
                      active
                        ? "border-[var(--omni)] bg-[var(--omni)]/10 shadow-[0_0_0_1px_var(--omni)]"
                        : "border-transparent bg-surface-1 hover:border-border hover:bg-surface-2",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold">{item.etapaNome}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{item.funilNome}</span>
                    </span>

                    <span
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-full border",
                        active
                          ? "border-[var(--omni)] bg-[var(--omni)] text-black"
                          : "border-border bg-background",
                      )}
                    >
                      {active && <Check className="size-3.5" />}
                    </span>
                  </button>
                );
              })}

              {destinations.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  Nenhum destino comercial permitido está disponível para este pedido.
                </p>
              )}
            </div>

            {selected && (
              <div className="rounded-md border border-[var(--omni)]/25 bg-[var(--omni)]/5 px-3 py-2 text-[11px]">
                <span className="text-muted-foreground">Selecionado: </span>
                <strong>{selected.funilNome} → {selected.etapaNome}</strong>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              disabled={working}
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={!selected || working}
              onClick={(event) => {
                event.stopPropagation();
                void confirmMove();
              }}
              className="bg-omni text-black hover:bg-omni-glow"
            >
              <MoveRight className="mr-1 size-4" />
              {working ? "Movendo…" : "Mover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
