import { useMemo, useState } from "react";
import { Pencil, Plus, Save, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  CLOSER_OPTION_CATEGORIES,
  CLOSER_OPTION_CATEGORY_LABELS,
  normalizeCloserOptionValue,
  type CloserOption,
  type CloserOptionCategory,
  type CloserOptionsController,
} from "@/lib/closer-options";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GERENCIAR = "__gerenciar_closer_options__";

type CatalogManagerProps = {
  category: CloserOptionCategory;
  items: CloserOption[];
  reload: () => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function CatalogManager({
  category,
  items,
  reload,
  open,
  onOpenChange,
}: CatalogManagerProps) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);
  const title = CLOSER_OPTION_CATEGORY_LABELS[category];

  async function addItem() {
    const nome = newName.trim();
    if (!nome) return;

    const valor = normalizeCloserOptionValue(nome);
    const ordem = items.reduce((max, item) => Math.max(max, item.ordem ?? 0), 0) + 10;
    setBusy(true);
    const { error } = await (supabase as any)
      .from("closer_opcoes_catalogo")
      .insert({
        categoria: category,
        valor,
        nome,
        ativo: true,
        ordem,
      });
    setBusy(false);

    if (error) {
      toast.error("Não foi possível adicionar a opção", { description: error.message });
      return;
    }

    setNewName("");
    await reload();
    toast.success("Opção adicionada.");
  }

  async function saveEdit(item: CloserOption) {
    const nome = editingName.trim();
    if (!nome) return;

    setBusy(true);
    const { error } = await (supabase as any)
      .from("closer_opcoes_catalogo")
      .update({
        nome,
        valor: normalizeCloserOptionValue(nome),
      })
      .eq("id", item.id)
      .eq("categoria", category);
    setBusy(false);

    if (error) {
      toast.error("Não foi possível editar a opção", { description: error.message });
      return;
    }

    setEditingId(null);
    setEditingName("");
    await reload();
    toast.success("Opção atualizada.", {
      description: "Pedidos antigos mantêm o texto registrado na época.",
    });
  }

  async function deleteItem(item: CloserOption) {
    if (!window.confirm(
      `Excluir “${item.nome}” de ${title}? Pedidos antigos manterão o valor já registrado.`,
    )) return;

    setBusy(true);
    const { error } = await (supabase as any)
      .from("closer_opcoes_catalogo")
      .delete()
      .eq("id", item.id)
      .eq("categoria", category);
    setBusy(false);

    if (error) {
      toast.error("Não foi possível excluir a opção", { description: error.message });
      return;
    }

    await reload();
    toast.success("Opção removida do catálogo.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[86vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar opções</DialogTitle>
          <DialogDescription>
            {title}. Admin e BKO podem adicionar, editar ou remover opções. Pedidos antigos não são reescritos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-1/60 p-3 space-y-2">
            <Label>Nova opção</Label>
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Digite o nome da opção"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addItem();
                  }
                }}
              />
              <Button
                type="button"
                onClick={() => void addItem()}
                disabled={busy || !newName.trim()}
                className="gap-1.5"
              >
                <Plus className="size-4" /> Adicionar
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                Nenhuma opção cadastrada.
              </div>
            ) : items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-card p-2.5">
                {editingId === item.id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editingName}
                      onChange={(event) => setEditingName(event.target.value)}
                      className="h-9"
                      autoFocus
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      onClick={() => void saveEdit(item)}
                      disabled={busy || !editingName.trim()}
                      title="Salvar"
                    >
                      <Save className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      onClick={() => {
                        setEditingId(null);
                        setEditingName("");
                      }}
                      disabled={busy}
                      title="Cancelar"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item.nome}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Ordem {item.ordem}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      onClick={() => {
                        setEditingId(item.id);
                        setEditingName(item.nome);
                      }}
                      disabled={busy}
                      title="Editar"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9 text-destructive hover:bg-destructive/10"
                      onClick={() => void deleteItem(item)}
                      disabled={busy}
                      title="Excluir"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CloserOptionSelect({
  category,
  value,
  onValueChange,
  canManage,
  disabled = false,
  label,
  controller,
  className,
  allowedValues,
}: {
  category: CloserOptionCategory;
  value: string;
  onValueChange: (value: string) => void;
  canManage: boolean;
  disabled?: boolean;
  label: string;
  controller: CloserOptionsController;
  className?: string;
  allowedValues?: string[];
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const options = controller.optionsFor(category);
  const allItems = controller.allFor(category);

  const selectable = useMemo(() => {
    const allowed = allowedValues
      ? new Set(allowedValues.map((item) => normalizeCloserOptionValue(item)))
      : null;
    const result = options.filter((item) =>
      !allowed || allowed.has(normalizeCloserOptionValue(item.valor))
    );
    if (value && !result.some((item) => item.valor === value)) {
      result.push({
        id: `legacy-${category}-${value}`,
        categoria: category,
        valor: value,
        nome: controller.labelFor(category, value),
        ativo: true,
        ordem: 99999,
      });
    }
    return result;
  }, [allowedValues, category, controller, options, value]);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Select
          value={value}
          disabled={disabled}
          onValueChange={(next) => {
            if (next === GERENCIAR) {
              setManageOpen(true);
              return;
            }
            onValueChange(next);
          }}
        >
          <SelectTrigger className={className}>
            <SelectValue placeholder={label} />
          </SelectTrigger>
          <SelectContent>
            {selectable.map((option) => (
              <SelectItem key={option.id} value={option.valor}>
                {option.nome}
              </SelectItem>
            ))}
            {canManage && !disabled && (
              <SelectItem value={GERENCIAR} className="font-semibold text-[var(--omni)]">
                <span className="inline-flex items-center gap-2">
                  <Settings2 className="size-3.5" /> Gerenciar opções
                </span>
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        {canManage && disabled && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setManageOpen(true)}
            title={`Gerenciar ${label.toLowerCase()}`}
          >
            <Settings2 className="size-4" />
          </Button>
        )}
      </div>

      <CatalogManager
        category={category}
        items={allItems}
        reload={controller.reload}
        open={manageOpen}
        onOpenChange={setManageOpen}
      />
    </>
  );
}

export function CloserOptionsHubButton({
  controller,
}: {
  controller: CloserOptionsController;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<CloserOptionCategory>("onvox_order_type");
  const [manageOpen, setManageOpen] = useState(false);
  const items = controller.allFor(category);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"
        onClick={() => setOpen(true)}
      >
        <Settings2 className="size-4 mr-2" /> Gerenciar opções
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Catálogos da Operação Closer</DialogTitle>
            <DialogDescription>
              Escolha o conjunto que deseja administrar. As alterações valem imediatamente para novos lançamentos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label>Conjunto de opções</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as CloserOptionCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLOSER_OPTION_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CLOSER_OPTION_CATEGORY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="rounded-xl border border-border bg-surface-1/50 p-4">
              <div className="text-sm font-semibold">{CLOSER_OPTION_CATEGORY_LABELS[category]}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {items.filter((item) => item.ativo !== false).length} opções ativas
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            <Button
              type="button"
              onClick={() => {
                setOpen(false);
                setManageOpen(true);
              }}
            >
              <Settings2 className="size-4 mr-2" /> Abrir gerenciamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CatalogManager
        category={category}
        items={items}
        reload={controller.reload}
        open={manageOpen}
        onOpenChange={setManageOpen}
      />
    </>
  );
}
