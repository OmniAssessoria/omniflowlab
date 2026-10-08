import { supabase } from "@/integrations/supabase/client";
import { sanitizePedidoDocumentFileName, validatePedidoDocumento } from "@/lib/pedido-documentos";
import type { SupportDocument } from "@/lib/support.functions";

export const SUPPORT_DOCUMENT_BUCKET = "suporte-documentos";

export async function listSupportDocuments(solicitacaoId: string): Promise<SupportDocument[]> {
  const { data, error } = await (supabase as any)
    .from("suporte_documentos")
    .select("id, solicitacao_id, titulo, arquivo_nome_original, storage_path, mime_type, tamanho_bytes, created_by, created_by_nome, created_by_role, created_at")
    .eq("solicitacao_id", solicitacaoId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupportDocument[];
}

export async function uploadSupportDocument(solicitacaoId: string, titulo: string, file: File): Promise<string> {
  const validationError = validatePedidoDocumento(titulo, file);
  if (validationError) throw new Error(validationError);

  const documentoId = crypto.randomUUID();
  const safeName = sanitizePedidoDocumentFileName(file.name);
  const storagePath = `${solicitacaoId}/${documentoId}/${safeName}`;

  const { error: uploadError } = await supabase.storage.from(SUPPORT_DOCUMENT_BUCKET).upload(storagePath, file, {
    upsert: false,
    contentType: file.type,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await (supabase as any).rpc("registrar_documento_suporte", {
    p_documento_id: documentoId,
    p_solicitacao_id: solicitacaoId,
    p_titulo: titulo.trim(),
    p_nome_original: file.name,
    p_storage_path: storagePath,
    p_mime_type: file.type,
    p_tamanho_bytes: file.size,
  });
  if (error) {
    await supabase.storage.from(SUPPORT_DOCUMENT_BUCKET).remove([storagePath]);
    throw error;
  }
  return data ?? documentoId;
}

export async function downloadSupportDocumentBlob(storagePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(SUPPORT_DOCUMENT_BUCKET).download(storagePath);
  if (error) throw error;
  if (!data) throw new Error("Não foi possível carregar o documento do atendimento.");
  return data;
}

export async function deleteSupportDocument(documentoId: string): Promise<{ storagePath: string; storageRemoved: boolean }> {
  const { data, error } = await (supabase as any).rpc("excluir_documento_suporte", { p_documento_id: documentoId });
  if (error) throw error;
  if (!data) throw new Error("O documento foi excluído, mas o caminho do arquivo não foi retornado.");
  const { error: storageError } = await supabase.storage.from(SUPPORT_DOCUMENT_BUCKET).remove([data]);
  return { storagePath: data, storageRemoved: !storageError };
}
