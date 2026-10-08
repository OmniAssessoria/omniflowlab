import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";
import { ImagePlus, LoaderCircle, MessageSquareText, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uppercaseDisplay } from "@/lib/display-normalization";
import { cn } from "@/lib/utils";

type AssinaturaNota = {
  id: string;
  conteudo: string;
  created_by: string | null;
  autor_nome: string;
  imagens: string[];
  created_at: string;
};

const BUCKET = "assinatura-notas";
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeExtension(file: File) {
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return byMime[file.type] || "img";
}

export function AssinaturaNotasChat({
  vendaId,
  readOnly = false,
}: {
  vendaId: string;
  readOnly?: boolean;
}) {
  const { user, profile, roles } = useAuth();
  const canAccess = roles.includes("gestor") || roles.includes("consultor");
  const [messages, setMessages] = useState<AssinaturaNota[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const previews = useMemo(
    () => files.map(file => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(() => {
    return () => {
      previews.forEach(item => URL.revokeObjectURL(item.url));
    };
  }, [previews]);

  const load = useCallback(async () => {
    if (!vendaId || !canAccess) {
      setMessages([]);
      setImageUrls({});
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("venda_consultor_notas")
        .select("id, conteudo, created_by, autor_nome, imagens, created_at")
        .eq("venda_id", vendaId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const next = ((data ?? []) as AssinaturaNota[]).map(item => ({
        ...item,
        imagens: Array.isArray(item.imagens) ? item.imagens : [],
      }));
      setMessages(next);

      const paths = Array.from(new Set(next.flatMap(item => item.imagens ?? [])));
      if (paths.length === 0) {
        setImageUrls({});
      } else {
        const signedPairs = await Promise.all(paths.map(async path => {
          const { data: signed, error: signedError } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(path, 60 * 60);

          if (signedError || !signed?.signedUrl) return null;
          return [path, signed.signedUrl] as const;
        }));

        setImageUrls(Object.fromEntries(signedPairs.filter(Boolean) as Array<readonly [string, string]>));
      }
    } catch (error: any) {
      console.error("[ASSINATURA NOTAS]", error);
      toast.error("Não foi possível carregar as notas da assinatura.");
    } finally {
      setLoading(false);
    }
  }, [vendaId, canAccess]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!vendaId || !user || !canAccess) return;

    const channel = supabase
      .channel(`assinatura-notas-${vendaId}-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "venda_consultor_notas",
          filter: `venda_id=eq.${vendaId}`,
        },
        () => { void load(); },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [vendaId, user?.id, canAccess, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  function addImages(selected: File[]) {
    const valid = selected.filter(file => {
      const nome = file.name || "Imagem colada";
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        toast.error(`${nome}: formato de imagem não permitido.`);
        return false;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${nome}: a imagem deve ter no máximo 10 MB.`);
        return false;
      }
      return true;
    });

    if (valid.length === 0) return;

    setFiles(current => {
      const combined = [...current, ...valid];
      if (combined.length > MAX_IMAGES) {
        toast.error(`É possível anexar até ${MAX_IMAGES} imagens por mensagem.`);
      }
      return combined.slice(0, MAX_IMAGES);
    });
  }

  function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    addImages(selected);
  }

  function pasteImages(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pastedImages = Array.from(event.clipboardData.items)
      .filter(item => item.kind === "file" && item.type.startsWith("image/"))
      .map(item => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (pastedImages.length === 0) return;

    event.preventDefault();
    addImages(pastedImages);
  }

  async function uploadImages() {
    if (!user || files.length === 0) return [] as string[];

    const uploaded: string[] = [];
    try {
      for (const file of files) {
        const path = `${vendaId}/${user.id}/${crypto.randomUUID()}.${safeExtension(file)}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
          });

        if (error) throw error;
        uploaded.push(path);
      }
      return uploaded;
    } catch (error) {
      if (uploaded.length > 0) {
        await supabase.storage.from(BUCKET).remove(uploaded);
      }
      throw error;
    }
  }

  async function send() {
    if (!user || !canAccess || readOnly || sending) return;

    const conteudo = draft.trim();
    if (!conteudo && files.length === 0) return;

    setSending(true);
    let uploaded: string[] = [];
    try {
      uploaded = await uploadImages();

      const { error } = await (supabase as any)
        .from("venda_consultor_notas")
        .insert({
          venda_id: vendaId,
          conteudo,
          created_by: user.id,
          autor_nome: profile?.nome_completo || user.email || "Usuário",
          imagens: uploaded,
        });

      if (error) throw error;

      setDraft("");
      setFiles([]);
      await load();
    } catch (error: any) {
      if (uploaded.length > 0) {
        await supabase.storage.from(BUCKET).remove(uploaded);
      }
      console.error("[ENVIAR ASSINATURA NOTA]", error);
      toast.error("Não foi possível enviar a mensagem.", {
        description: error?.message,
      });
    } finally {
      setSending(false);
    }
  }

  if (!canAccess) return null;

  return (
    <div className="flex min-h-[560px] h-[calc(100vh-330px)] max-h-[780px] flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border bg-surface-1/70 px-4 py-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-omni/20 bg-omni/5 text-omni">
          <MessageSquareText className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold">Assinatura Notas</div>
          <div className="text-[10px] text-muted-foreground">
            Conversa privada entre Consultor e Gestor.
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-background/20 px-3 py-4 sm:px-5">
        {loading && messages.length === 0 ? (
          <div className="grid h-full place-items-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Carregando conversa…
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="grid h-full place-items-center">
            <div className="max-w-sm text-center">
              <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full border border-border bg-surface-1 text-muted-foreground">
                <MessageSquareText className="size-5" />
              </div>
              <div className="text-sm font-semibold">Nenhuma nota de assinatura ainda</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Use este espaço para registrar informações entre Consultor e Gestor durante a assinatura.
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map(message => {
              const mine = Boolean(user && message.created_by === user.id);
              return (
                <div
                  key={message.id}
                  className={cn("flex", mine ? "justify-end" : "justify-start")}
                >
                  <div className={cn("max-w-[82%] sm:max-w-[72%]", mine ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "overflow-hidden rounded-2xl border px-3 py-2.5 shadow-sm",
                        mine
                          ? "rounded-br-md border-omni/25 bg-omni/10"
                          : "rounded-bl-md border-border bg-surface-1",
                      )}
                    >
                      {message.conteudo && (
                        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                          {message.conteudo}
                        </div>
                      )}

                      {message.imagens.length > 0 && (
                        <div className={cn(
                          "grid gap-2",
                          message.conteudo && "mt-2",
                          message.imagens.length === 1 ? "grid-cols-1" : "grid-cols-2",
                        )}>
                          {message.imagens.map(path => {
                            const url = imageUrls[path];
                            if (!url) {
                              return (
                                <div
                                  key={path}
                                  className="grid aspect-video place-items-center rounded-lg border border-border bg-background/40 text-[10px] text-muted-foreground"
                                >
                                  Imagem indisponível
                                </div>
                              );
                            }

                            return (
                              <a key={path} href={url} target="_blank" rel="noreferrer" className="block">
                                <img
                                  src={url}
                                  alt="Imagem anexada à nota de assinatura"
                                  className="max-h-72 w-full rounded-lg border border-border object-cover"
                                />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className={cn(
                      "mt-1 flex items-center gap-1.5 px-1 text-[9px] text-muted-foreground",
                      mine ? "justify-end text-right" : "justify-start",
                    )}>
                      <span className="font-semibold">{uppercaseDisplay(message.autor_nome)}</span>
                      <span>·</span>
                      <span>{formatDateTime(message.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {readOnly ? (
        <div className="border-t border-border bg-surface-1/70 px-4 py-3 text-center text-xs text-muted-foreground">
          Pedido concluído. A conversa foi preservada somente para consulta.
        </div>
      ) : (
        <div className="border-t border-border bg-card p-3">
          {previews.length > 0 && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {previews.map((item, index) => (
                <div key={item.url} className="group relative size-16 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-1">
                  <img src={item.url} alt={item.file.name} className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFiles(current => current.filter((_, fileIndex) => fileIndex !== index))}
                    className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-background/90 text-foreground shadow-sm"
                    aria-label="Remover imagem"
                    title="Remover imagem"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={selectImages}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-10 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              title="Adicionar imagem"
              aria-label="Adicionar imagem"
            >
              <ImagePlus className="size-4" />
            </Button>

            <Textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              onPaste={pasteImages}
              placeholder="Escreva uma nota sobre a assinatura…"
              className="min-h-10 max-h-32 flex-1 resize-none bg-background/50 py-2.5 text-sm"
              maxLength={10000}
              disabled={sending}
              onKeyDown={event => {
                if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void send();
                }
              }}
            />

            <Button
              type="button"
              size="icon"
              className="size-10 shrink-0 bg-omni text-black hover:bg-omni/90"
              disabled={sending || (!draft.trim() && files.length === 0)}
              onClick={() => void send()}
              title="Enviar nota"
              aria-label="Enviar nota"
            >
              {sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          <div className="mt-1.5 text-right text-[9px] text-muted-foreground">
            Ctrl + Enter para enviar
          </div>
        </div>
      )}
    </div>
  );
}
