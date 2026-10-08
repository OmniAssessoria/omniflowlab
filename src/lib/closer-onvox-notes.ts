import type { AppRole } from "@/lib/auth";

export type OnvoxNoteTag = "PENDENCIA" | "ERRO" | "OBSERVACAO";

export type OnvoxNote = {
  id: string;
  pedido_id: string;
  tipo: OnvoxNoteTag;
  conteudo: string | null;
  imagem_storage_path: string | null;
  imagem_nome_original: string | null;
  imagem_mime_type: string | null;
  imagem_tamanho_bytes: number | null;
  created_by: string;
  autor_nome: string | null;
  autor_role: string | null;
  created_at: string;
  updated_at: string;
};

export const ONVOX_NOTE_TAGS: Array<{ value: OnvoxNoteTag; label: string }> = [
  { value: "PENDENCIA", label: "PENDÊNCIA" },
  { value: "ERRO", label: "ERRO" },
  { value: "OBSERVACAO", label: "OBSERVAÇÃO" },
];

export function podeGerenciarNotaOnvox(
  role: AppRole | null | undefined,
  userId: string | null | undefined,
  createdBy: string | null | undefined,
) {
  if (!userId) return false;
  if (role === "admin" || role === "bko") return true;
  if (role === "closer" || role === "consultor") return createdBy === userId;
  return false;
}
