import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { MoveVendaDialog } from "@/components/move-venda-dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { useOmni } from "@/lib/omni-store";
import { missingRequiredCompletionDates } from "@/lib/clientes-pedidos-rules";
import { canConcludeCommercialOrder } from "@/lib/pipeline-movement";
import type { PipelineEtapa, PipelineFunil } from "@/lib/pipeline-structure";
import type { Venda } from "@/lib/mock-data";

export function VendaLifecycleActions({
  venda,
  funis,
  etapas,
  showMove = true,
}: {
  venda: Venda;
  funis: PipelineFunil[];
  etapas: PipelineEtapa[];
  showMove?: boolean;
}) {
  const { primaryRole } = useAuth();
  const { concluirVenda } = useOmni();
  const [finishOpen, setFinishOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const visibleCommercialFunilIds = funis
    .filter(item => item.ativo && item.participa_fluxo_comercial)
    .sort((a, b) => a.ordem - b.ordem)
    .map(item => item.id);
  const canFinish = canConcludeCommercialOrder(primaryRole, venda.etapaId, venda.concluidoEm);

  function requestFinish() {
    const missingDates = missingRequiredCompletionDates(venda);
    if (missingDates.length > 0) {
      toast.error("Preencha as Datas do Sistema obrigatórias", {
        description: missingDates.join(", "),
      });
      return;
    }
    setFinishOpen(true);
  }

  async function finish() {
    if (working) return;
    setWorking(true);
    try {
      if (await concluirVenda(venda.id)) setFinishOpen(false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      {showMove && !venda.concluidoEm && (
        <MoveVendaDialog
          vendaId={venda.id}
          vendaNumero={venda.numero}
          currentFunilId={venda.funil}
          currentEtapaId={venda.etapaId}
          role={primaryRole}
          funis={funis}
          etapas={etapas}
          visibleCommercialFunilIds={visibleCommercialFunilIds}
        />
      )}

      {canFinish && (
        <Button size="sm" className="gap-2 bg-success text-white hover:bg-success/90" onClick={requestFinish}>
          <CheckCircle2 className="size-3.5" /> Concluir pedido
        </Button>
      )}

      <AlertDialog open={finishOpen} onOpenChange={setFinishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Concluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido sairá definitivamente do Pipeline ativo e continuará disponível em Clientes / Pedidos para consulta e trabalho operacional permitido. Esta ação não possui reabertura.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={working} onClick={() => void finish()}>{working ? "Concluindo…" : "Concluir pedido"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
