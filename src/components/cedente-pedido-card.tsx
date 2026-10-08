import { useCallback, useEffect, useState } from "react";
import { Building2, ListTree } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CedentesPedidoManager } from "@/components/cedentes-pedido-manager";
import { tipoPedidoExigeCedente } from "@/lib/cedente-rules";

export function CedentePedidoCard({
  vendaId,
  clienteId,
  canManage,
  tipoPedido,
  onChanged,
}: {
  vendaId: string;
  clienteId: string;
  canManage: boolean;
  tipoPedido: string | string[] | null | undefined;
  onChanged?: () => void | Promise<void>;
}) {
  const [quantidadeCedentes, setQuantidadeCedentes] = useState(0);
  const [quantidadeCessionarios, setQuantidadeCessionarios] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const loadCount = useCallback(async () => {
    if (!vendaId) return;
    setLoading(true);
    const [cedentesRes, cessionariosRes] = await Promise.all([
      (supabase as any)
        .from("venda_cedentes")
        .select("cedente_id", { count: "exact", head: true })
        .eq("venda_id", vendaId),
      (supabase as any)
        .from("venda_cessionarios")
        .select("cessionario_id", { count: "exact", head: true })
        .eq("venda_id", vendaId),
    ]);

    if (!cedentesRes.error) setQuantidadeCedentes(cedentesRes.count ?? 0);
    if (!cessionariosRes.error) setQuantidadeCessionarios(cessionariosRes.count ?? 0);
    setLoading(false);
  }, [vendaId]);

  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  const quantidade = quantidadeCedentes + quantidadeCessionarios;
  if (!loading && quantidade === 0 && !tipoPedidoExigeCedente(tipoPedido)) return null;

  async function handleChanged() {
    await loadCount();
    await onChanged?.();
  }

  return (
    <>
      <section className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-omni/25 bg-omni/10">
              <Building2 className="size-4 text-omni" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold">Cedentes / Cessionários do pedido</h3>
                <Badge variant="outline" className="text-[9px]">
                  {loading ? "…" : `${quantidadeCedentes} Ced. · ${quantidadeCessionarios} Cess.`}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Cadastro e edição ficam concentrados no detalhamento.
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setDetailsOpen(true)}
          >
            <ListTree className="size-3.5" />
            Detalhamento
          </Button>
        </div>
      </section>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="w-[min(96vw,900px)] max-w-[900px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cedentes / Cessionários do pedido</DialogTitle>
            <DialogDescription>
              Consulte e gerencie Cedentes (PF/PJ) e Cessionários (PF) cadastrados para esta empresa e este pedido.
            </DialogDescription>
          </DialogHeader>

          {canManage ? (
            <CedentesPedidoManager
              vendaId={vendaId}
              clienteId={clienteId}
              tipoPedido={tipoPedido}
              onChanged={handleChanged}
            />
          ) : (
            <div className="rounded-xl border border-border bg-surface-1/50 p-4 text-xs text-muted-foreground">
              Este perfil pode consultar Cedentes e Cessionários vinculados às linhas, mas não pode alterar o cadastro.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
