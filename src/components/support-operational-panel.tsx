import { useCallback, useEffect, useState, type ClipboardEvent } from "react";
import { Download, Eye, FileText, Loader2, Paperclip, Pencil, Plus, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  addSupportInformation,
  assumeSupportCase,
  deleteSupportInformation,
  getSupportCaseDetail,
  updateSupportInformation,
  type SupportDocument,
  type SupportInformation,
} from "@/lib/support.functions";
import {
  deleteSupportDocument,
  downloadSupportDocumentBlob,
  uploadSupportDocument,
} from "@/lib/support-documentos.api";
import { formatDocumentBytes } from "@/lib/pedido-documentos";
import { podeGerenciarNotaSuporte } from "@/lib/support-note-permissions";

export function SupportOperationalPanel({
  solicitacaoId,
  responsavelId,
  responsavelNome,
  concluido,
  onChanged,
}: {
  solicitacaoId: string;
  responsavelId?: string | null;
  responsavelNome?: string | null;
  concluido: boolean;
  onChanged?: () => Promise<void> | void;
}) {
  const { user, profile, primaryRole } = useAuth();
  const [informations, setInformations] = useState<SupportInformation[]>([]);
  const [documents, setDocuments] = useState<SupportDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [info, setInfo] = useState("");
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [pastedPreview, setPastedPreview] = useState<string | null>(null);
  const [allInfoOpen, setAllInfoOpen] = useState(false);
  const [editingInformation, setEditingInformation] = useState<SupportInformation | null>(null);
  const [editingInformationText, setEditingInformationText] = useState("");
  const [docOpen, setDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const canOperate = primaryRole === "bko" || primaryRole === "admin";
  const canAdd = primaryRole === "bko" || primaryRole === "admin" || primaryRole === "consultor";
  const canPasteImage = primaryRole === "bko" || primaryRole === "admin";
  const userRole = primaryRole === "admin" ? "admin" : primaryRole === "bko" ? "bko" : "consultor";
  const latestInformation = informations[0] ?? null;
  const informationDocumentIds = new Set(
    informations
      .map(item => item.imagem_documento_id)
      .filter((id): id is string => Boolean(id)),
  );
  const regularDocuments = documents.filter(documento => !informationDocumentIds.has(documento.id));

  function podeGerenciarInformacao(item: SupportInformation) {
    return podeGerenciarNotaSuporte(primaryRole, user?.id, item.created_by);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await getSupportCaseDetail(solicitacaoId);
      setInformations(detail.informations);
      setDocuments(detail.documents);
    } catch (error: any) {
      toast.error("Não foi possível carregar informações do atendimento", { description: error?.message });
    } finally {
      setLoading(false);
    }
  }, [solicitacaoId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    return () => {
      if (pastedPreview) URL.revokeObjectURL(pastedPreview);
    };
  }, [pastedPreview]);

  function clearPastedImage() {
    if (pastedPreview) URL.revokeObjectURL(pastedPreview);
    setPastedPreview(null);
    setPastedImage(null);
  }

  function handleInfoPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!canPasteImage) return;

    const imageItem = Array.from(event.clipboardData.items)
      .find(item => item.kind === "file" && item.type.startsWith("image/"));
    if (!imageItem) return;

    const rawFile = imageItem.getAsFile();
    if (!rawFile) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(rawFile.type)) {
      toast.error("Formato de imagem não permitido", {
        description: "Use JPEG, PNG, WebP ou GIF.",
      });
      return;
    }

    if (rawFile.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande", {
        description: "A imagem colada pode ter no máximo 10 MB.",
      });
      return;
    }

    event.preventDefault();
    clearPastedImage();

    const extension = rawFile.type === "image/jpeg"
      ? "jpg"
      : rawFile.type === "image/png"
        ? "png"
        : rawFile.type === "image/webp"
          ? "webp"
          : "gif";
    const file = new File(
      [rawFile],
      `informacao-atendimento-${Date.now()}.${extension}`,
      { type: rawFile.type },
    );

    setPastedImage(file);
    setPastedPreview(URL.createObjectURL(file));
    toast.success("Imagem colada", {
      description: "Ela será registrada junto com a informação operacional.",
    });
  }

  async function assumir() {
    if (!canOperate || concluido || working) return;
    setWorking(true);
    try {
      await assumeSupportCase(solicitacaoId);
      toast.success("Atendimento assumido", { description: "Os demais BKOs continuam com acesso ao chamado." });
      await onChanged?.();
    } catch (error: any) {
      toast.error("Não foi possível assumir o atendimento", { description: error?.message });
    } finally {
      setWorking(false);
    }
  }

  async function adicionarInformacao() {
    if (!canAdd || !user?.id || (!info.trim() && !pastedImage) || working) return;
    setWorking(true);
    let imageDocumentId: string | null = null;

    try {
      if (pastedImage) {
        imageDocumentId = await uploadSupportDocument(
          solicitacaoId,
          "Imagem da informação operacional",
          pastedImage,
        );
      }

      await addSupportInformation({
        solicitacaoId,
        informacao: info,
        imagemDocumentoId: imageDocumentId,
        userId: user.id,
        userNome: profile?.nome_completo ?? user.email ?? "Usuário",
        userRole,
      });

      setInfo("");
      clearPastedImage();
      await load();
      toast.success("Informação registrada no atendimento");
    } catch (error: any) {
      if (imageDocumentId) {
        try {
          await deleteSupportDocument(imageDocumentId);
        } catch {
          // O registro principal falhou; a limpeza do anexo é apenas compensatória.
        }
      }
      toast.error("Não foi possível registrar a informação", { description: error?.message });
    } finally {
      setWorking(false);
    }
  }

  function abrirEdicaoInformacao(item: SupportInformation) {
    if (!podeGerenciarInformacao(item)) return;
    setEditingInformation(item);
    setEditingInformationText(item.informacao);
  }

  async function salvarEdicaoInformacao() {
    if (!editingInformation || !user?.id || working) return;
    if (!podeGerenciarInformacao(editingInformation)) {
      toast.error("Você não tem permissão para editar esta nota.");
      return;
    }

    const valor = editingInformationText.trim();
    if (!valor) {
      toast.error("A nota não pode ficar vazia.");
      return;
    }

    setWorking(true);
    try {
      await updateSupportInformation({
        informationId: editingInformation.id,
        informacao: valor,
        createdBy: primaryRole === "consultor" ? user.id : null,
      });
      setEditingInformation(null);
      setEditingInformationText("");
      await load();
      toast.success("Nota atualizada.");
    } catch (error: any) {
      toast.error("Não foi possível editar a nota", { description: error?.message });
    } finally {
      setWorking(false);
    }
  }

  async function excluirInformacao(item: SupportInformation) {
    if (!user?.id || working || !podeGerenciarInformacao(item)) return;
    if (!window.confirm("Excluir esta nota do atendimento?")) return;

    setWorking(true);
    try {
      await deleteSupportInformation({
        informationId: item.id,
        createdBy: primaryRole === "consultor" ? user.id : null,
      });

      if (item.imagem_documento_id) {
        try {
          const cleanup = await deleteSupportDocument(item.imagem_documento_id);
          if (!cleanup.storageRemoved) {
            console.warn("[SupportOperationalPanel] Nota excluída; arquivo físico da imagem ficou pendente de limpeza.");
          }
        } catch (imageError) {
          console.error("[SupportOperationalPanel] Nota excluída; falha ao limpar imagem vinculada", imageError);
        }
      }

      if (editingInformation?.id === item.id) {
        setEditingInformation(null);
        setEditingInformationText("");
      }

      await load();
      toast.success("Nota excluída do atendimento.");
    } catch (error: any) {
      toast.error("Não foi possível excluir a nota", { description: error?.message });
    } finally {
      setWorking(false);
    }
  }

  async function enviarDocumento() {
    if (!docFile || !docTitle.trim() || working) {
      if (!docFile || !docTitle.trim()) toast.error("Informe o título e selecione um arquivo.");
      return;
    }
    setWorking(true);
    try {
      await uploadSupportDocument(solicitacaoId, docTitle, docFile);
      setDocOpen(false);
      setDocTitle("");
      setDocFile(null);
      await load();
      toast.success("Documento adicionado ao atendimento");
    } catch (error: any) {
      toast.error("Não foi possível enviar o documento", { description: error?.message });
    } finally {
      setWorking(false);
    }
  }

  async function abrirDocumento(documento: SupportDocument, download = false) {
    setOpeningId(documento.id);
    const previewWindow = download ? null : window.open("", "_blank");
    try {
      const blob = await downloadSupportDocumentBlob(documento.storage_path);
      const blobUrl = URL.createObjectURL(blob);
      if (download) {
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = documento.arquivo_nome_original;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
      } else if (previewWindow) {
        previewWindow.opener = null;
        previewWindow.location.href = blobUrl;
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60_000);
      } else {
        URL.revokeObjectURL(blobUrl);
        throw new Error("O navegador bloqueou a nova aba.");
      }
    } catch (error: any) {
      previewWindow?.close();
      toast.error("Não foi possível abrir o documento", { description: error?.message });
    } finally {
      setOpeningId(null);
    }
  }

  async function excluirDocumento(documento: SupportDocument) {
    if (!window.confirm(`Excluir “${documento.titulo}” do atendimento?`)) return;
    setWorking(true);
    try {
      await deleteSupportDocument(documento.id);
      await load();
      toast.success("Documento excluído do atendimento");
    } catch (error: any) {
      toast.error("Não foi possível excluir o documento", { description: error?.message });
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-display font-semibold">
              <UserCheck className="size-4 text-omni" /> Responsável principal
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {responsavelNome || "Nenhum BKO assumiu este atendimento ainda."}
            </div>
          </div>
          {canOperate && !concluido && (
            <Button type="button" size="sm" variant="outline" onClick={() => void assumir()} disabled={working || responsavelId === user?.id} className="gap-2">
              {working ? <Loader2 className="size-3.5 animate-spin" /> : <UserCheck className="size-3.5" />}
              {responsavelId === user?.id ? "Você está responsável" : "Assumir atendimento"}
            </Button>
          )}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Assumir define o responsável principal, mas não cria exclusividade: os demais BKOs continuam visualizando e atuando no atendimento.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-1 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-display font-semibold">
              <Plus className="size-4 text-omni" /> Informações do atendimento
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Registro operacional separado da conversa.</p>
          </div>
          <div className="flex items-center gap-2">
            {!canAdd && informations.length > 0 && (
              <Dialog open={allInfoOpen} onOpenChange={setAllInfoOpen}>
                <DialogTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 px-2 text-[10px]">
                    <Eye className="size-3.5" /> Todos
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl max-h-[82vh] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>Todas as informações do atendimento</DialogTitle>
                    <DialogDescription>
                      Histórico operacional completo, da mais recente para a mais antiga.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[65vh] overflow-y-auto divide-y divide-border/60 rounded-lg border border-border">
                    {informations.map(item => (
                      <SupportInformationEntry
                        key={item.id}
                        item={item}
                        documento={item.imagem_documento_id
                          ? documents.find(documento => documento.id === item.imagem_documento_id) ?? null
                          : null}
                        canManage={podeGerenciarInformacao(item)}
                        working={working}
                        onEdit={() => abrirEdicaoInformacao(item)}
                        onDelete={() => void excluirInformacao(item)}
                      />
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
            <Badge variant="outline" className="text-[9px]">{informations.length}</Badge>
          </div>
        </div>

        {canAdd && (
          <div className="border-b border-border p-3 space-y-2">
            <Textarea
              value={info}
              onChange={event => setInfo(event.target.value)}
              onPaste={handleInfoPaste}
              rows={3}
              placeholder={canPasteImage
                ? "Adicione uma informação operacional ao histórico... Cole uma imagem com Ctrl+V."
                : "Adicione uma informação operacional ao histórico..."}
            />

            {pastedPreview && (
              <div className="flex items-start gap-3 rounded-lg border border-omni/25 bg-omni/5 p-2">
                <img
                  src={pastedPreview}
                  alt="Prévia da imagem colada"
                  className="max-h-32 max-w-48 rounded-md border border-border object-contain"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold">Imagem pronta para anexar</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {pastedImage?.name} · {pastedImage ? formatDocumentBytes(pastedImage.size) : ""}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 px-2 text-[10px] text-destructive"
                    onClick={clearPastedImage}
                    disabled={working}
                  >
                    <Trash2 className="size-3" /> Remover imagem
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {informations.length > 0 && (
                <Dialog open={allInfoOpen} onOpenChange={setAllInfoOpen}>
                  <DialogTrigger asChild>
                    <Button type="button" size="sm" variant="outline" className="gap-1.5">
                      <Eye className="size-3.5" /> Todos ({informations.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-2xl max-h-[82vh] overflow-hidden">
                    <DialogHeader>
                      <DialogTitle>Todas as informações do atendimento</DialogTitle>
                      <DialogDescription>
                        Histórico operacional completo, da mais recente para a mais antiga.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[65vh] overflow-y-auto divide-y divide-border/60 rounded-lg border border-border">
                      {informations.map(item => (
                        <SupportInformationEntry
                          key={item.id}
                          item={item}
                          documento={item.imagem_documento_id
                            ? documents.find(documento => documento.id === item.imagem_documento_id) ?? null
                            : null}
                          canManage={podeGerenciarInformacao(item)}
                          working={working}
                          onEdit={() => abrirEdicaoInformacao(item)}
                          onDelete={() => void excluirInformacao(item)}
                        />
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              <Button
                size="sm"
                onClick={() => void adicionarInformacao()}
                disabled={working || (!info.trim() && !pastedImage)}
              >
                {working ? "Registrando…" : "Registrar informação"}
              </Button>
            </div>
          </div>
        )}

        <div>
          {loading && <div className="p-4 text-xs text-muted-foreground">Carregando…</div>}
          {!loading && !latestInformation && (
            <div className="p-4 text-xs text-muted-foreground">Nenhuma informação registrada.</div>
          )}
          {!loading && latestInformation && (
            <>
              <div className="border-b border-border/60 px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mais recente
              </div>
              <SupportInformationEntry
                item={latestInformation}
                documento={latestInformation.imagem_documento_id
                  ? documents.find(documento => documento.id === latestInformation.imagem_documento_id) ?? null
                  : null}
                canManage={podeGerenciarInformacao(latestInformation)}
                working={working}
                onEdit={() => abrirEdicaoInformacao(latestInformation)}
                onDelete={() => void excluirInformacao(latestInformation)}
              />
            </>
          )}
        </div>
      </section>

      <Dialog
        open={Boolean(editingInformation)}
        onOpenChange={open => {
          if (working) return;
          if (!open) {
            setEditingInformation(null);
            setEditingInformationText("");
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar nota do atendimento</DialogTitle>
            <DialogDescription>
              Altere o texto da nota. A imagem vinculada será preservada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="editar-informacao-atendimento">Nota</Label>
            <Textarea
              id="editar-informacao-atendimento"
              value={editingInformationText}
              onChange={event => setEditingInformationText(event.target.value)}
              rows={5}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingInformation(null);
                setEditingInformationText("");
              }}
              disabled={working}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void salvarEdicaoInformacao()}
              disabled={working || !editingInformationText.trim()}
            >
              {working ? "Salvando…" : "Salvar alteração"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-1 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-display font-semibold"><Paperclip className="size-4 text-omni" /> Documentos do atendimento</div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">PDF, Word e imagens, até 100 MB por arquivo.</p>
          </div>
          {canAdd && (
            <Dialog open={docOpen} onOpenChange={setDocOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline" className="gap-2"><Paperclip className="size-3.5" /> Adicionar</Button></DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Adicionar documento</DialogTitle><DialogDescription>O arquivo ficará privado e vinculado a este atendimento.</DialogDescription></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Título</Label><Input value={docTitle} onChange={event => setDocTitle(event.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Arquivo</Label><Input type="file" accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp,image/gif" onChange={event => setDocFile(event.target.files?.[0] ?? null)} /></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setDocOpen(false)} disabled={working}>Cancelar</Button><Button onClick={() => void enviarDocumento()} disabled={working}>{working ? "Enviando…" : "Enviar"}</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <div className="divide-y divide-border/60">
          {!loading && regularDocuments.length === 0 && <div className="p-4 text-xs text-muted-foreground">Nenhum documento anexado.</div>}
          {regularDocuments.map(documento => (
            <div key={documento.id} className="flex items-center gap-3 p-3">
              <FileText className="size-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{documento.titulo}</div>
                <div className="truncate text-[10px] text-muted-foreground">{documento.arquivo_nome_original} · {formatDocumentBytes(documento.tamanho_bytes)} · {documento.created_by_nome}</div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="size-8" disabled={openingId === documento.id} onClick={() => void abrirDocumento(documento)} title="Visualizar">{openingId === documento.id ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}</Button>
                <Button size="icon" variant="ghost" className="size-8" disabled={openingId === documento.id} onClick={() => void abrirDocumento(documento, true)} title="Baixar"><Download className="size-3.5" /></Button>
                {canAdd && <Button size="icon" variant="ghost" className="size-8 text-destructive" disabled={working} onClick={() => void excluirDocumento(documento)} title="Excluir"><Trash2 className="size-3.5" /></Button>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SupportInformationEntry({
  item,
  documento,
  canManage,
  working,
  onEdit,
  onDelete,
}: {
  item: SupportInformation;
  documento: SupportDocument | null;
  canManage: boolean;
  working: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  useEffect(() => {
    if (!documento || !documento.mime_type.startsWith("image/")) {
      setImageUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setImageLoading(true);

    void downloadSupportDocumentBlob(documento.storage_path)
      .then(blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setImageUrl(null);
      })
      .finally(() => {
        if (!cancelled) setImageLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documento?.id, documento?.storage_path, documento?.mime_type]);

  return (
    <div className="p-3">
      <div className="text-sm whitespace-pre-wrap">{item.informacao}</div>

      {imageLoading && (
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          <Loader2 className="size-3 animate-spin" /> Carregando imagem…
        </div>
      )}

      {imageUrl && documento && (
        <button
          type="button"
          className="mt-2 block max-w-full overflow-hidden rounded-lg border border-border bg-surface-1 p-1 transition-colors hover:border-omni/50"
          onClick={() => {
            const preview = window.open("", "_blank");
            if (preview) {
              preview.opener = null;
              preview.location.href = imageUrl;
            }
          }}
          title="Abrir imagem em tamanho maior"
        >
          <img
            src={imageUrl}
            alt={documento.titulo || "Imagem da informação operacional"}
            className="max-h-72 max-w-full rounded-md object-contain"
          />
        </button>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[10px] text-muted-foreground">
          {item.created_by_nome} · {item.created_by_role.toUpperCase()} · {new Date(item.created_at).toLocaleString("pt-BR")}
        </div>

        {canManage && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[10px]"
              onClick={onEdit}
              disabled={working}
              title="Editar nota"
            >
              <Pencil className="size-3" /> Editar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-[10px] text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={working}
              title="Excluir nota"
            >
              <Trash2 className="size-3" /> Excluir
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

