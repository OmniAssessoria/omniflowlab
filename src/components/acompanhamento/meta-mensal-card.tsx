import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Save, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveMetaMensal } from "@/lib/acompanhamento.functions";
import type { MetaMensalRow } from "@/lib/acompanhamento.types";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function MetaMensalCard({
  ano,
  mes,
  metas,
  onSaved,
}: {
  ano: number;
  mes: number;
  metas: MetaMensalRow[];
  onSaved: () => void | Promise<void>;
}) {
  const save = useServerFn(saveMetaMensal);
  const storedNp = useMemo(() => metas.find(row => row.grupo === "np_fixa")?.valor ?? 0, [metas]);
  const storedOutros = useMemo(() => metas.find(row => row.grupo === "outros")?.valor ?? 0, [metas]);
  const [npFixa, setNpFixa] = useState(String(storedNp));
  const [outros, setOutros] = useState(String(storedOutros));
  const [saving, setSaving] = useState(false);

  useEffect(() => setNpFixa(String(storedNp)), [storedNp]);
  useEffect(() => setOutros(String(storedOutros)), [storedOutros]);

  const npValue = Math.max(0, Number(npFixa || 0));
  const outrosValue = Math.max(0, Number(outros || 0));
  const total = npValue + outrosValue;

  async function persist() {
    setSaving(true);
    try {
      await Promise.all([
        save({ data: { ano, mes, grupo: "np_fixa", valor: npValue } } as any),
        save({ data: { ano, mes, grupo: "outros", valor: outrosValue } } as any),
      ]);
      toast.success("Meta mensal salva");
      await onSaved();
    } catch (error: any) {
      toast.error("Não foi possível salvar a meta", { description: error?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Target className="size-4 text-omni" />
            <h2 className="font-display font-bold">Meta mensal</h2>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Valores definidos pela gestão. Nenhum resultado de vendas é calculado nesta etapa.
          </p>
        </div>
        <Button size="sm" onClick={persist} disabled={saving} className="gap-1.5">
          <Save className="size-3.5" /> {saving ? "Salvando…" : "Salvar meta"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="rounded-xl border border-border bg-surface-1 p-3">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">NP e Fixa</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={npFixa}
            onChange={event => setNpFixa(event.target.value)}
            className="mt-2 h-10 font-mono text-base font-bold"
          />
        </label>
        <label className="rounded-xl border border-border bg-surface-1 p-3">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Outros</span>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={outros}
            onChange={event => setOutros(event.target.value)}
            className="mt-2 h-10 font-mono text-base font-bold"
          />
        </label>
        <div className="rounded-xl border border-omni/30 bg-omni/[0.06] p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-omni">Meta total do mês</div>
          <div className="mt-3 font-display text-2xl font-black">{money.format(total)}</div>
          <div className="mt-1 text-[10px] text-muted-foreground">NP e Fixa + Outros</div>
        </div>
      </div>
    </section>
  );
}
