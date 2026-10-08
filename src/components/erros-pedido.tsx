import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";

interface VendaObservacao {
  id: string;
  venda_id: string;
  texto: string;
  created_by: string;
  autor_nome: string;
  autor_perfil: string;
  created_at: string;
  updated_at: string;
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    admin: "Administrador",
    gestor: "Gestor",
    consultor: "Consultor",
    bko: "BKO",
  };
  return labels[role?.toLowerCase()] ?? role ?? "Usuário";
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join("")
    .toUpperCase() || "U";
}

function fmtDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function wasEdited(item: VendaObservacao) {
  const created = new Date(item.created_at).getTime();
  const updated = new Date(item.updated_at).getTime();
  return Number.isFinite(created) && Number.isFinite(updated) && updated - created > 1000;
}

export function ErrosPedido({
  vendaId,
  onChanged,
}: {
  vendaId: string;
  podeEditar?: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const db = supabase as any;
  const [itens, setItens] = useState<VendaObservacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<VendaObservacao | null>(null);
  const [texto, setTexto] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<VendaObservacao | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!vendaId) {
      setItens([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await db
      .from("venda_observacoes")
      .select("id, venda_id, texto, created_by, autor_nome, autor_perfil, created_at, updated_at")
      .eq("venda_id", vendaId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ObservacoesPedido] Falha ao carregar", error);
      toast.error("Não foi possível carregar as observações", { description: error.message });
      setItens([]);
    } else {
      setItens((data ?? []) as VendaObservacao[]);
    }
    setLoading(false);
  }, [db, vendaId]);

  useEffect(() => {
    load();
  }, [load]);

  const minhas = useMemo(
    () => new Set(itens.filter(item => item.created_by === user?.id).map(item => item.id)),
    [itens, user?.id],
  );

  const abrirNova = () => {
    setEditando(null);
    setTexto("");
    setModalOpen(true);
  };

  const abrirEditar = (item: VendaObservacao) => {
    if (item.created_by !== user?.id) return;
    setEditando(item);
    setTexto(item.texto);
    setModalOpen(true);
  };

  const notify = useCallback(async () => {
    if (onChanged) await onChanged();
  }, [onChanged]);

  async function salvar() {
    const valor = texto.trim();
    if (!valor) {
      toast.error("Escreva uma observação antes de salvar.");
      return;
    }
    if (!user) {
      toast.error("Sua sessão expirou. Entre novamente.");
      return;
    }

    setSaving(true);
    const result = editando
      ? await db
          .from("venda_observacoes")
          .update({ texto: valor })
          .eq("id", editando.id)
          .eq("created_by", user.id)
      : await db
          .from("venda_observacoes")
          .insert({ venda_id: vendaId, texto: valor });

    setSaving(false);

    if (result.error) {
      console.error("[ObservacoesPedido] Falha ao salvar", result.error);
      toast.error(editando ? "Não foi possível alterar a observação" : "Não foi possível adicionar a observação", {
        description: result.error.message,
      });
      return;
    }

    toast.success(editando ? "Observação atualizada." : "Observação adicionada.");
    setModalOpen(false);
    setEditando(null);
    setTexto("");
    await load();
    await notify();
  }

  async function excluir() {
    if (!confirmDel || !user) return;
    setDeleting(true);

    const { error } = await db
      .from("venda_observacoes")
      .delete()
      .eq("id", confirmDel.id)
      .eq("created_by", user.id);

    setDeleting(false);

    if (error) {
      console.error("[ObservacoesPedido] Falha ao excluir", error);
      toast.error("Não foi possível excluir a observação", { description: error.message });
      return;
    }

    toast.success("Observação excluída.");
    setConfirmDel(null);
    await load();
    await notify();
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <MessageSquareText className="size-4 text-[var(--omni)]" />
            <h3 className="font-display font-semibold text-sm tracking-tight">Observações do Pedido</h3>
            <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border border-border bg-muted/40 text-muted-foreground">
              {itens.length} {itens.length === 1 ? "observação" : "observações"}
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 border-[var(--omni)]/40 text-[var(--omni)]"
            onClick={abrirNova}
            disabled={!user || !vendaId}
          >
            <Plus className="size-3.5" /> Adicionar observação
          </Button>
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground py-6 text-center">Carregando observações…</div>
        ) : itens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-1/40 py-7 px-4 text-center">
            <MessageSquareText className="size-6 text-muted-foreground/50 mx-auto mb-2" />
            <div className="text-sm font-medium">Nenhuma observação registrada.</div>
            <div className="text-xs text-muted-foreground mt-1">Use “Adicionar observação” para registrar uma informação sobre este pedido.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {itens.map(item => {
              const minha = minhas.has(item.id);
              const editada = wasEdited(item);

              return (
                <div key={item.id} className="rounded-lg border border-border bg-surface-1/50 p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="size-9 shrink-0 rounded-full bg-[var(--omni)]/15 border border-[var(--omni)]/25 grid place-items-center text-[11px] font-bold text-[var(--omni)]">
                      {initials(item.autor_nome)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold">{item.autor_nome}</span>
                        <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                          {roleLabel(item.autor_perfil)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{fmtDateTime(item.created_at)}</span>
                        {editada && (
                          <span className="text-[10px] text-muted-foreground italic" title={`Última edição: ${fmtDateTime(item.updated_at)}`}>
                            Editada
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-foreground/90 whitespace-pre-wrap break-words mt-2 leading-relaxed">
                        {item.texto}
                      </div>
                    </div>

                    {minha && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0"
                          title="Editar minha observação"
                          onClick={() => abrirEditar(item)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="size-8 p-0 text-destructive hover:text-destructive"
                          title="Excluir minha observação"
                          onClick={() => setConfirmDel(item)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={open => {
        if (!saving) {
          setModalOpen(open);
          if (!open) {
            setEditando(null);
            setTexto("");
          }
        }
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar observação" : "Adicionar observação"}</DialogTitle>
            <DialogDescription>
              {editando
                ? "Altere o texto da sua observação. Ela ficará marcada como editada."
                : "A observação ficará registrada com seu nome, perfil, data e hora."}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={texto}
            onChange={event => setTexto(event.target.value)}
            rows={6}
            maxLength={3000}
            autoFocus
            placeholder="Digite a observação sobre este pedido…"
            className="resize-y"
          />
          <div className="text-[11px] text-muted-foreground text-right">{texto.length}/3000</div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button
              onClick={salvar}
              disabled={saving || !texto.trim()}
              className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)] font-semibold"
            >
              {saving ? "Salvando…" : editando ? "Salvar alteração" : "Adicionar observação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={open => {
        if (!open && !deleting) setConfirmDel(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir observação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta observação será removida do pedido. Apenas você pode excluir uma observação criada por você.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={event => {
                event.preventDefault();
                void excluir();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo…" : "Excluir observação"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
