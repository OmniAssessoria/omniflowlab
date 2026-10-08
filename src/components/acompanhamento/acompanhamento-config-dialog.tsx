import { Settings2 } from "lucide-react";
import type { AcompanhamentoBootstrap } from "@/lib/acompanhamento.types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfigSummary } from "./config-summary";
import { TipoClassificacaoPanel } from "./tipo-classificacao-panel";
import { QuadroConfigButton } from "./quadro-rule-editor";

export function AcompanhamentoConfigDialog({
  data,
  open,
  onOpenChange,
  onReload,
}: {
  data: AcompanhamentoBootstrap;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReload: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-4 text-omni" /> Configurações do acompanhamento
          </DialogTitle>
          <DialogDescription>
            Classificações e fontes ficam separadas por contexto e por quadro. Nada é classificado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <ConfigSummary data={data} />

        <Tabs defaultValue="classificacao" className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="classificacao">Classificação dos tipos</TabsTrigger>
            <TabsTrigger value="quadros">Fontes dos quadros</TabsTrigger>
          </TabsList>
          <TabsContent value="classificacao" className="mt-4">
            <TipoClassificacaoPanel
              tipos={data.tiposPedido}
              grupos={data.grupos}
              vinculos={data.vinculosTipo}
              onChanged={onReload}
            />
          </TabsContent>
          <TabsContent value="quadros" className="mt-4 space-y-3">
            <div>
              <h3 className="font-display font-bold">Configuração independente por quadrinho</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Cada alteração afeta somente o quadro escolhido.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {data.quadros.map(quadro => {
                const count = data.regrasQuadros.filter(rule => rule.quadro_id === quadro.id && rule.ativo).length;
                return (
                  <article key={quadro.id} className="rounded-xl border border-border bg-surface-1 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">{quadro.titulo}</div>
                        <div className="mt-1 text-[10px] text-muted-foreground">{quadro.descricao}</div>
                        <div className="mt-2 text-[10px] font-mono text-omni">{count} regra(s) configurada(s)</div>
                      </div>
                      <QuadroConfigButton
                        quadroCodigo={quadro.codigo}
                        quadros={data.quadros}
                        regras={data.regrasQuadros}
                        statusManuais={data.statusManuais}
                        statusRobo={data.statusRobo}
                        etapasPipeline={data.etapasPipeline}
                        onSaved={onReload}
                        compact
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
