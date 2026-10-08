import type { Database as GeneratedDatabase } from "./types";

type PublicSchema = GeneratedDatabase["public"];
type VendaTable = PublicSchema["Tables"]["vendas"];

type CommercialDestinationRow = {
  funil_id: string;
  etapa_id: string;
  funil_nome: string;
  etapa_nome: string;
};

type VendaDocumentoRow = {
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

type VendaDocumentoTable = {
  Row: VendaDocumentoRow;
  Insert: {
    id: string;
    venda_id: string;
    titulo: string;
    arquivo_nome_original: string;
    storage_path: string;
    mime_type: string;
    tamanho_bytes: number;
    created_by: string;
    created_by_nome: string;
    created_at?: string;
    deleted_at?: string | null;
    deleted_by?: string | null;
    deleted_by_nome?: string | null;
  };
  Update: Partial<VendaDocumentoRow>;
  Relationships: [];
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<PublicSchema, "Tables" | "Functions"> & {
    Tables: Omit<PublicSchema["Tables"], "vendas"> & {
      vendas: Omit<VendaTable, "Row" | "Insert" | "Update"> & {
        Row: VendaTable["Row"] & {
          concluido_em: string | null;
          concluido_por: string | null;
        };
        Insert: VendaTable["Insert"] & {
          concluido_em?: string | null;
          concluido_por?: string | null;
        };
        Update: VendaTable["Update"] & {
          concluido_em?: string | null;
          concluido_por?: string | null;
        };
      };
      venda_documentos: VendaDocumentoTable;
    };
    Functions: PublicSchema["Functions"] & {
      pipeline_move_venda: {
        Args: { p_venda_id: string; p_etapa_id: string };
        Returns: CommercialDestinationRow[];
      };
      pipeline_concluir_venda: {
        Args: { p_venda_id: string };
        Returns: string;
      };
      pipeline_reabrir_venda: {
        Args: { p_venda_id: string };
        Returns: CommercialDestinationRow[];
      };
      venda_usuario_tem_acesso: {
        Args: { p_venda_id: string };
        Returns: boolean;
      };
      registrar_documento_pedido: {
        Args: {
          p_documento_id: string;
          p_venda_id: string;
          p_titulo: string;
          p_nome_original: string;
          p_storage_path: string;
          p_mime_type: string;
          p_tamanho_bytes: number;
        };
        Returns: string;
      };
      excluir_documento_pedido: {
        Args: { p_documento_id: string };
        Returns: string;
      };
    };
  };
};
