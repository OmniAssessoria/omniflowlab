import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Download,
  Eye,
  File,
  FileImage,
  FileText,
  Check,
  Loader2,
  Pencil,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  deletePedidoDocumento,
  downloadPedidoDocumentoBlob,
  listPedidoDocumentos,
  uploadPedidoDocumento,
} from "@/lib/pedido-documentos.api";
import {
  documentTypeLabel,
  formatDocumentBytes,
  type PedidoDocumento,
  validatePedidoDocumento,
} from "@/lib/pedido-documentos";
import { cn } from "@/lib/utils";
import { PdfCanvasViewer } from "@/components/pdf-canvas-viewer";

function fmtDataHora(value: string) {
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

function DocumentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className="size-4 text-sky-400" />;
  if (mimeType === "application/pdf") return <FileText className="size-4 text-red-400" />;
  return <File className="size-4 text-blue-400" />;
}

function uploadFileKey(file: File) {
  return `${file.name}::${file.size}::${file.lastModified}::${file.type}`;
}

function splitFileName(name: string) {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return { base: name, extension: "" };
  return {
    base: name.slice(0, lastDot),
    extension: name.slice(lastDot),
  };
}

function normalizeRenamedBase(value: string) {
  return value
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function TypeBadge({ item }: { item: PedidoDocumento }) {
  const label = documentTypeLabel(item.mime_type, item.arquivo_nome_original);
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold",
        label === "PDF" && "border-red-500/35 bg-red-500/10 text-red-300",
        (label === "DOC" || label === "DOCX") && "border-blue-500/35 bg-blue-500/10 text-blue-300",
        !["PDF", "DOC", "DOCX"].includes(label) && "border-sky-500/35 bg-sky-500/10 text-sky-300",
      )}
    >
      {label}
    </span>
  );
}

