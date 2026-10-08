export const MAX_PEDIDO_DOCUMENT_BYTES = 100 * 1024 * 1024;
export const PEDIDO_DOCUMENT_BUCKET = "pedido-documentos";
export const PEDIDO_DOCUMENT_SIGNED_URL_SECONDS = 120;

export const PEDIDO_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type PedidoDocumentoFileLike = {
  name: string;
  type: string;
  size: number;
};

export type PedidoDocumento = {
  id: string;
  venda_id: string;
  titulo: string;
  arquivo_nome_original: string;
  storage_path: string;
  mime_type: string;
  tamanho_bytes: number;
  created_by: string;
  created_by_nome: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deleted_by_nome: string | null;
};

export function validatePedidoDocumento(
  titulo: string,
  file: PedidoDocumentoFileLike,
): string | null {
  if (!titulo.trim()) return "Informe o título do documento.";
  if (titulo.trim().length > 200) return "O título deve ter no máximo 200 caracteres.";
  if (file.size <= 0) return "O arquivo está vazio.";
  if (file.size > MAX_PEDIDO_DOCUMENT_BYTES) return "O arquivo deve ter no máximo 100 MB.";
  if (!PEDIDO_DOCUMENT_MIME_TYPES.has(file.type)) return "Tipo de arquivo não suportado.";
  return null;
}

export function sanitizePedidoDocumentFileName(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/^-+|-+$/g, "");

  return normalized || "arquivo";
}

function decimalPtBr(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return String(rounded).replace(".", ",");
}

export function formatDocumentBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${decimalPtBr(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${decimalPtBr(bytes / (1024 * 1024))} MB`;
  return `${decimalPtBr(bytes / (1024 * 1024 * 1024))} GB`;
}

export function documentTypeLabel(mimeType: string, fileName: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "application/msword") return "DOC";
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "DOCX";
  const extension = fileName.split(".").pop()?.toUpperCase();
  return extension || "ARQUIVO";
}
