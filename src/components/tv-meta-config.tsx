import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Save, Tv2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getTvMetas, saveTvMetas } from "@/lib/tv.functions";
import type { TvMeta } from "@/lib/tv-data";

function currentKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function resolveMeta(metas: Record<string, TvMeta>, key: string): TvMeta {
  const keys = Object.keys(metas).filter((k) => k <= key).sort();
  return keys.length ? metas[keys[keys.length - 1]] : { meta: 0, sup: 0, elite: 0, ind: 0 };
}

function parseMoney(value: string) {
  const normalized = value.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyInput(value: number) {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

export function TvMetaConfig() {
  const fetchMetas = useServerFn(getTvMetas);
  const save = useServerFn(saveTvMetas);
  const [metas, setMetas] = useState<Record<string, TvMeta> | null>(null);
  const [values, setValues] = useState({ meta: "", sup: "", elite: "", ind: "" });
  const [saving, setSaving] = useState(false);
  const key = currentKey();

  const inherited = useMemo(
    () => metas ? resolveMeta(metas, key) : { meta: 0, sup: 0, elite: 0, ind: 0 },
    [metas, key],
  );

  useEffect(() => {
    let active = true;
    fetchMetas()
      .then((data: any) => {
        if (!active) return;
        const nextMetas = (data?.metas ?? {}) as Record<string, TvMeta>;
        setMetas(nextMetas);
        const m = resolveMeta(nextMetas, key);
        setValues({
          meta: formatMoneyInput(m.meta),
          sup: formatMoneyInput(m.sup),
          elite: formatMoneyInput(m.elite),
          ind: formatMoneyInput(m.ind),
        });
      })
      .catch((error) => toast.error("Falha ao carregar metas do Painel TV", { description: error?.message }));
    return () => { active = false; };
  }, [fetchMetas, key]);

  async function handleSave() {
    const payload = {
      mes: key,
      meta: parseMoney(values.meta),
      sup: parseMoney(values.sup),
      elite: parseMoney(values.elite),
      ind: parseMoney(values.ind),
    };

    if (!(payload.meta <= payload.sup && payload.sup <= payload.elite)) {
      toast.error("A ordem precisa ser Meta ≤ Super meta ≤ Meta elite.");
      return;
    }

    setSaving(true);
    try {
      await save({ data: payload } as any);
      toast.success("Metas do Painel TV salvas.");
      const next = await fetchMetas() as any;
      setMetas((next?.metas ?? {}) as Record<string, TvMeta>);
    } catch (error: any) {
      toast.error("Falha ao salvar metas", { description: error?.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 max-w-3xl space-y-4">
      <div className="flex items-start gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-success/10 text-success">
          <Tv2 className="size-4" />
        </div>
        <div>
          <h2 className="font-display font-semibold">Meta do Painel TV</h2>
          <p className="text-xs text-muted-foreground">
            Metas comerciais definidas pelos gestores e exibidas automaticamente no Painel TV.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface-1 p-3 text-xs text-muted-foreground">
        Mês de referência: <strong className="text-foreground">{key}</strong>.
        Quando não há valor salvo no mês, o painel herda automaticamente a última meta anterior.
        Valor atualmente resolvido: Meta {formatMoneyInput(inherited.meta)} · Super {formatMoneyInput(inherited.sup)} · Elite {formatMoneyInput(inherited.elite)} · Individual {formatMoneyInput(inherited.ind)}.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          ["meta", "Meta"],
          ["sup", "Super meta"],
          ["elite", "Meta elite"],
          ["ind", "Meta individual"],
        ] as const).map(([field, label]) => (
          <div className="space-y-1.5" key={field}>
            <Label>{label} (R$)</Label>
            <Input
              inputMode="decimal"
              value={values[field]}
              onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
              onBlur={() => setValues((v) => ({ ...v, [field]: formatMoneyInput(parseMoney(v[field])) }))}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-omni text-black hover:bg-omni/90">
          <Save className="size-3.5 mr-1.5" />
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </section>
  );
}
