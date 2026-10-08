import { useState } from "react";
import { Layers3 } from "lucide-react";

const ROWS = ["Portabilidade", "Novo e Fixa", "Total NP e Fixa", "Total Outros", "Total Geral"];

export function TotalGeralCard({
  filters = ["Tudo", "Claro", "Vivo"],
}: {
  filters?: readonly string[];
}) {
  const [filter, setFilter] = useState(filters[0] ?? "Tudo");

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers3 className="size-4 text-omni" />
            <h2 className="font-display font-bold">Total Geral</h2>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Consolidação futura por grupo comercial e operadora.</p>
        </div>
        <div className="flex rounded-xl border border-border bg-surface-1 p-1">
          {filters.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] transition-colors ${
                filter === item ? "bg-omni text-black" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1.3fr_1fr] bg-surface-2 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          <span>Tipo de pedido</span><span>Receita · {filter}</span>
        </div>
        {ROWS.map(label => (
          <div
            key={label}
            className={`grid grid-cols-[1.3fr_1fr] items-center border-t border-border px-3 py-3 ${
              label === "Total Geral" ? "bg-omni/[0.04]" : ""
            }`}
          >
            <span className={`text-xs ${label === "Total Geral" ? "font-black text-omni" : "font-semibold"}`}>{label}</span>
            <span className="text-[9px] text-muted-foreground">Aguardando integração</span>
          </div>
        ))}
      </div>
    </section>
  );
}
