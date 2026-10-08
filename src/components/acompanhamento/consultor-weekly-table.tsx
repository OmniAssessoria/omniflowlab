import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { saveMetaConsultor } from "@/lib/acompanhamento.functions";
import type {
  AcompanhamentoBootstrap,
  MetaConsultorQuadro,
} from "@/lib/acompanhamento.types";
import { QuadroConfigButton } from "./quadro-rule-editor";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ConsultorWeeklyTable({
  title,
  subtitle,
  quadro,
  quadroCodigo,
  data,
  onSaved,
}: {
  title: string;
  subtitle: string;
  quadro: MetaConsultorQuadro;
  quadroCodigo: string;
  data: AcompanhamentoBootstrap;
  onSaved: () => void | Promise<void>;
}) {
  const save = useServerFn(saveMetaConsultor);
  const stored = useMemo(
    () => data.metasConsultores.filter(row => row.quadro === quadro),
    [data.metasConsultores, quadro],
  );

  const rows = useMemo(() => {
    const activeIds = new Set(data.consultoresAtivos.map(item => item.id));
    const historicalNeeded = data.consultoresHistoricos.filter(item =>
      stored.some(meta => meta.consultor_id === item.id),
    );
    return [
      ...data.consultoresAtivos,
      ...historicalNeeded.filter(item => !activeIds.has(item.id)),
    ];
  }, [data.consultoresAtivos, data.consultoresHistoricos, stored]);

  const initialValues = useMemo(() => Object.fromEntries(
    rows.map(row => [
      row.id,
      String(stored.find(meta => meta.consultor_id === row.id)?.meta_semanal ?? 0),
    ]),
  ), [rows, stored]);

  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => setValues(initialValues), [initialValues]);

  async function persist(consultorId: string) {
    const consultant = rows.find(row => row.id === consultorId);
    if (!consultant?.ativo) return;

    setBusy(consultorId);
    try {
      await save({
        data: {
          ano: data.ano,
          mes: data.mes,
          quadro,
          consultorId,
          metaSemanal: Math.max(0, Number(values[consultorId] || 0)),
        },
      } as any);
      toast.success("Meta do consultor salva", { description: consultant.nome_completo });
      await onSaved();
    } catch (error: any) {
      toast.error("Não foi possível salvar a meta", { description: error?.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <UsersRound className="size-4 text-omni" />
            <h2 className="font-display font-bold">{title}</h2>
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

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[1180px] text-left">
          <thead className="bg-surface-2 text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Consultor</th>
              <th className="px-3 py-2">Meta Semana</th>
              {data.semanas.map(week => <th key={week.index} className="px-3 py-2">Semana {week.index}</th>)}
              <th className="px-3 py-2">Resultado Ideal</th>
              <th className="px-3 py-2">Resultado Atual</th>
              <th className="px-3 py-2">Diferença</th>
              <th className="px-3 py-2">Cancelados</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(consultor => {
              const weeklyTarget = Math.max(0, Number(values[consultor.id] || 0));
              const ideal = weeklyTarget * data.semanas.length;
              return (
                <tr key={consultor.id} className="border-t border-border">
                  <td className="px-3 py-3">
                    <div className="text-xs font-semibold">{consultor.nome_completo}</div>
                    {!consultor.ativo && (
                      <Badge variant="outline" className="mt-1 text-[8px] text-muted-foreground">histórico</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      disabled={!consultor.ativo || busy === consultor.id}
                      value={values[consultor.id] ?? "0"}
                      onChange={event => setValues(current => ({ ...current, [consultor.id]: event.target.value }))}
                      onBlur={() => persist(consultor.id)}
                      onKeyDown={event => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      className="h-8 min-w-[120px] font-mono text-xs"
                    />
                  </td>
                  {data.semanas.map(week => (
                    <td key={week.index} className="px-3 py-3 text-center">
                      <span className="rounded-md border border-border bg-surface-1 px-2 py-1 text-[9px] text-muted-foreground">
                        Aguardando integração
                      </span>
                    </td>
                  ))}
                  <td className="px-3 py-3 font-mono text-xs font-bold">{money.format(ideal)}</td>
                  <td className="px-3 py-3 text-[9px] text-muted-foreground">Aguardando integração</td>
                  <td className="px-3 py-3 text-[9px] text-muted-foreground">Aguardando integração</td>
                  <td className="px-3 py-3 text-[9px] text-muted-foreground">Aguardando integração</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={data.semanas.length + 6} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  Nenhum consultor ativo cadastrado.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t border-omni/25 bg-omni/[0.035]">
              <tr>
                <td className="px-3 py-3 text-xs font-black text-omni">Total da equipe</td>
                <td className="px-3 py-3 font-mono text-xs font-bold">
                  {money.format(rows.reduce((sum, row) => sum + Math.max(0, Number(values[row.id] || 0)), 0))}
                </td>
                {data.semanas.map(week => (
                  <td key={week.index} className="px-3 py-3 text-center text-[9px] text-muted-foreground">—</td>
                ))}
                <td className="px-3 py-3 font-mono text-xs font-bold">
                  {money.format(rows.reduce(
                    (sum, row) => sum + Math.max(0, Number(values[row.id] || 0)) * data.semanas.length,
                    0,
                  ))}
                </td>
                <td className="px-3 py-3 text-[9px] text-muted-foreground">—</td>
                <td className="px-3 py-3 text-[9px] text-muted-foreground">—</td>
                <td className="px-3 py-3 text-[9px] text-muted-foreground">—</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
