import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveMetaSemanal } from "@/lib/acompanhamento.functions";
import { resolveWeeklyOrigin, resolveWeeklySplit, suggestWeeklySplit } from "@/lib/acompanhamento-metas";
import type {
  MetaMensalRow,
  MetaSemanalGrupo,
  MetaSemanalRow,
  OperationalWeek,
} from "@/lib/acompanhamento.types";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const GROUPS: Array<{ id: MetaSemanalGrupo; label: string; monthlySource: "np_fixa" | "outros" }> = [
  { id: "novo_importado", label: "Novo / Importado", monthlySource: "np_fixa" },
  { id: "renovacao", label: "Renovação", monthlySource: "outros" },
];

export function MetaSemanalCard({
  ano,
  mes,
  weeks,
  monthly,
  weekly,
  onSaved,
}: {
  ano: number;
  mes: number;
  weeks: OperationalWeek[];
  monthly: MetaMensalRow[];
  weekly: MetaSemanalRow[];
  onSaved: () => void | Promise<void>;
}) {
  const save = useServerFn(saveMetaSemanal);
  const initial = useMemo(() => {
    const result: Record<MetaSemanalGrupo, number[]> = {
      novo_importado: [],
      renovacao: [],
    };
    for (const group of GROUPS) {
      const monthlyValue = monthly.find(row => row.grupo === group.monthlySource)?.valor ?? 0;
      result[group.id] = resolveWeeklySplit(
        suggestWeeklySplit(Number(monthlyValue), weeks.length),
        weekly,
        group.id,
      );
    }
    return result;
  }, [monthly, weekly, weeks.length]);

  const [values, setValues] = useState(initial);
  const [manualKeys, setManualKeys] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValues(initial);
    setManualKeys(new Set());
  }, [initial]);

  function setValue(group: MetaSemanalGrupo, weekIndex: number, raw: string) {
    const numeric = Math.max(0, Number(raw || 0));
    setValues(current => ({
      ...current,
      [group]: current[group].map((value, index) => index === weekIndex ? numeric : value),
    }));
    setManualKeys(current => new Set(current).add(`${group}:${weekIndex + 1}`));
  }

  async function persist() {
    setSaving(true);
    try {
      const calls = GROUPS.flatMap(group =>
        weeks.map((week, index) => save({
          data: {
            ano,
            mes,
            semana: week.index,
            grupo: group.id,
            valor: values[group.id][index] ?? 0,
            origem: resolveWeeklyOrigin(
              weekly,
              group.id,
              week.index,
              manualKeys.has(`${group.id}:${week.index}`),
            ),
          },
        } as any)),
      );
      await Promise.all(calls);
      toast.success("Distribuição semanal salva");
      await onSaved();
    } catch (error: any) {
      toast.error("Não foi possível salvar as metas semanais", { description: error?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-omni" />
            <h2 className="font-display font-bold">Meta da semana</h2>
            <Badge variant="outline" className="border-info/30 text-info text-[9px]">automática + editável</Badge>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            A sugestão nasce da meta mensal e pode ser redistribuída livremente pela gestão.
          </p>
        </div>
        <Button size="sm" onClick={persist} disabled={saving} className="gap-1.5">
          <Save className="size-3.5" /> {saving ? "Salvando…" : "Salvar distribuição"}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-left">
          <thead className="bg-surface-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Tipo de meta</th>
              {weeks.map(week => <th key={week.index} className="px-3 py-2">Semana {week.index}</th>)}
              <th className="px-3 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map(group => (
              <tr key={group.id} className="border-t border-border">
                <td className="px-3 py-3 text-sm font-semibold">{group.label}</td>
                {weeks.map((week, index) => (
                  <td key={week.index} className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={values[group.id][index] ?? 0}
                      onChange={event => setValue(group.id, index, event.target.value)}
                      className="h-8 min-w-[120px] font-mono text-xs"
                    />
                    <div className="mt-1 text-[8px] text-muted-foreground">
                      {week.start.slice(8, 10)}/{week.start.slice(5, 7)}–{week.end.slice(8, 10)}/{week.end.slice(5, 7)}
                    </div>
                  </td>
                ))}
                <td className="px-3 py-3 font-mono text-sm font-bold">
                  {money.format(values[group.id].reduce((sum, value) => sum + Number(value || 0), 0))}
                </td>
              </tr>
            ))}
            <tr className="border-t border-omni/25 bg-omni/[0.04]">
              <td className="px-3 py-3 text-sm font-black text-omni">Total</td>
              {weeks.map((week, index) => (
                <td key={week.index} className="px-3 py-3 font-mono text-xs font-bold">
                  {money.format(
                    GROUPS.reduce((sum, group) => sum + Number(values[group.id][index] ?? 0), 0),
                  )}
                </td>
              ))}
              <td className="px-3 py-3 font-mono text-sm font-black">
                {money.format(GROUPS.reduce(
                  (sum, group) => sum + values[group.id].reduce((s, value) => s + Number(value || 0), 0),
                  0,
                ))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[9px] text-muted-foreground">
        A correspondência inicial usa NP/Fixa → Novo/Importado e Outros → Renovação apenas para sugerir a divisão. Ela continua editável e será validada com a gestora antes dos cálculos de vendas.
      </p>
    </section>
  );
}
