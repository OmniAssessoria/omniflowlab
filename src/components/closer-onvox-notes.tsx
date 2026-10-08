import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { Eye, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ONVOX_NOTE_TAGS,
  podeGerenciarNotaOnvox,
  type OnvoxNote,
  type OnvoxNoteTag,
} from "@/lib/closer-onvox-notes";

const BUCKET = "closer-documentos";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

type HydratedOnvoxNote = OnvoxNote & { imagem_url?: string | null };

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

function noteTagClass(tag: OnvoxNoteTag) {
  if (tag === "ERRO") return "border-destructive/40 bg-destructive/10 text-destructive";
  if (tag === "PENDENCIA") return "border-warning/40 bg-warning/10 text-warning";
  return "border-[#D92FA0]/35 bg-[#D92FA0]/10 text-[#D92FA0]";
}

function noteTagLabel(tag: OnvoxNoteTag) {
  return ONVOX_NOTE_TAGS.find((item) => item.value === tag)?.label ?? tag;
}

export function CloserOnvoxNotes({
  pedidoId,
  closerId,
}: {
  pedidoId: string;
  closerId: string;
}) {
  const { user, profile, roles, primaryRole } = useAuth();
  const [notes, setNotes] = useState<HydratedOnvoxNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [tipo, setTipo] = useState<OnvoxNoteTag>("OBSERVACAO");
  const [conteudo, setConteudo] = useState("");
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [pastedPreview, setPastedPreview] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [editing, setEditing] = useState<HydratedOnvoxNote | null>(null);
  const [editingTipo, setEditingTipo] = useState<OnvoxNoteTag>("OBSERVACAO");
  const [editingConteudo, setEditingConteudo] = useState("");
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveRole = useMemo<AppRole | null>(() => {
    if (roles.includes("admin")) return "admin";
    if (roles.includes("bko")) return "bko";
    if (roles.includes("closer")) return "closer";
    if (roles.includes("consultor")) return "consultor";
    return primaryRole;
  }, [roles, primaryRole]);

  const canAdd = Boolean(
    user?.id && (
      effectiveRole === "admin"
      || effectiveRole === "bko"
      || ((effectiveRole === "closer" || effectiveRole === "consultor") && closerId === user.id)
    )
  );

  const load = useCallback(async () => {
    setLoading(true);
    const db = supabase as any;
    const result = await db
      .from("closer_pedido_notas")
      .select("*")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (result.error) {
      toast.error("Não foi possível carregar as notas ONVOX", { description: result.error.message });
      setLoading(false);
      return;
    }

    const hydrated = await Promise.all(
      ((result.data ?? []) as OnvoxNote[]).map(async (note) => {
        if (!note.imagem_storage_path) return { ...note, imagem_url: null };
        const signed = await supabase.storage.from(BUCKET).createSignedUrl(note.imagem_storage_path, 60 * 60);
        return { ...note, imagem_url: signed.data?.signedUrl ?? null };
      }),
    );

    setNotes(hydrated);
    setLoading(false);
  }, [pedidoId]);

  useEffect(() => {
    void load();
    const db = supabase as any;
    const channel = db
      .channel(`closer-onvox-notas-${pedidoId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "closer_pedido_notas", filter: `pedido_id=eq.${pedidoId}` },
        load,
      )
      .subscribe();

    return () => { db.removeChannel(channel); };
  }, [pedidoId, load]);

  useEffect(() => () => {
    if (pastedPreview) URL.revokeObjectURL(pastedPreview);
  }, [pastedPreview]);

  function clearImage() {
    if (pastedPreview) URL.revokeObjectURL(pastedPreview);
    setPastedPreview(null);
    setPastedImage(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function useImage(file: File | null) {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast.error("Formato de imagem não permitido", { description: "Use JPEG, PNG, WebP ou GIF." });
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Imagem muito grande", { description: "O limite é 10 MB." });
      return;
    }

    clearImage();
    setPastedImage(file);
    setPastedPreview(URL.createObjectURL(file));
  }

  function handleNotePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!canAdd) return;
    const item = Array.from(event.clipboardData.items)
      .find((clipboardItem) => clipboardItem.kind === "file" && clipboardItem.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (!file) return;
    event.preventDefault();
    useImage(file);
  }

  async function addNote() {
    if (!user?.id || !canAdd || working || (!conteudo.trim() && !pastedImage)) return;

    setWorking(true);
    const db = supabase as any;
    let imagePath: string | null = null;

    try {
      if (pastedImage) {
        const original = pastedImage.name || `nota-${Date.now()}.png`;
        imagePath = `${pedidoId}/notas/${crypto.randomUUID()}-${safeFileName(original)}`;
        const upload = await supabase.storage.from(BUCKET).upload(imagePath, pastedImage, {
          cacheControl: "3600",
          contentType: pastedImage.type,
          upsert: false,
        });
        if (upload.error) throw upload.error;
      }

      const inserted = await db
        .from("closer_pedido_notas")
        .insert({
          pedido_id: pedidoId,
          tipo,
          conteudo: conteudo.trim() || null,
          imagem_storage_path: imagePath,
          imagem_nome_original: pastedImage?.name || null,
          imagem_mime_type: pastedImage?.type || null,
          imagem_tamanho_bytes: pastedImage?.size || null,
          created_by: user.id,
          autor_nome: profile?.nome_completo ?? user.email ?? "Usuário",
          autor_role: effectiveRole,
        })
        .select("id")
        .single();

      if (inserted.error) {
        if (imagePath) await supabase.storage.from(BUCKET).remove([imagePath]);
        throw inserted.error;
      }

      setConteudo("");
      setTipo("OBSERVACAO");
      clearImage();
      await load();
      toast.success("Nota operacional registrada.");
    } catch (error: any) {
      toast.error("Não foi possível registrar a nota", { description: error?.message ?? String(error) });
    } finally {
      setWorking(false);
    }
  }

  function openEdit(note: HydratedOnvoxNote) {
    setEditing(note);
    setEditingTipo(note.tipo);
    setEditingConteudo(note.conteudo ?? "");
  }

  async function saveEdit() {
    if (!editing || !user?.id || working || !podeGerenciarNotaOnvox(effectiveRole, user.id, editing.created_by)) return;
    if (!editingConteudo.trim() && !editing.imagem_storage_path) {
      toast.error("A nota precisa ter texto ou imagem.");
      return;
    }

    setWorking(true);
    const db = supabase as any;
    try {
      const result = await db
        .from("closer_pedido_notas")
        .update({
          tipo: editingTipo,
          conteudo: editingConteudo.trim() || null,
        })
        .eq("id", editing.id)
        .select("id")
        .single();

      if (result.error) throw result.error;
      setEditing(null);
      await load();
      toast.success("Nota atualizada.");
    } catch (error: any) {
      toast.error("Não foi possível editar a nota", { description: error?.message ?? String(error) });
    } finally {
      setWorking(false);
    }
  }

  async function deleteNote(note: HydratedOnvoxNote) {
    if (!user?.id || working || !podeGerenciarNotaOnvox(effectiveRole, user.id, note.created_by)) return;
    if (!window.confirm("Excluir esta nota operacional?")) return;

    setWorking(true);
    const db = supabase as any;
    try {
      const result = await db.from("closer_pedido_notas").delete().eq("id", note.id);
      if (result.error) throw result.error;

      if (note.imagem_storage_path) {
        const cleanup = await supabase.storage.from(BUCKET).remove([note.imagem_storage_path]);
        if (cleanup.error) console.warn("[CloserOnvoxNotes] Nota excluída; imagem ficou pendente de limpeza.", cleanup.error);
      }

      await load();
      toast.success("Nota excluída.");
    } catch (error: any) {
      toast.error("Não foi possível excluir a nota", { description: error?.message ?? String(error) });
    } finally {
      setWorking(false);
    }
  }

  const recent = notes.slice(0, 3);
  const previous = notes.slice(3);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-1 px-4 py-3">
        <div>
          <div className="text-sm font-semibold">Notas operacionais</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground">Pendências, erros e observações do acompanhamento.</div>
        </div>
        <div className="flex items-center gap-2">
          {previous.length > 0 && (
            <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setAllOpen(true)}>
              <Eye className="size-3.5" /> Ver anteriores ({previous.length})
            </Button>
          )}
          <Badge variant="outline">{notes.length}</Badge>
        </div>
      </div>

      {canAdd && (
        <div className="space-y-3 border-b border-border p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={tipo} onValueChange={(value) => setTipo(value as OnvoxNoteTag)} disabled={working}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ONVOX_NOTE_TAGS.map((tag) => <SelectItem key={tag.value} value={tag.value}>{tag.label}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="min-w-0 flex-1">
              <Textarea
                value={conteudo}
                onChange={(event) => setConteudo(event.target.value)}
                onPaste={handleNotePaste}
                rows={3}
                placeholder="Registre uma nota. Você também pode colar uma imagem com Ctrl+V."
                disabled={working}
              />
            </div>
          </div>

          {pastedPreview && (
            <div className="flex items-start gap-3 rounded-lg border border-[#D92FA0]/25 bg-[#D92FA0]/5 p-2">
              <img src={pastedPreview} alt="Prévia da imagem" className="max-h-32 max-w-48 rounded-md border border-border object-contain" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold">{pastedImage?.name || "Imagem colada"}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">A imagem será vinculada à nota.</div>
              </div>
              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={clearImage} disabled={working}><X className="size-4" /></Button>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => imageInputRef.current?.click()} disabled={working}>
              <ImagePlus className="mr-1.5 size-3.5" /> Imagem
            </Button>
            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => useImage(event.target.files?.[0] ?? null)} />
            <Button type="button" size="sm" onClick={() => void addNote()} disabled={working || (!conteudo.trim() && !pastedImage)}>
              <Plus className="mr-1.5 size-3.5" /> {working ? "Registrando…" : "Registrar nota"}
            </Button>
          </div>
        </div>
      )}

      <div>
        {loading && <div className="p-4 text-xs text-muted-foreground">Carregando notas…</div>}
        {!loading && recent.length === 0 && <div className="p-4 text-xs text-muted-foreground">Nenhuma nota registrada.</div>}
        {!loading && recent.map((note) => (
          <OnvoxNoteEntry
            key={note.id}
            note={note}
            canManage={podeGerenciarNotaOnvox(effectiveRole, user?.id, note.created_by)}
            working={working}
            onEdit={() => openEdit(note)}
            onDelete={() => void deleteNote(note)}
          />
        ))}
      </div>

      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="max-h-[82vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Notas anteriores</DialogTitle>
            <DialogDescription>Notas mais antigas, da mais recente para a mais antiga.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[64vh] overflow-y-auto rounded-lg border border-border">
            {previous.map((note) => (
              <OnvoxNoteEntry
                key={note.id}
                note={note}
                canManage={podeGerenciarNotaOnvox(effectiveRole, user?.id, note.created_by)}
                working={working}
                onEdit={() => {
                  setAllOpen(false);
                  openEdit(note);
                }}
                onDelete={() => void deleteNote(note)}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && !working && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar nota operacional</DialogTitle>
            <DialogDescription>A imagem vinculada é preservada; edite a tag e o texto da nota.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={editingTipo} onValueChange={(value) => setEditingTipo(value as OnvoxNoteTag)} disabled={working}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ONVOX_NOTE_TAGS.map((tag) => <SelectItem key={tag.value} value={tag.value}>{tag.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea value={editingConteudo} onChange={(event) => setEditingConteudo(event.target.value)} rows={5} disabled={working} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={working}>Cancelar</Button>
            <Button onClick={() => void saveEdit()} disabled={working}>{working ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function OnvoxNoteEntry({
  note,
  canManage,
  working,
  onEdit,
  onDelete,
}: {
  note: HydratedOnvoxNote;
  canManage: boolean;
  working: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="border-b border-border/60 p-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={noteTagClass(note.tipo)}>{noteTagLabel(note.tipo)}</Badge>
            <span className="text-[10px] font-semibold">{note.autor_nome || "Usuário"}</span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{note.autor_role || "—"}</span>
          </div>
          <div className="mt-1 text-[9px] text-muted-foreground">
            {new Date(note.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            {note.updated_at !== note.created_at ? " · editada" : ""}
          </div>
        </div>

        {canManage && (
          <div className="flex shrink-0 items-center gap-1">
            <Button type="button" size="icon" variant="ghost" className="size-7" onClick={onEdit} disabled={working} title="Editar nota"><Pencil className="size-3.5" /></Button>
            <Button type="button" size="icon" variant="ghost" className="size-7 text-destructive" onClick={onDelete} disabled={working} title="Excluir nota"><Trash2 className="size-3.5" /></Button>
          </div>
        )}
      </div>

      {note.conteudo && <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{note.conteudo}</div>}
      {note.imagem_url && (
        <a href={note.imagem_url} target="_blank" rel="noreferrer" className="mt-3 inline-block">
          <img src={note.imagem_url} alt={note.imagem_nome_original || "Imagem da nota"} className="max-h-64 max-w-full rounded-lg border border-border object-contain" />
        </a>
      )}
    </article>
  );
}
