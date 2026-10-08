import { useCallback, useEffect, useMemo, useState } from "react";
import { Handshake, Mail, Pencil, Phone, Plus, Signature, Trash2, UserRound, Users } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

export type ClienteRepresentante = {
  id: string;
  cliente_id: string;
  nome: string;
  ddd: string | null;
  telefone: string | null;
  email: string | null;
  principal: boolean;
  negociante: boolean;
  assinante: boolean;
  ordem: number;
  created_at: string;
};

type FormState = {
  nome: string;
  ddd: string;
  telefone: string;
  email: string;
};

const EMPTY_FORM: FormState = {
  nome: "",
  ddd: "",
  telefone: "",
  email: "",
};

function telefoneLabel(rep: ClienteRepresentante) {
  const ddd = rep.ddd?.trim();
  const telefone = rep.telefone?.trim();
  if (!ddd && !telefone) return "—";
  if (ddd && telefone) return `(${ddd}) ${telefone}`;
  return telefone || ddd || "—";
}

function validar(form: FormState) {
  if (form.nome.trim().length < 2) return "Informe o nome do representante.";
  const ddd = form.ddd.replace(/\D/g, "");
  if (form.ddd.trim() && ddd.length !== 2) return "DDD deve ter 2 dígitos.";
  const telefone = form.telefone.replace(/\D/g, "");
  if (form.telefone.trim() && telefone.length < 8) return "Informe um telefone válido.";
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Informe um e-mail válido.";
  }
  return null;
}

