import { useMemo } from "react";
import { Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AcompanhamentoBootstrap } from "@/lib/acompanhamento.types";
import { QuadroConfigButton } from "./quadro-rule-editor";

const COLUMNS = ["Portabilidade", "Novo/Fixa", "Outros"];

export function StatusOperationalCard({
  quadroCodigo,
  title,
  data,
  onSaved,
}: {
  quadroCodigo: string;
  title: string;
  data: AcompanhamentoBootstrap;
  onSaved: () => void | Promise<void>;
}) {
  const quadro = data.quadros.find(item => item.codigo === quadroCodigo);
  const rules = useMemo(
    () => quadro ? data.regrasQuadros.filter(rule => rule.quadro_id === quadro.id && rule.ativo) : [],
    [data.regrasQuadros, quadro],
  );

  const summary = rules.slice(0, 4).map(rule => rule.valor_original);
  const extra = Math.max(0, rules.length - summary.length);

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-omni" />
            <h3 className="font-display font-bold">{title}</h3>
            <Badge variant="outline" className="text-[8px]">{rules.length} regra(s)</Badge>
          </div>
          <div className="mt-1 flex max-w-2xl flex-wrap gap-1">
            {summary.map((value, index) => (
              <span key={`${value}:${index}`} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[8px] text-muted-foreground">
                {value}
              </span>
            ))}
            {extra > 0 && <span className="text-[8px] text-muted-foreground">+{extra}</span>}
            {rules.length === 0 && <span className="text-[9px] text-warning">Aguardando configuração</span>}
          </div>
        </div>
        <QuadroConfigButton
          quadroCodigo={quadroCodigo}
          quadros={data.quadros}
          regras={data.regrasQuadros}
          statusManuais={data.statusManuais}
          statusRobo={data.statusRobo}
          etapasPipeline={data.etapasPipeline}
          onSaved={onSaved}
          compact
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[90px_repeat(3,1fr)] bg-surface-2 px-3 py-2 text-[8px] font-black uppercase tracking-[0.1em] text-muted-foreground">
          <span>Operadora</span>
          {COLUMNS.map(column => <span key={column}>{column}</span>)}
        </div>
        {["Vivo", "Claro", "Total"].map(operator => (
          <div key={operator} className={`grid grid-cols-[90px_repeat(3,1fr)] items-center border-t border-border px-3 py-3 ${
            operator === "Total" ? "bg-omni/[0.035]" : ""
          }`}>
            <span className={`text-[10px] font-black ${
              operator === "Vivo" ? "text-purple-400" : operator === "Claro" ? "text-red-400" : "text-omni"
            }`}>{operator}</span>
            {COLUMNS.map(column => (
              <span key={column} className="text-[9px] text-muted-foreground">—</span>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 text-[9px] text-muted-foreground">Resultados aguardando configuração e validação da gestão.</div>
    </section>
  );
}
