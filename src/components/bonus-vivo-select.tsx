import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSelectableBonusValues } from "@/lib/bonus-catalog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const GERENCIAR = "__gerenciar_bonus__";

type BonusItem = {
  id: string;
  gb: number;
  ativo: boolean;
};

export function BonusVivoSelect({
  linhaId,
  possuiBonus,
  bonusGb,
  canEdit,
  canManage,
  allowCreate,
  onChanged,
  compact = false,
}: {
  linhaId: string;
  possuiBonus?: boolean | null;
  bonusGb?: number | null;
  canEdit: boolean;
  canManage: boolean;
  allowCreate: boolean;
  onChanged: () => Promise<void> | void;
  compact?: boolean;
}) {
  const [items, setItems] = useState<BonusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [newGb, setNewGb] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingGb, setEditingGb] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("bonus_vivo_catalogo")
      .select("id, gb, ativo")
      .order("gb", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Não foi possível carregar as opções de bônus", { description: error.message });
      return;
    }
    setItems((data ?? []) as BonusItem[]);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const options = useMemo(
    () => getSelectableBonusValues(items, bonusGb),
    [items, bonusGb],
  );
  const activeOptions = useMemo(
    () => getSelectableBonusValues(items),
    [items],
  );

  async function patchBonus(nextPossui: boolean | null, nextGb: number | null) {
    if (!canEdit || busy) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from("venda_linhas")
      .update({ possui_bonus: nextPossui, bonus_gb: nextPossui ? nextGb : null })
      .eq("id", linhaId);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível atualizar o bônus", { description: error.message });
      return;
    }
    await onChanged();
    toast.success("Bônus da linha atualizado");
  }

  async function setPossui(value: string) {
    if (value === "sim" && !allowCreate && possuiBonus !== true) {
      toast.error("Este Tipo de Pedido não permite adicionar bônus.");
      return;
    }
    if (value === "nao") {
      await patchBonus(false, null);
      return;
    }
    if (value === "nao_informado") {
      await patchBonus(null, null);
      return;
    }

    const currentIsActive = bonusGb != null && activeOptions.includes(bonusGb);
    const nextGb = currentIsActive ? bonusGb : activeOptions[0] ?? null;
    if (nextGb == null) {
      toast.error("Cadastre pelo menos uma opção de bônus antes de marcar Sim.");
      return;
    }
    await patchBonus(true, nextGb);
  }

  function parseGb(raw: string) {
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  async function addItem() {
    if (!canManage || busy) return;
    const gb = parseGb(newGb);
    if (!gb) {
      toast.error("Informe uma quantidade inteira de GB maior que zero.");
      return;
    }
    setBusy(true);
    const { error } = await (supabase as any)
      .from("bonus_vivo_catalogo")
      .insert({ gb, ativo: true });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível adicionar o bônus", { description: error.message });
      return;
    }
    setNewGb("");
    await load();
    toast.success(`${gb} GB adicionado ao catálogo`);
  }

  async function saveEdit(id: string) {
    if (!canManage || busy) return;
    const gb = parseGb(editingGb);
    if (!gb) {
      toast.error("Informe uma quantidade inteira de GB maior que zero.");
      return;
    }
    setBusy(true);
    const { error } = await (supabase as any)
      .from("bonus_vivo_catalogo")
      .update({ gb, updated_by: (await supabase.auth.getUser()).data.user?.id ?? null, updated_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível editar o bônus", { description: error.message });
      return;
    }
    setEditingId(null);
    setEditingGb("");
    await load();
    toast.success("Opção de bônus atualizada", { description: "Linhas antigas mantêm o valor que já estava gravado." });
  }

  async function deleteItem(item: BonusItem) {
    if (!canManage || busy) return;
    if (!window.confirm(`Excluir ${item.gb} GB do catálogo de bônus? Linhas antigas continuarão com o valor já gravado.`)) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from("bonus_vivo_catalogo")
      .delete()
      .eq("id", item.id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível excluir o bônus", { description: error.message });
      return;
    }
    await load();
    toast.success(`${item.gb} GB excluído do catálogo`, { description: "As linhas antigas não foram alteradas." });
  }

  return (
    <>
      <div className={compact ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "grid grid-cols-1 sm:grid-cols-2 gap-3"}>
        <div className={compact ? "space-y-1" : "space-y-1.5"}>
          <Label className={compact ? "text-[9px]" : undefined}>Possui bônus?</Label>
          <Select
            disabled={!canEdit || busy || loading}
            value={possuiBonus === true ? "sim" : possuiBonus === false ? "nao" : "nao_informado"}
            onValueChange={value => void setPossui(value)}
          >
            <SelectTrigger className={compact ? "h-7 text-[10px]" : undefined}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nao_informado">Não informado</SelectItem>
              <SelectItem value="sim" disabled={!allowCreate && possuiBonus !== true}>Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={compact ? "space-y-1" : "space-y-1.5"}>
          <Label className={compact ? "text-[9px]" : undefined}>Tamanho do bônus</Label>
          <Select
            disabled={!canEdit || busy || loading || possuiBonus !== true}
            value={bonusGb ? String(bonusGb) : undefined}
            onValueChange={value => {
              if (value === GERENCIAR) {
                setManageOpen(true);
                return;
              }
              void patchBonus(true, Number(value));
            }}
          >
            <SelectTrigger className={compact ? "h-7 text-[10px]" : undefined}><SelectValue placeholder={loading ? "Carregando…" : "Selecione"} /></SelectTrigger>
            <SelectContent>
              {options.map(gb => <SelectItem key={gb} value={String(gb)}>{gb} GB</SelectItem>)}
              {canManage && (
                <SelectItem value={GERENCIAR} className="font-semibold text-[var(--omni)]">
                  <span className="inline-flex items-center gap-2"><Settings2 className="size-3.5" /> Gerenciar bônus</span>
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {canManage && (
        <Button type="button" variant="ghost" size="sm" className={compact ? "h-6 px-1.5 gap-1 text-[9px]" : "h-7 px-2 gap-1.5 text-[10px]"} onClick={() => setManageOpen(true)}>
          <Settings2 className="size-3.5" /> Gerenciar bônus
        </Button>
      )}

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar bônus VIVO</DialogTitle>
            <DialogDescription>
              BKO e Administrador podem adicionar, editar ou excluir opções. Linhas antigas mantêm o valor gravado mesmo se a opção mudar ou for excluída.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className={compact ? "space-y-1" : "space-y-1.5"}>
              <Label>Nova opção de bônus</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={newGb}
                  onChange={event => setNewGb(event.target.value)}
                  placeholder="Ex.: 30"
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void addItem();
                    }
                  }}
                />
                <Button type="button" onClick={() => void addItem()} disabled={busy || !newGb.trim()} className="gap-1.5">
                  <Plus className="size-4" /> Adicionar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Informe somente o número. O sistema exibirá “GB” automaticamente.</p>
            </div>

            <div className="space-y-2">
              {items.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Nenhuma opção cadastrada.</div>
              )}
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-2 rounded-md border border-border bg-surface-1 p-2">
                  {editingId === item.id ? (
                    <>
                      <Input type="number" min={1} step={1} className="h-8 text-sm" value={editingGb} onChange={event => setEditingGb(event.target.value)} autoFocus />
                      <span className="text-xs text-muted-foreground">GB</span>
                      <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => void saveEdit(item.id)} disabled={busy || !editingGb.trim()} title="Salvar"><Save className="size-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => { setEditingId(null); setEditingGb(""); }} disabled={busy} title="Cancelar"><X className="size-4" /></Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0 text-sm">{item.gb} GB</div>
                      <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => { setEditingId(item.id); setEditingGb(String(item.gb)); }} disabled={busy} title="Editar"><Pencil className="size-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="size-8 text-destructive hover:bg-destructive/10" onClick={() => void deleteItem(item)} disabled={busy} title="Excluir"><Trash2 className="size-4" /></Button>
                    </>
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
