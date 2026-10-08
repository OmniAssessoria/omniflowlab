import { useMemo, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AcompanhamentoBootstrap, MetaSemanalGrupo } from "@/lib/acompanhamento.types";
import { QuadroConfigButton } from "./quadro-rule-editor";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function WeeklyResultCard({
  title,
  subtitle,
  quadroCodigo,
  data,
  onSaved,
}: {
  title: string;
  subtitle: string;
  quadroCodigo: string;
  data: AcompanhamentoBootstrap;
  onSaved: () => void | Promise<void>;
}) {
  const [week, setWeek] = useState(1);

  const targetFor = (group: MetaSemanalGrupo) =>
    Number(data.metasSemanais.find(row => row.semana === week && row.grupo === group)?.valor ?? 0);

  const novoImportado = targetFor("novo_importado");
  const renovacao = targetFor("renovacao");
  const totalTarget = novoImportado + renovacao;

  const configuredCount = useMemo(() => {
    const quadro = data.quadros.find(item => item.codigo === quadroCodigo);
    return quadro ? data.regrasQuadros.filter(rule => rule.quadro_id === quadro.id && rule.ativo).length : 0;
  }, [data.quadros, data.regrasQuadros, quadroCodigo]);

  const rows = [
    { label: "Cancelados", target: null },
    { label: "Novo / Importado", target: novoImportado },
    { label: "Renovação", target: renovacao },
    { label: "Total", target: totalTarget },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-omni" />
            <h2 className="font-display font-bold">{title}</h2>
            <Badge variant="outline" className="text-[9px]">{configuredCount} fonte(s)</Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
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

      <div className="mb-3 flex flex-wrap gap-1.5">
        {data.semanas.map(item => (
          <button
            key={item.index}
            type="button"
            onClick={() => setWeek(item.index)}
            className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${
              week === item.index ? "border-omni/50 bg-omni/10 text-omni" : "border-border text-muted-foreground"
            }`}
          >
            Semana {item.index}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-surface-2 px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          <span>Tipo</span><span>Meta semanal</span><span>Resultado</span>
        </div>
        {rows.map(row => (
          <div key={row.label} className="grid grid-cols-[1.2fr_1fr_1fr] items-center border-t border-border px-3 py-3">
            <span className={`text-xs ${row.label === "Total" ? "font-black text-omni" : "font-semibold"}`}>{row.label}</span>
            <span className="font-mono text-xs">{row.target === null ? "—" : money.format(row.target)}</span>
            <span className="text-[9px] text-muted-foreground">Aguardando integração</span>
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-muted-foreground">
        O destaque azul/vermelho será ativado quando o resultado real deste quadro for conectado à fonte validada.
      </div>
    </section>
  );
}
