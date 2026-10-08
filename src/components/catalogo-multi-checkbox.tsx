import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { CatalogoItem } from "@/lib/catalogos";

type Grupo = "G1" | "G2";

export function CatalogoMultiCheckbox({
  items,
  value,
  onChange,
  emptyLabel = "Nenhum item selecionado",
  compact = false,
}: {
  items: CatalogoItem[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
  compact?: boolean;
}) {
  const validItems = items.filter(item => item.nome !== "Não informado" && item.grupo_compatibilidade);
  const selectedGroup = validItems.find(item => value.includes(item.nome))?.grupo_compatibilidade as Grupo | undefined;

  const groups: Array<{ id: Grupo; label: string; items: CatalogoItem[] }> = (["G1", "G2"] as Grupo[]).map(id => ({
    id,
    label: id === "G1" ? "Grupo 1" : "Grupo 2",
    items: validItems.filter(item => item.grupo_compatibilidade === id),
  })).filter(group => group.items.length > 0);

  function toggle(item: CatalogoItem) {
    const checked = value.includes(item.nome);
    const grupo = item.grupo_compatibilidade as Grupo | null | undefined;

    if (checked) {
      onChange(value.filter(nome => nome !== item.nome));
      return;
    }

    if (selectedGroup && grupo && grupo !== selectedGroup) return;
    onChange([...value, item.nome]);
  }

  return (
    <div className={cn(compact ? "space-y-1" : "space-y-2")}>
      {groups.map(group => {
        const locked = Boolean(selectedGroup && selectedGroup !== group.id);
        return (
          <div
            key={group.id}
            className={cn(
              "rounded-xl border border-border transition-opacity",
              compact ? "rounded-lg p-1.5" : "p-3",
              locked && "opacity-45",
              !locked && selectedGroup === group.id && "border-omni/40 bg-omni/5",
            )}
          >
            <div className={cn("flex items-center justify-between gap-2", compact ? "mb-1" : "mb-2")}>
              <div className={cn("font-black uppercase text-muted-foreground", compact ? "text-[9px] tracking-[0.08em]" : "text-[10px] tracking-[0.12em]")}>
                {group.label}
              </div>
              {locked && <Badge variant="outline" className="text-[9px]">Bloqueado pelo outro grupo</Badge>}
            </div>

            <div className={cn("grid sm:grid-cols-2", compact ? "gap-1" : "gap-2")}>
              {group.items.map(item => {
                const checked = value.includes(item.nome);
                return (
                  <label
                    key={item.id}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border border-border bg-card/60 transition-colors",
                      compact ? "min-h-7 gap-1.5 rounded-md px-1.5 py-1 text-[9px]" : "min-h-10 px-3 py-2 text-xs",
                      locked ? "cursor-not-allowed" : "cursor-pointer hover:border-omni/35",
                      checked && "border-omni/50 bg-omni/10 font-semibold",
                    )}
                  >
                    <Checkbox
                      className={compact ? "size-3.5" : undefined}
                      checked={checked}
                      disabled={locked}
                      onCheckedChange={() => toggle(item)}
                    />
                    <span>{item.nome}</span>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className={cn("flex flex-wrap items-center text-muted-foreground", compact ? "gap-1 text-[8px]" : "gap-2 text-[10px]")}>
        {value.length === 0 ? (
          <span>{emptyLabel}</span>
        ) : (
          <>
            <Badge variant="outline" className="text-[9px]">
              {value.length} selecionado{value.length === 1 ? "" : "s"}
            </Badge>
            <span>Você pode combinar itens apenas dentro do mesmo grupo.</span>
          </>
        )}
      </div>
    </div>
  );
}
