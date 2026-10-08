import { useEffect, useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supportsBiometria } from "@/lib/biometria-operadora";
import { cn } from "@/lib/utils";

export type PedidoBiometriaStatus = "" | "pendente" | "concluido" | "cancelado";

const BIOMETRIA_OPTS: Array<{
  value: PedidoBiometriaStatus;
  label: string;
  tone: string;
  dot: string;
}> = [
  {
    value: "",
    label: "Sem informação",
    tone: "border-border bg-muted/25 text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  {
    value: "pendente",
    label: "Pendente",
    tone: "border-warning/45 bg-warning/10 text-warning shadow-[0_0_16px_-7px_hsl(var(--warning)/0.85)]",
    dot: "bg-warning shadow-[0_0_7px_hsl(var(--warning))]",
  },
  {
    value: "cancelado",
    label: "Cancelada",
    tone: "border-destructive/45 bg-destructive/10 text-destructive shadow-[0_0_16px_-7px_hsl(var(--destructive)/0.85)]",
    dot: "bg-destructive shadow-[0_0_7px_hsl(var(--destructive))]",
  },
  {
    value: "concluido",
    label: "Concluída",
    tone: "border-success/45 bg-success/10 text-success shadow-[0_0_16px_-7px_hsl(var(--success)/0.85)]",
    dot: "bg-success shadow-[0_0_7px_hsl(var(--success))]",
  },
];

function biometriaOpt(status: PedidoBiometriaStatus) {
  return BIOMETRIA_OPTS.find(item => item.value === status) ?? BIOMETRIA_OPTS[0];
}

/**
 * Compatibilidade com o formulário legado da ficha de pedido.
 * A edição principal já respeita a operadora; enquanto o bloco antigo ainda existir
 * na rota grande, escondemos apenas o campo de biometria quando a operadora não
 * suporta a funcionalidade e preservamos os campos de portabilidade.
 */
function syncLegacyBiometriaField(isClaro: boolean) {
  if (typeof document === "undefined") return;

  const labels = Array.from(document.querySelectorAll("label"));
  for (const label of labels) {
    if ((label.textContent ?? "").trim().toLowerCase() !== "status biometria") continue;

    const field = label.parentElement as HTMLElement | null;
    if (!field) continue;

    field.hidden = !isClaro;
    field.dataset.biometriaOperadoraGuard = isClaro ? "claro" : "vivo";

    const grid = field.parentElement;
    const section = grid?.parentElement;
    const title = section?.firstElementChild as HTMLElement | null;
    if (title && ["Portabilidade & Biometria", "Portabilidade"].includes((title.textContent ?? "").trim())) {
      title.textContent = isClaro ? "Portabilidade & Biometria" : "Portabilidade";
    }
  }
}

export function PedidoHeaderMeta({
  operadora,
  tipoPedido,
  statusBiometria,
  canEditBiometria,
  onBiometriaChange,
}: {
  operadora?: string | null;
  tipoPedido?: string | string[] | null;
  produtos?: string | string[] | null;
  statusBiometria: PedidoBiometriaStatus;
  canEditBiometria: boolean;
  onBiometriaChange: (status: PedidoBiometriaStatus) => Promise<boolean | void> | boolean | void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = biometriaOpt(statusBiometria);
  const isClaro = supportsBiometria(operadora);
  const labelOperadora = isClaro ? "CLARO" : "VIVO";
  const tiposLabel = (Array.isArray(tipoPedido) ? tipoPedido : [tipoPedido])
    .filter((item): item is string => Boolean(item && item.trim()))
    .map(item => item.trim().toUpperCase());
  const tiposExibidos = (tiposLabel.length ? tiposLabel : ["PEDIDO"])
    .filter(tipoLabel => tipoLabel !== "MV");
  useEffect(() => {
    syncLegacyBiometriaField(isClaro);

    if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
    const observer = new MutationObserver(() => syncLegacyBiometriaField(isClaro));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isClaro]);

  return (
    <div className="space-y-1.5" data-pedido-operadora={labelOperadora}>
      <div className="flex flex-wrap items-center gap-2">
      {tiposExibidos.map(tipoLabel => (
        <div
          key={tipoLabel}
          className={cn(
            "inline-flex h-7 items-center rounded-md border px-2.5 text-[10px] font-black tracking-[0.06em] transition-shadow",
            isClaro
              ? "border-red-500/75 bg-red-500/12 text-red-300 shadow-[0_0_20px_-5px_rgba(239,68,68,0.95),inset_0_0_12px_rgba(239,68,68,0.10)]"
              : "border-violet-500/75 bg-violet-500/12 text-violet-300 shadow-[0_0_20px_-5px_rgba(139,92,246,0.95),inset_0_0_12px_rgba(139,92,246,0.10)]",
          )}
          aria-label={`Tipo de pedido ${tipoLabel} · ${labelOperadora}`}
          title={`${tipoLabel} · ${labelOperadora}`}
        >
          {tipoLabel}
        </div>
      ))}

      {isClaro && (
        <Popover open={open} onOpenChange={value => canEditBiometria && !saving && setOpen(value)}>
          <PopoverTrigger asChild>
            <button
              type="button"
              disabled={!canEditBiometria || saving}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-semibold transition-all",
                current.tone,
                canEditBiometria && "cursor-pointer hover:brightness-110",
                !canEditBiometria && "cursor-default",
              )}
              title={canEditBiometria ? "Clique para alterar a biometria" : current.label}
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Fingerprint className="size-3.5" />}
              <span className="text-muted-foreground">Biometria</span>
              <span className="font-bold">{current.label}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-1" align="start">
            {BIOMETRIA_OPTS.map(option => {
              const active = option.value === statusBiometria;
              return (
                <button
                  key={option.value || "vazio"}
                  type="button"
                  disabled={saving}
                  onClick={async () => {
                    if (active) {
                      setOpen(false);
                      return;
                    }
                    setSaving(true);
                    try {
                      const saved = await onBiometriaChange(option.value);
                      if (saved !== false) setOpen(false);
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                    active ? cn(option.tone, "font-semibold") : "hover:bg-muted",
                  )}
                >
                  <span className={cn("size-2 rounded-full", option.dot)} />
                  {option.label}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      )}
      </div>

    </div>
  );
}
