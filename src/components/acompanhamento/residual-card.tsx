import { Gauge } from "lucide-react";
import type { MetaMensalRow } from "@/lib/acompanhamento.types";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ResidualCard({ metas }: { metas: MetaMensalRow[] }) {
  const npFixa = Number(metas.find(row => row.grupo === "np_fixa")?.valor ?? 0);
  const outros = Number(metas.find(row => row.grupo === "outros")?.valor ?? 0);

  const rows = [
    { label: "Residual NP e Fixa", meta: npFixa },
    { label: "Residual Outros", meta: outros },
    { label: "Residual Geral", meta: npFixa + outros },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Gauge className="size-4 text-omni" />
          <h2 className="font-display font-bold">Residual do Mês</h2>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          A meta já pode ser configurada. O residual só será calculado após validar a fonte dos resultados.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] bg-surface-2 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          <span>Tipo de venda</span><span>Meta</span><span>Residual</span><span>Por semana</span>
        </div>
        {rows.map(row => (
          <div key={row.label} className="grid grid-cols-[1.2fr_1fr_1fr_1fr] items-center border-t border-border px-3 py-3">
            <span className={`text-xs ${row.label === "Residual Geral" ? "font-black text-omni" : "font-semibold"}`}>{row.label}</span>
            <span className="font-mono text-xs">{money.format(row.meta)}</span>
            <span className="text-[9px] text-muted-foreground">Aguardando integração</span>
            <span className="text-[9px] text-muted-foreground">Aguardando integração</span>
          </div>
        ))}
      </div>
    </section>
  );
}
