import { AlertTriangle, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  SUPPORT_PRIORITY_OPTIONS,
  getSupportPriorityMeta,
  type SupportPriority,
} from "@/lib/support-priority";

export function SupportPriorityBadge({
  priority,
  className,
}: {
  priority: SupportPriority;
  className?: string;
}) {
  const meta = getSupportPriorityMeta(priority);
  const urgent = priority === "urgente";

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex h-5 items-center gap-1 px-1.5 text-[9px] uppercase tracking-wide",
        meta.tone === "warning"
          ? "border-warning/50 bg-warning/10 text-warning"
          : "border-destructive/60 bg-destructive/10 text-destructive font-bold animate-pulse motion-reduce:animate-none",
        className,
      )}
      aria-label={`Prioridade: ${meta.label}`}
    >
      {urgent ? <AlertTriangle className="size-3" /> : <Clock3 className="size-3" />}
      {meta.label}
    </Badge>
  );
}

export function SupportPriorityPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: SupportPriority | "";
  onChange: (value: SupportPriority) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Prioridade do atendimento">
      {SUPPORT_PRIORITY_OPTIONS.map(option => {
        const selected = value === option.value;
        const urgent = option.value === "urgente";
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              urgent
                ? selected
                  ? "border-destructive/70 bg-destructive/10"
                  : "border-destructive/25 bg-card hover:border-destructive/50"
                : selected
                  ? "border-warning/70 bg-warning/10"
                  : "border-warning/25 bg-card hover:border-warning/50",
            )}
          >
            <div className={cn("flex items-center gap-2 text-sm font-semibold", urgent ? "text-destructive" : "text-warning")}>
              {urgent ? <AlertTriangle className="size-4" /> : <Clock3 className="size-4" />}
              {option.label}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {urgent
                ? "Atendimento que exige atenção imediata do BKO."
                : "Fila normal para tratamento e acompanhamento."}
            </p>
          </button>
        );
      })}
    </div>
  );
}

export function SupportPrioritySelect({
  value,
  onChange,
  disabled = false,
}: {
  value: SupportPriority;
  onChange: (value: SupportPriority) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={value => onChange(value as SupportPriority)} disabled={disabled}>
      <SelectTrigger className="h-8 min-w-[118px] bg-surface-1 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a_tratar">A tratar</SelectItem>
        <SelectItem value="urgente">Urgente</SelectItem>
      </SelectContent>
    </Select>
  );
}