export function DocumentosPedido({ vendaId }: { vendaId: string }) {
  const [itens, setItens] = useState<PedidoDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [renamedFiles, setRenamedFiles] = useState<Record<string, string>>({});
  const [editingFileKey, setEditingFileKey] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [fileInputKey, setFileInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [deleting, setDeleting] = useState<PedidoDocumento | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<PedidoDocumento | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPdfData, setPreviewPdfData] = useState<Uint8Array | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const totalLabel = useMemo(() => {
    if (itens.length === 0) return "Nenhum documento";
    if (itens.length === 1) return "1 documento";
    return `${itens.length} documentos`;
  }, [itens.length]);

  const load = useCallback(async () => {
    if (!vendaId) return;
    setLoading(true);
    try {
      setItens(await listPedidoDocumentos(vendaId));
    } catch (error: any) {
      console.error("[DocumentosPedido] Falha ao carregar", error);
      toast.error("Não foi possível carregar os documentos", { description: error?.message });
    } finally {
      setLoading(false);
    }
  }, [vendaId]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetUpload() {
    setTitulo("");
    setFiles([]);
    setRenamedFiles({});
    setEditingFileKey(null);
    setRenameDraft("");
    setUploadProgress({ current: 0, total: 0 });
    setFileInputKey(value => value + 1);
  }

  function resolvedFileName(file: File) {
    return renamedFiles[uploadFileKey(file)] || file.name;
  }

  function fileForUpload(file: File) {
    const targetName = resolvedFileName(file);
    if (targetName === file.name) return file;
    return new (File as any)([file], targetName, {
      type: file.type,
      lastModified: file.lastModified,
    });
  }

  function titleForFile(file: File) {
    const resolvedName = resolvedFileName(file);
    const baseName = resolvedName.replace(/\.[^.]+$/, "").trim() || resolvedName;
    const sharedTitle = titulo.trim();

    if (files.length <= 1) return sharedTitle || baseName;
    return sharedTitle ? `${sharedTitle} — ${baseName}` : baseName;
  }

  function startRename(file: File) {
    if (saving) return;
    const key = uploadFileKey(file);
    const { base } = splitFileName(resolvedFileName(file));
    setEditingFileKey(key);
    setRenameDraft(base);
  }

  function cancelRename() {
    setEditingFileKey(null);
    setRenameDraft("");
  }

  function saveRename(file: File) {
    if (saving) return;
    const key = uploadFileKey(file);
    const currentName = resolvedFileName(file);
    const { extension } = splitFileName(currentName);
    const normalizedBase = normalizeRenamedBase(renameDraft);

    if (!normalizedBase) {
      toast.error("Informe um nome válido para o arquivo.");
      return;
    }

    const finalName = `${normalizedBase}${extension}`;
    setRenamedFiles(current => ({ ...current, [key]: finalName }));
    setEditingFileKey(null);
    setRenameDraft("");
  }

  function removeSelectedFile(index: number) {
    if (saving) return;
    const removed = files[index];
    const key = removed ? uploadFileKey(removed) : null;
    setFiles(current => current.filter((_, currentIndex) => currentIndex !== index));
    if (key) {
      setRenamedFiles(current => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      if (editingFileKey === key) cancelRename();
    }
  }

  function appendSelectedFiles(selected: File[]) {
    if (selected.length === 0) return;

    setFiles(current => {
      const merged = [...current];
      const existing = new Set(
        current.map(uploadFileKey),
      );

      for (const file of selected) {
        const key = uploadFileKey(file);
        if (!existing.has(key)) {
          existing.add(key);
          merged.push(file);
        }
      }

      return merged;
    });

    // Limpa o input nativo para permitir novas seleções sem apagar as anteriores.
    setFileInputKey(value => value + 1);
  }

  async function confirmarUpload() {
    if (files.length === 0) {
      toast.error("Selecione pelo menos um arquivo para enviar.");
      return;
    }

    for (const file of files) {
      const resolvedTitle = titleForFile(file);
      const validationError = validatePedidoDocumento(resolvedTitle, file);
      if (validationError) {
        toast.error(`${file.name}: ${validationError}`);
        return;
      }
    }

    setSaving(true);
    setUploadProgress({ current: 0, total: files.length });

    const failed: File[] = [];
    let successCount = 0;

    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadProgress({ current: index + 1, total: files.length });

        try {
          const uploadFile = fileForUpload(file);
          await uploadPedidoDocumento(vendaId, titleForFile(file), uploadFile);
          successCount += 1;
        } catch (error: any) {
          failed.push(file);
          console.error("[DocumentosPedido] Falha no upload", file.name, error);
        }
      }

      await load();

      if (failed.length === 0) {
        toast.success(
          successCount === 1
            ? "Documento adicionado ao pedido."
            : `${successCount} documentos adicionados ao pedido.`,
        );
        setUploadOpen(false);
        resetUpload();
      } else {
        setFiles(failed);
        setUploadProgress({ current: 0, total: failed.length });
        toast.warning(
          `${successCount} enviado(s) e ${failed.length} com falha.`,
          { description: "Os arquivos que falharam permaneceram selecionados para uma nova tentativa." },
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function fecharPreview() {
    setPreviewItem(null);
    setPreviewLoading(false);
    setPreviewPdfData(null);
    setPreviewUrl(current => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return null;
    });
  }

  async function abrirDocumento(item: PedidoDocumento, download = false) {
    setOpeningId(item.id);

    const isPdf = item.mime_type === "application/pdf"
      || item.arquivo_nome_original.toLowerCase().endsWith(".pdf");
    const isImage = item.mime_type.startsWith("image/");

    if (!download) {
      setPreviewItem(item);
      setPreviewLoading(true);
      setPreviewPdfData(null);
      setPreviewUrl(current => {
        if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
        return null;
      });
    }

    try {
      const downloaded = await downloadPedidoDocumentoBlob(item.storage_path);

      if (download) {
        const mimeType = item.mime_type || downloaded.type || "application/octet-stream";
        const blob = downloaded.type === mimeType
          ? downloaded
          : new Blob([downloaded], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);

        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = item.arquivo_nome_original;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
      } else if (isPdf) {
        const buffer = await downloaded.arrayBuffer();
        setPreviewPdfData(new Uint8Array(buffer));
      } else if (isImage) {
        const mimeType = item.mime_type || downloaded.type || "application/octet-stream";
        const blob = downloaded.type === mimeType
          ? downloaded
          : new Blob([downloaded], { type: mimeType });
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (error: any) {
      if (!download) fecharPreview();
      console.error("[DocumentosPedido] Falha ao abrir", error);
      toast.error("Não foi possível abrir o documento", { description: error?.message });
    } finally {
      setOpeningId(null);
      if (!download) setPreviewLoading(false);
    }
  }

  async function confirmarExclusao() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      const result = await deletePedidoDocumento(deleting.id);
      setDeleting(null);
      await load();
      if (result.storageRemoved) {
        toast.success("Documento excluído do pedido.");
      } else {
        toast.warning("Documento excluído da ficha; a limpeza do arquivo ficou pendente.");
      }
    } catch (error: any) {
      console.error("[DocumentosPedido] Falha ao excluir", error);
      toast.error("Não foi possível excluir o documento", { description: error?.message });
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card/45 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-omni" />
            <h3 className="font-display text-sm font-semibold">Documentos do Pedido</h3>
            <span className="rounded border border-border bg-muted/40 px-2 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
              {totalLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Anexe um ou vários arquivos de uma vez. Imagens, PDF ou Word, até 100 MB por arquivo.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 gap-2 bg-omni text-black hover:bg-omni/90"
          onClick={() => setUploadOpen(true)}
        >
          <UploadCloud className="size-4" /> Adicionar documentos
        </Button>
      </div>

      {loading ? (
        <div className="flex min-h-28 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" /> Carregando documentos…
        </div>
      ) : itens.length === 0 ? (
        <div className="flex min-h-28 flex-col items-center justify-center px-4 text-center">
          <FileText className="mb-2 size-6 text-muted-foreground/60" />
          <p className="text-sm font-medium">Nenhum documento anexado</p>
          <p className="mt-1 text-xs text-muted-foreground">Os arquivos enviados para este pedido aparecerão aqui.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead className="border-b border-border/70 bg-muted/15 text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Título</th>
                <th className="px-3 py-2 font-medium">Nome do arquivo</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Tamanho</th>
                <th className="px-3 py-2 font-medium">Enviado por</th>
                <th className="px-3 py-2 font-medium">Data de envio</th>
                <th className="px-4 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {itens.map(item => (
                <tr key={item.id} className="transition-colors hover:bg-muted/15">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2 font-medium">
                      <DocumentIcon mimeType={item.mime_type} />
                      <span className="max-w-[240px] truncate" title={item.titulo}>{item.titulo}</span>
                    </div>
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2.5 text-muted-foreground" title={item.arquivo_nome_original}>
                    {item.arquivo_nome_original}
                  </td>
                  <td className="px-3 py-2.5"><TypeBadge item={item} /></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatDocumentBytes(item.tamanho_bytes)}</td>
                  <td className="max-w-[180px] truncate px-3 py-2.5" title={item.created_by_nome}>{item.created_by_nome}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{fmtDataHora(item.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="size-8" disabled={openingId === item.id} onClick={() => void abrirDocumento(item)} title="Visualizar">
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" disabled={openingId === item.id} onClick={() => void abrirDocumento(item, true)} title="Baixar">
                        <Download className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeleting(item)} title="Excluir">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={Boolean(previewItem)}
        onOpenChange={(open) => {
          if (!open) fecharPreview();
        }}
      >
        <DialogContent className="flex h-[90vh] w-[calc(100vw-2rem)] max-w-6xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border/70 px-5 py-4">
            <div className="flex min-w-0 items-start justify-between gap-4 pr-7">
              <div className="min-w-0">
                <DialogTitle className="flex items-center gap-2">
                  <Eye className="size-4 text-omni" />
                  Visualizar documento
                </DialogTitle>
                <DialogDescription className="mt-1 truncate" title={previewItem?.arquivo_nome_original}>
                  {previewItem?.arquivo_nome_original ?? ""}
                </DialogDescription>
              </div>
              {previewItem && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-2"
                  disabled={openingId === previewItem.id}
                  onClick={() => void abrirDocumento(previewItem, true)}
                >
                  <Download className="size-3.5" />
                  Baixar
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden bg-black/20">
            {previewLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Carregando documento…
              </div>
            ) : previewItem ? (
              previewItem.mime_type.startsWith("image/") && previewUrl ? (
                <div className="flex h-full items-center justify-center overflow-auto p-4">
                  <img
                    src={previewUrl}
                    alt={previewItem.titulo}
                    className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
                  />
                </div>
              ) : previewItem.mime_type === "application/pdf" || previewItem.arquivo_nome_original.toLowerCase().endsWith(".pdf") ? (
                <PdfCanvasViewer data={previewPdfData} className="h-full" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <File className="mb-3 size-10 text-muted-foreground" />
                  <div className="text-sm font-semibold">Pré-visualização não disponível para este formato</div>
                  <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground">
                    Arquivos Word não possuem renderização nativa confiável no navegador. O arquivo está íntegro e pode ser baixado normalmente.
                  </p>
                  <Button
                    type="button"
                    className="mt-4 gap-2"
                    onClick={() => void abrirDocumento(previewItem, true)}
                  >
                    <Download className="size-4" />
                    Baixar documento
                  </Button>
                </div>
              )
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Não foi possível carregar a pré-visualização.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={uploadOpen} onOpenChange={(open) => {
        setUploadOpen(open);
        if (!open && !saving) resetUpload();
      }}>
        <DialogContent className="flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-3xl flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b border-border/70 px-6 pb-4 pt-6">
            <DialogTitle>Adicionar documentos</DialogTitle>
            <DialogDescription className="max-w-2xl">
              Selecione um ou vários arquivos. Cada arquivo será salvo separadamente no pedido, com limite de 100 MB por arquivo.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="min-w-0 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="documento-titulo">Título / identificação (opcional)</Label>
                <Input
                  id="documento-titulo"
                  value={titulo}
                  maxLength={120}
                  onChange={event => setTitulo(event.target.value)}
                  placeholder="Ex.: Contrato, Documentos do cliente…"
                  disabled={saving}
                  className="w-full"
                />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Você pode selecionar vários de uma vez ou abrir o seletor novamente para ir adicionando arquivos à lista.
                  O lápis permite renomear cada arquivo antes do envio, preservando sua extensão.
                </p>
              </div>

              <div className="min-w-0 space-y-2">
                <Label htmlFor="documento-arquivo">Arquivos</Label>
                <Input
                  key={fileInputKey}
                  id="documento-arquivo"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={saving}
                  className="w-full min-w-0"
                  onChange={event => appendSelectedFiles(Array.from(event.target.files ?? []))}
                />

                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span className="min-w-0">
                    No Windows, Ctrl/Shift também permite selecionar vários de uma vez.
                  </span>
                  {files.length > 0 && (
                    <span className="shrink-0 rounded-full border border-border bg-muted/20 px-2 py-0.5 font-semibold text-foreground">
                      {files.length} na fila
                    </span>
                  )}
                </div>

                {files.length > 0 && (
                  <div className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-muted/10">
                    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border/60 px-3 py-2.5">
                      <span className="min-w-0 truncate text-xs font-semibold">
                        {files.length} {files.length === 1 ? "arquivo selecionado" : "arquivos selecionados"}
                      </span>
                      {!saving && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 text-[10px] text-muted-foreground"
                          onClick={() => {
                            setFiles([]);
                            setRenamedFiles({});
                            setEditingFileKey(null);
                            setRenameDraft("");
                            setFileInputKey(value => value + 1);
                          }}
                        >
                          Limpar seleção
                        </Button>
                      )}
                    </div>

                    <div className="max-h-[320px] divide-y divide-border/50 overflow-y-auto">
                      {files.map((file, index) => {
                        const key = uploadFileKey(file);
                        const displayName = resolvedFileName(file);
                        const { extension } = splitFileName(displayName);
                        const isEditing = editingFileKey === key;

                        return (
                          <div key={key} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                            <File className="size-4 shrink-0 text-muted-foreground" />

                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <div className="flex min-w-0 items-center gap-2">
                                  <Input
                                    value={renameDraft}
                                    onChange={event => setRenameDraft(event.target.value)}
                                    disabled={saving}
                                    autoFocus
                                    className="h-8 min-w-0 flex-1 text-xs"
                                    onKeyDown={event => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        saveRename(file);
                                      }
                                      if (event.key === "Escape") {
                                        event.preventDefault();
                                        cancelRename();
                                      }
                                    }}
                                  />
                                  {extension && (
                                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{extension}</span>
                                  )}
                                </div>
                              ) : (
                                <div className="truncate text-xs font-medium" title={displayName}>{displayName}</div>
                              )}

                              <div className="mt-0.5 text-[10px] text-muted-foreground">
                                {formatDocumentBytes(file.size)}
                                {displayName !== file.name && (
                                  <span className="ml-2 text-omni/80">renomeado</span>
                                )}
                              </div>
                            </div>

                            {!saving && (
                              <div className="flex shrink-0 items-center gap-1">
                                {isEditing ? (
                                  <>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 text-success hover:text-success"
                                      onClick={() => saveRename(file)}
                                      title="Salvar novo nome"
                                    >
                                      <Check className="size-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="size-7 text-muted-foreground"
                                      onClick={cancelRename}
                                      title="Cancelar renomeação"
                                    >
                                      <X className="size-3.5" />
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-muted-foreground hover:text-foreground"
                                    onClick={() => startRename(file)}
                                    title="Renomear antes de enviar"
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                )}

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeSelectedFile(index)}
                                  title="Remover da seleção"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {saving && uploadProgress.total > 0 && (
                  <div className="rounded-lg border border-omni/20 bg-omni/5 px-3 py-2 text-xs text-muted-foreground">
                    Enviando <span className="font-semibold text-foreground">{uploadProgress.current}</span> de{" "}
                    <span className="font-semibold text-foreground">{uploadProgress.total}</span>…
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border/70 bg-background/95 px-6 py-4 sm:justify-end">
            <Button variant="outline" disabled={saving} onClick={() => setUploadOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-omni text-black hover:bg-omni/90"
              disabled={saving || files.length === 0 || Boolean(editingFileKey)}
              onClick={() => void confirmarUpload()}
            >
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {saving
                ? `Enviando ${uploadProgress.current}/${uploadProgress.total}`
                : files.length > 1
                  ? `Enviar ${files.length} documentos`
                  : "Enviar documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && !deletingBusy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `“${deleting.titulo}” deixará de aparecer no pedido. A exclusão ficará registrada no histórico.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={event => {
                event.preventDefault();
                void confirmarExclusao();
              }}
            >
              {deletingBusy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Excluir documento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
