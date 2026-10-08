import { RadioTower } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AcompanhamentoOperadora, ProcessoTipoProdutoRegra } from "@/lib/acompanhamento.types";

const CATEGORY: Record<AcompanhamentoOperadora, string[]> = {
  CLARO: ["Portado", "Novo", "Fixa / Banda Larga / TV", "Outros", "Total"],
  VIVO: ["Portado", "Novo", "Fixa / Banda Larga / TV / SIP", "Outros", "Total"],
};

export function ProcessoOperadoraCard({
  operadora,
  title,
  regras,
}: {
  operadora: AcompanhamentoOperadora;
  title: string;
  regras: ProcessoTipoProdutoRegra[];
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <RadioTower className="size-4 text-omni" />
            <h2 className="font-display font-bold">{title}</h2>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Estrutura pronta para quantidade e receita.</p>
        </div>
        <Badge
          variant="outline"
          className={operadora === "CLARO" ? "border-red-500/30 text-red-400" : "border-purple-500/30 text-purple-400"}
        >
          {operadora}
        </Badge>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1.4fr_1fr_110px] bg-surface-2 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          <span>Tipo de pedido</span><span>Produto</span><span className="text-right">Grupo</span>
        </div>
        {regras.map((regra, index) => (
          <div
            key={`${regra.tipoPedido}:${regra.grupo}:${index}`}
            className={`grid grid-cols-[1.4fr_1fr_110px] items-center border-t border-border px-3 py-3 ${
              index === regras.length - 1 ? "bg-omni/[0.035]" : ""
            }`}
          >
            <span className="text-xs font-semibold">{regra.label}</span>
            <span className="text-[9px] text-muted-foreground">{regra.produtos.length ? regra.produtos.join(" / ") : "Todos os produtos"}</span>
            <span className="text-right text-[9px] text-muted-foreground">{regra.grupo}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
