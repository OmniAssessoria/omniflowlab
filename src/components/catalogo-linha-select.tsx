import { useMemo, useState } from "react";
import { Pencil, Plus, Save, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { CatalogoItem, CatalogoTable } from "@/lib/catalogos";
import { usesScopedTipoProdutoRename } from "@/lib/tipo-produto-catalogo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NAO_INFORMADO = "Não informado";
const GERENCIAR = "__gerenciar_catalogo__";

interface CatalogoLinhaSelectProps {
  value: string;
  currentValue?: string | null;
  items: CatalogoItem[];
  table: CatalogoTable;
  operadora: string;
  canManage: boolean;
  disabled?: boolean;
  compact?: boolean;
  placeholder: string;
  label: string;
  onValueChange: (value: string) => void;
  onCatalogChanged: () => Promise<void> | void;
}

export function CatalogoLinhaSelect({
  value,
  currentValue,
  items,
  table,
  operadora,
  canManage,
  disabled,
  compact = false,
  placeholder,
  label,
  onValueChange,
  onCatalogChanged,
}: CatalogoLinhaSelectProps) {
  const [manageOpen, setManageOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPermiteBonus, setNewPermiteBonus] = useState(false);
  const [newPermiteDoador, setNewPermiteDoador] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingPermiteBonus, setEditingPermiteBonus] = useState(false);
  const [editingPermiteDoador, setEditingPermiteDoador] = useState(false);
  const [busy, setBusy] = useState(false);
  const scopedTipoProduto = usesScopedTipoProdutoRename(table);
  const scopedPlano = table === "planos_catalogo";
  const scopedPassaporte = table === "produtos_catalogo" && label.toLocaleLowerCase("pt-BR") === "passaporte";
  const vivo = operadora === "VIVO";

  function normalizeManagedName(raw: string) {
    const nome = raw.trim();
    if (!scopedPassaporte || !nome) return nome;
    const normalized = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleUpperCase("pt-BR");

    if (normalized.includes("PASSAPORTE") || normalized.includes("VIVO TRAVEL")) return nome;
    return vivo ? `VIVO TRAVEL ${nome}` : `CLARO PASSAPORTE ${nome}`;
  }

  const options = useMemo(() => {
    const names = new Set<string>();
    items.filter(item => item.ativo !== false).forEach(item => {
      const name = item.nome?.trim();
      if (name) names.add(name);
    });
    if (currentValue?.trim()) names.add(currentValue.trim());
    names.add(NAO_INFORMADO);
    return Array.from(names).sort((a, b) => {
      if (a === NAO_INFORMADO) return 1;
      if (b === NAO_INFORMADO) return -1;
      return a.localeCompare(b, "pt-BR");
    });
  }, [items, currentValue]);

  async function refresh() {
    await onCatalogChanged();
  }

  function resetNewRules() {
    setNewPermiteBonus(false);
    setNewPermiteDoador(false);
  }

  function closeEditing() {
    setEditingId(null);
    setEditingName("");
    setEditingPermiteBonus(false);
    setEditingPermiteDoador(false);
  }

  async function addItem() {
    const nome = normalizeManagedName(newName);
    if (!nome) return;
    setBusy(true);
    const payload: Record<string, unknown> = { nome, operadora, ativo: true };
    if (scopedTipoProduto) {
      payload.permite_bonus = vivo && newPermiteBonus;
      payload.permite_doador = newPermiteDoador;
    }
    const { error } = await (supabase as any).from(table).insert(payload);
    setBusy(false);
    if (error) {
      toast.error(`Não foi possível adicionar ${label.toLowerCase()}`, { description: error.message });
      return;
    }
    setNewName("");
    resetNewRules();
    await refresh();
    toast.success(`${label} adicionado`, { description: `Disponível somente para ${operadora}.` });
  }

  async function saveEdit(id: string) {
    const nome = normalizeManagedName(editingName);
    if (!nome) return;
    setBusy(true);

    const result = scopedTipoProduto
      ? await (supabase as any).rpc("update_tipo_produto_catalogo_regras", {
          p_item_id: id,
          p_novo_nome: nome,
          p_permite_bonus: vivo && editingPermiteBonus,
          p_permite_doador: editingPermiteDoador,
        })
      : await (supabase as any).from(table)
          .update({ nome })
          .eq("id", id)
          .eq("operadora", operadora);

    setBusy(false);
    if (result.error) {
      toast.error(`Não foi possível editar ${label.toLowerCase()}`, { description: result.error.message });
      return;
    }
    closeEditing();
    await refresh();
    toast.success(`${label} atualizado`, {
      description: scopedTipoProduto
        ? `Nome e regras foram atualizados somente para ${operadora}. Linhas antigas mantêm os extras já gravados.`
        : scopedPlano
          ? `Plano atualizado somente para ${operadora}. Pedidos antigos mantêm o plano já gravado.`
          : "Vendas antigas mantêm o texto original.",
    });
  }

  async function deleteItem(item: CatalogoItem) {
    const explanation = scopedTipoProduto
      ? `Excluir “${item.nome}” do catálogo de ${label.toLowerCase()} da ${operadora}? Pedidos antigos manterão o texto e os extras já gravados.`
      : scopedPlano
        ? `Excluir “${item.nome}” do catálogo de planos da ${operadora}? O plano da outra operadora não será alterado e pedidos antigos manterão o texto já gravado.`
        : `Excluir “${item.nome}” do catálogo de ${label.toLowerCase()}? Vendas antigas manterão o texto original.`;
    if (!window.confirm(explanation)) return;

    setBusy(true);
    const { error } = await (supabase as any).from(table)
      .delete()
      .eq("id", item.id)
      .eq("operadora", operadora);
    setBusy(false);
    if (error) {
      toast.error(`Não foi possível excluir ${label.toLowerCase()}`, { description: error.message });
      return;
    }
    await refresh();
    toast.success(`${label} excluído do catálogo`, {
      description: scopedTipoProduto
        ? `Linhas antigas da ${operadora} mantiveram nome, bônus e doador já gravados.`
        : scopedPlano
          ? `Plano removido somente da ${operadora}. A outra operadora e os pedidos antigos foram preservados.`
          : "O histórico das vendas não foi alterado.",
    });
  }

  return (
    <>
      <Select
        value={value || NAO_INFORMADO}
        disabled={disabled}
        onValueChange={(next) => {
          if (next === GERENCIAR) {
            setManageOpen(true);
            return;
          }
          onValueChange(next);
        }}
      >
        <SelectTrigger className={compact ? "h-7 text-[10px]" : "h-8 text-xs"}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
          {canManage && (
            <SelectItem value={GERENCIAR} className="font-semibold text-[var(--omni)]">
              <span className="inline-flex items-center gap-2"><Settings2 className="size-3.5" /> Gerenciar {label.toLowerCase()}</span>
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar {label}</DialogTitle>
            <DialogDescription>
              {scopedTipoProduto
                ? `Catálogo exclusivo da ${operadora}. As regras abaixo controlam somente novos bônus e doadores. O histórico das linhas existentes é preservado.`
                : scopedPlano
                  ? `Catálogo de planos exclusivo da ${operadora}. Criar, editar ou excluir aqui não altera os planos da outra operadora. Pedidos antigos mantêm o plano já gravado.`
                  : "Admin e BKO podem adicionar, editar ou excluir opções. Alterações no catálogo não reescrevem vendas antigas."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border border-border bg-surface-1/40 p-3">
              <Label>Novo {label.toLowerCase()}</Label>
              <div className="flex gap-2">
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder={`Nome do ${label.toLowerCase()}`}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addItem();
                    }
                  }}
                />
                <Button type="button" onClick={() => void addItem()} disabled={busy || !newName.trim()} className="gap-1.5">
                  <Plus className="size-4" /> Adicionar
                </Button>
              </div>

              {scopedTipoProduto && (
                <div className="flex flex-wrap gap-4 pt-1">
                  {operadora === "VIVO" && (
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox
                        checked={newPermiteBonus}
                        onCheckedChange={checked => setNewPermiteBonus(checked === true)}
                      />
                      <span>Permite bônus</span>
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={newPermiteDoador}
                      onCheckedChange={checked => setNewPermiteDoador(checked === true)}
                    />
                    <span>Permite doador</span>
                  </label>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {items.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  Nenhuma opção cadastrada para {operadora}.
                </div>
              )}
              {items.map(item => (
                <div key={item.id} className="rounded-md border border-border bg-surface-1 p-2">
                  {editingId === item.id ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          className="h-8 text-sm"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          autoFocus
                        />
                        <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => void saveEdit(item.id)} disabled={busy || !editingName.trim()} title="Salvar">
                          <Save className="size-4" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="size-8" onClick={closeEditing} disabled={busy} title="Cancelar">
                          <X className="size-4" />
                        </Button>
                      </div>

                      {scopedTipoProduto && (
                        <div className="flex flex-wrap gap-4 rounded-md border border-border/70 bg-background/40 px-3 py-2">
                          {operadora === "VIVO" && (
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                              <Checkbox
                                checked={editingPermiteBonus}
                                onCheckedChange={checked => setEditingPermiteBonus(checked === true)}
                              />
                              <span>Permite bônus</span>
                            </label>
                          )}
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <Checkbox
                              checked={editingPermiteDoador}
                              onCheckedChange={checked => setEditingPermiteDoador(checked === true)}
                            />
                            <span>Permite doador</span>
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm truncate">{item.nome}</div>
                          {scopedPlano && (
                            <Badge variant="outline" className="text-[9px]">{operadora}</Badge>
                          )}
                        </div>
                        {scopedTipoProduto && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {operadora === "VIVO" && item.permite_bonus && (
                              <Badge variant="outline" className="text-[9px] border-[var(--vivo)]/40 text-[var(--vivo)]">Bônus</Badge>
                            )}
                            {item.permite_doador && (
                              <Badge variant="outline" className="text-[9px] border-[var(--omni)]/40 text-[var(--omni)]">Doador</Badge>
                            )}
                            {!item.permite_doador && !(operadora === "VIVO" && item.permite_bonus) && (
                              <span className="text-[9px] text-muted-foreground">Sem extras</span>
                            )}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditingName(item.nome);
                          setEditingPermiteBonus(Boolean(item.permite_bonus));
                          setEditingPermiteDoador(Boolean(item.permite_doador));
                        }}
                        disabled={busy}
                        title="Editar"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive hover:bg-destructive/10" onClick={() => void deleteItem(item)} disabled={busy} title="Excluir">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setManageOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
