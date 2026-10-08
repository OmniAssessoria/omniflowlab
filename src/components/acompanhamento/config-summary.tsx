import { AlertTriangle, Bot, ListChecks, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AcompanhamentoBootstrap } from "@/lib/acompanhamento.types";

function pendingTypeCount(data: AcompanhamentoBootstrap) {
  const activeContexts = new Map<string, Set<string>>();
  for (const group of data.grupos) {
    const set = activeContexts.get(group.contexto) ?? new Set<string>();
    set.add(group.id);
    activeContexts.set(group.contexto, set);
  }

  let pending = 0;
  for (const tipo of data.tiposPedido) {
    for (const [contexto, groupIds] of activeContexts) {
      if (contexto === "processo_claro" && tipo.operadora !== "CLARO") continue;
      if (contexto === "processo_vivo" && tipo.operadora !== "VIVO") continue;

      const linked = data.vinculosTipo.some(
        vinculo => vinculo.tipo_pedido_id === tipo.id && groupIds.has(vinculo.grupo_id),
      );
      if (!linked) pending += 1;
    }
  }
  return pending;
}

export function ConfigSummary({ data }: { data: AcompanhamentoBootstrap }) {
  const pending = pendingTypeCount(data);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-border bg-surface-1 p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          <AlertTriangle className="size-3.5 text-warning" /> Não classificados
        </div>
        <div className="font-display text-2xl font-black text-warning">{pending}</div>
        <div className="mt-1 text-[10px] text-muted-foreground">pendências de tipo/contexto</div>
      </div>
      <div className="rounded-xl border border-border bg-surface-1 p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          <Settings2 className="size-3.5 text-omni" /> Quadros
        </div>
        <div className="font-display text-2xl font-black">{data.quadros.length}</div>
        <div className="mt-1 text-[10px] text-muted-foreground">configurações independentes</div>
      </div>
      <div className="rounded-xl border border-border bg-surface-1 p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          <ListChecks className="size-3.5 text-info" /> Status manuais
        </div>
        <div className="font-display text-2xl font-black">{data.statusManuais.length}</div>
        <div className="mt-1 text-[10px] text-muted-foreground">opções disponíveis</div>
      </div>
      <div className="rounded-xl border border-border bg-surface-1 p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          <Bot className="size-3.5 text-purple" /> Status do robô
        </div>
        <div className="flex items-end gap-2">
          <div className="font-display text-2xl font-black">{data.statusRobo.length}</div>
          {data.statusRobo.length === 0 && <Badge variant="outline" className="mb-0.5 text-[9px]">a descobrir</Badge>}
        </div>
        <div className="mt-1 text-[10px] text-muted-foreground">nomes observados no histórico</div>
      </div>
    </div>
  );
}
