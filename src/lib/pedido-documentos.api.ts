import { supabase } from "@/integrations/supabase/client";
import {
  PEDIDO_DOCUMENT_BUCKET,
  PEDIDO_DOCUMENT_SIGNED_URL_SECONDS,
  type PedidoDocumento,
  sanitizePedidoDocumentFileName,
  validatePedidoDocumento,
} from "./pedido-documentos";

export async function listPedidoDocumentos(vendaId: string): Promise<PedidoDocumento[]> {
  const { data, error } = await supabase
    .from("venda_documentos")
    .select("*")
    .eq("venda_id", vendaId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as PedidoDocumento[];
}

export async function uploadPedidoDocumento(
  vendaId: string,
  titulo: string,
  file: File,
): Promise<string> {
  const validationError = validatePedidoDocumento(titulo, file);
  if (validationError) throw new Error(validationError);

  const documentoId = crypto.randomUUID();
  const safeName = sanitizePedidoDocumentFileName(file.name);
  const storagePath = `${vendaId}/${documentoId}/${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(PEDIDO_DOCUMENT_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) throw uploadError;

  const { data, error: registerError } = await supabase.rpc("registrar_documento_pedido", {
    p_documento_id: documentoId,
    p_venda_id: vendaId,
    p_titulo: titulo.trim(),
    p_nome_original: file.name,
    p_storage_path: storagePath,
    p_mime_type: file.type,
    p_tamanho_bytes: file.size,
  });

  if (registerError) {
    await supabase.storage.from(PEDIDO_DOCUMENT_BUCKET).remove([storagePath]);
    throw registerError;
  }

  return data ?? documentoId;
}

export async function getPedidoDocumentoPreviewUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PEDIDO_DOCUMENT_BUCKET)
    .createSignedUrl(storagePath, PEDIDO_DOCUMENT_SIGNED_URL_SECONDS);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Não foi possível gerar a URL de visualização do documento.");
  return data.signedUrl;
}

export async function downloadPedidoDocumentoBlob(storagePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage
    .from(PEDIDO_DOCUMENT_BUCKET)
    .download(storagePath);

  if (error) throw error;
  if (!data) throw new Error("Não foi possível carregar o arquivo do documento.");
  return data;
}

export async function deletePedidoDocumento(
  documentoId: string,
): Promise<{ storagePath: string; storageRemoved: boolean }> {
  const { data, error } = await supabase.rpc("excluir_documento_pedido", {
    p_documento_id: documentoId,
  });

  if (error) throw error;
  if (!data) throw new Error("O documento foi excluído, mas o caminho do arquivo não foi retornado.");

  const { error: storageError } = await supabase.storage
    .from(PEDIDO_DOCUMENT_BUCKET)
    .remove([data]);

  return {
    storagePath: data,
    storageRemoved: !storageError,
  };
}