export function ClienteRepresentantes({
  clienteId,
  canManage,
  compact = false,
  onChanged,
}: {
  clienteId: string;
  canManage: boolean;
  compact?: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const [itens, setItens] = useState<ClienteRepresentante[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<ClienteRepresentante | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [excluindo, setExcluindo] = useState<ClienteRepresentante | null>(null);
  const [papelSaving, setPapelSaving] = useState<"negociante" | "assinante" | null>(null);

  const carregar = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("cliente_representantes")
      .select("id, cliente_id, nome, ddd, telefone, email, principal, negociante, assinante, ordem, created_at")
      .eq("cliente_id", clienteId)
      .order("principal", { ascending: false })
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[REPRESENTANTES] Falha ao carregar", error);
      toast.error("Não foi possível carregar os representantes.", { description: error.message });
      setItens([]);
    } else {
      setItens((data ?? []) as ClienteRepresentante[]);
    }
    setLoading(false);
  }, [clienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!clienteId) return;

    // Um nome único por montagem evita colisão entre canais durante remounts
    // rápidos (ex.: abrir/fechar a edição em React StrictMode).
    const instanceId = Math.random().toString(36).slice(2, 9);
    const channel = supabase.channel(`cliente-representantes-${clienteId}-${instanceId}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cliente_representantes", filter: `cliente_id=eq.${clienteId}` },
      () => void carregar(),
    );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clienteId, carregar]);

  const proximaOrdem = useMemo(
    () => itens.reduce((maior, item) => Math.max(maior, Number(item.ordem ?? 0)), 0) + 1,
    [itens],
  );

  function abrirNovo() {
    setEditando(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function abrirEditar(item: ClienteRepresentante) {
    setEditando(item);
    setForm({
      nome: item.nome ?? "",
      ddd: item.ddd ?? "",
      telefone: item.telefone ?? "",
      email: item.email ?? "",
    });
    setModalOpen(true);
  }

  async function salvar() {
    if (!canManage || !user) return;
    const erro = validar(form);
    if (erro) {
      toast.error(erro);
      return;
    }

    const payload = {
      nome: form.nome.trim(),
      ddd: form.ddd.replace(/\D/g, "") || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
    };

    setSaving(true);
    try {
      if (editando) {
        const { error } = await (supabase as any)
          .from("cliente_representantes")
          .update(payload)
          .eq("id", editando.id)
          .eq("cliente_id", clienteId);
        if (error) throw error;
        toast.success("Representante atualizado.");
      } else {
        const { error } = await (supabase as any)
          .from("cliente_representantes")
          .insert({
            ...payload,
            cliente_id: clienteId,
            principal: itens.length === 0,
            negociante: itens.length === 0,
            assinante: itens.length === 0,
            ordem: itens.length === 0 ? 0 : proximaOrdem,
            created_by: user.id,
          });
        if (error) throw error;
        toast.success("Representante adicionado.");
      }

      setModalOpen(false);
      setEditando(null);
      setForm(EMPTY_FORM);
      await carregar();
      await onChanged?.();
    } catch (error: any) {
      toast.error("Não foi possível salvar o representante.", {
        description: error?.message ?? "Erro inesperado",
      });
    } finally {
      setSaving(false);
    }
  }

  async function definirPapel(item: ClienteRepresentante, papel: "negociante" | "assinante") {
    if (!canManage || papelSaving) return;
    if (item[papel]) return;

    setPapelSaving(papel);
    try {
      const { error } = await (supabase as any).rpc("cliente_definir_papel_representante", {
        p_cliente_id: clienteId,
        p_representante_id: item.id,
        p_papel: papel,
      });
      if (error) throw error;

      toast.success(
        papel === "negociante"
          ? `${item.nome} definido como Negociante.`
          : `${item.nome} definido como Assinante.`,
      );
      await carregar();
      await onChanged?.();
    } catch (error: any) {
      toast.error("Não foi possível alterar a função do representante.", {
        description: error?.message ?? "Erro inesperado",
      });
    } finally {
      setPapelSaving(null);
    }
  }

  async function remover() {
    if (!excluindo || !canManage) return;
    if (itens.length <= 1) {
      toast.error("A empresa precisa manter pelo menos um representante.");
      setExcluindo(null);
      return;
    }

    const { error } = await (supabase as any)
      .from("cliente_representantes")
      .delete()
      .eq("id", excluindo.id)
      .eq("cliente_id", clienteId);

    if (error) {
      toast.error("Não foi possível remover o representante.", { description: error.message });
      return;
    }

    toast.success("Representante removido.");
    setExcluindo(null);
    await carregar();
    await onChanged?.();
  }

  return (
    <section className={compact ? "space-y-2" : "rounded-xl border border-border bg-card p-4"}>
      <div className={compact ? "flex flex-wrap items-center justify-between gap-2" : "flex flex-wrap items-center justify-between gap-3"}>
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-4 text-[var(--omni)]" />
            <h3 className="text-sm font-semibold">Representantes</h3>
            <Badge variant="outline" className="text-[9px]">
              {loading ? "…" : itens.length}
            </Badge>
          </div>
          {!compact && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Contatos autorizados vinculados a esta empresa.
            </p>
          )}
        </div>

        {canManage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={compact ? "h-7 gap-1 px-2 text-[10px]" : "h-8 gap-1.5"}
            onClick={abrirNovo}
          >
            <Plus className="size-3.5" /> Adicionar representante
          </Button>
        )}
      </div>

      {loading ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-muted-foreground">
          Carregando representantes…
        </div>
      ) : itens.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-1/30 px-4 py-5 text-center">
          <UserRound className="mx-auto mb-2 size-5 text-muted-foreground/60" />
          <div className="text-xs font-medium">Nenhum representante cadastrado</div>
          {canManage && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              Adicione o primeiro representante da empresa.
            </div>
          )}
        </div>
      ) : (
        <div className={compact ? "grid gap-1.5 md:grid-cols-2" : "grid gap-2 md:grid-cols-2"}>
          {itens.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                compact ? "rounded-lg p-2.5" : "rounded-xl p-3",
                item.negociante && item.assinante
                  ? "border border-[var(--omni)]/35 bg-[var(--omni)]/[0.055] shadow-[0_0_0_1px_rgba(255,213,0,0.03)]"
                  : item.negociante
                    ? "border border-[var(--warning)]/30 bg-[var(--warning)]/[0.045]"
                    : item.assinante
                      ? "border border-purple/30 bg-purple/[0.04]"
                      : "border border-border bg-surface-1/35",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--omni)]/20 bg-[var(--omni)]/10">
                  <UserRound className="size-4 text-[var(--omni)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="text-sm font-semibold">{item.nome}</div>
                    {item.principal && (
                      <Badge className="h-5 rounded-md border border-[var(--omni)]/30 bg-[var(--omni)]/10 px-1.5 text-[8px] text-[var(--omni)]">
                        PRINCIPAL
                      </Badge>
                    )}
                    {item.negociante && (
                      <Badge className="h-5 gap-1 rounded-md border border-[var(--warning)]/35 bg-[var(--warning)]/10 px-1.5 text-[8px] text-[var(--warning)]">
                        <Handshake className="size-2.5" /> NEGOCIANTE
                      </Badge>
                    )}
                    {item.assinante && (
                      <Badge className="h-5 gap-1 rounded-md border border-purple/35 bg-purple/10 px-1.5 text-[8px] text-purple">
                        <Signature className="size-2.5" /> ASSINANTE
                      </Badge>
                    )}
                    {!item.principal && !item.negociante && !item.assinante && (
                      <span className="text-[9px] text-muted-foreground">Representante {index + 1}</span>
                    )}
                  </div>
                  <div className="mt-2 space-y-1 text-[11px]">
                    <div className="flex items-center gap-1.5 text-foreground/85">
                      <Phone className="size-3 text-muted-foreground" />
                      {telefoneLabel(item)}
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5 text-foreground/85">
                      <Mail className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.email || "—"}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!canManage || Boolean(papelSaving)}
                      onClick={() => void definirPapel(item, "negociante")}
                      className={
                        item.negociante
                          ? "flex items-center gap-2 rounded-lg border border-[var(--warning)]/35 bg-[var(--warning)]/10 px-2.5 py-2 text-left"
                          : "flex items-center gap-2 rounded-lg border border-border bg-background/30 px-2.5 py-2 text-left transition-colors hover:bg-surface-1"
                      }
                    >
                      <Checkbox
                        checked={item.negociante}
                        tabIndex={-1}
                        aria-hidden
                        className="pointer-events-none"
                      />
                      <div className="min-w-0">
                        <div className={item.negociante ? "text-[10px] font-bold text-[var(--warning)]" : "text-[10px] font-semibold"}>
                          Negociante
                        </div>
                        <div className="text-[8px] text-muted-foreground">Conduz a negociação</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={!canManage || Boolean(papelSaving)}
                      onClick={() => void definirPapel(item, "assinante")}
                      className={
                        item.assinante
                          ? "flex items-center gap-2 rounded-lg border border-purple/35 bg-purple/10 px-2.5 py-2 text-left"
                          : "flex items-center gap-2 rounded-lg border border-border bg-background/30 px-2.5 py-2 text-left transition-colors hover:bg-surface-1"
                      }
                    >
                      <Checkbox
                        checked={item.assinante}
                        tabIndex={-1}
                        aria-hidden
                        className="pointer-events-none"
                      />
                      <div className="min-w-0">
                        <div className={item.assinante ? "text-[10px] font-bold text-purple" : "text-[10px] font-semibold"}>
                          Assinante
                        </div>
                        <div className="text-[8px] text-muted-foreground">Responsável pela assinatura</div>
                      </div>
                    </button>
                  </div>
                </div>

                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      title="Editar representante"
                      onClick={() => abrirEditar(item)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive hover:text-destructive"
                      title={itens.length <= 1 ? "A empresa precisa manter um representante" : "Remover representante"}
                      disabled={itens.length <= 1}
                      onClick={() => setExcluindo(item)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={open => {
        setModalOpen(open);
        if (!open) {
          setEditando(null);
          setForm(EMPTY_FORM);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar representante" : "Adicionar representante"}</DialogTitle>
            <DialogDescription>
              Informe os mesmos dados de contato usados para o representante principal da empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={form.nome}
                onChange={event => setForm(current => ({ ...current, nome: event.target.value }))}
                placeholder="Nome do representante"
              />
            </div>
            <div className="space-y-1.5">
              <Label>DDD</Label>
              <Input
                value={form.ddd}
                onChange={event => setForm(current => ({
                  ...current,
                  ddd: event.target.value.replace(/\D/g, "").slice(0, 2),
                }))}
                placeholder="16"
                maxLength={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={form.telefone}
                onChange={event => setForm(current => ({ ...current, telefone: event.target.value }))}
                placeholder="99999-9999"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={event => setForm(current => ({ ...current, email: event.target.value }))}
                placeholder="representante@empresa.com"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={() => void salvar()}
              disabled={saving}
              className="bg-[var(--omni)] text-black hover:bg-[var(--omni-glow)]"
            >
              {saving ? "Salvando…" : editando ? "Salvar representante" : "Adicionar representante"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(excluindo)} onOpenChange={open => !open && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover representante?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluindo
                ? `${excluindo.nome} deixará de aparecer entre os representantes desta empresa.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={event => {
                event.preventDefault();
                void remover();
              }}
            >
              Remover representante
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
