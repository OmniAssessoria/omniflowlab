export type AcompanhamentoOperadora = "CLARO" | "VIVO";
export type AcompanhamentoRole = "admin" | "gestor";
export type AcompanhamentoFonte = "status_manual" | "status_robo" | "pipeline_etapa";
export type MetaMensalGrupo = "np_fixa" | "outros";
export type MetaSemanalGrupo = "novo_importado" | "renovacao";
export type MetaConsultorQuadro = "enviados" | "assinados";

export interface OperationalWeek {
  index: number;
  start: string;
  end: string;
}

export interface AcompanhamentoGrupo {
  id: string;
  contexto: string;
  codigo: string;
  nome: string;
  operadora: AcompanhamentoOperadora | null;
  ordem: number;
  ativo: boolean;
  updated_by?: string | null;
  updated_at?: string | null;
}

export interface TipoPedidoCatalogo {
  id: string;
  nome: string;
  operadora: AcompanhamentoOperadora;
  ativo: boolean;
}

export interface TipoPedidoVinculo {
  id: string;
  tipo_pedido_id: string;
  grupo_id: string;
  classificado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsultorAcompanhamento {
  id: string;
  nome_completo: string;
  ativo: boolean;
  historico?: boolean;
}

export interface ManualStatusOption {
  id: string;
  nome: string;
  operadora: AcompanhamentoOperadora;
  ativo: boolean;
  source: "status_manual";
}

export interface RobotStatusOption {
  id: string;
  nome: string;
  normalizado: string;
  source: "status_robo";
  roboNome?: string | null;
}

export interface PipelineStageOption {
  id: string;
  nome: string;
  funil_id: string;
  ativo: boolean;
  source: "pipeline_etapa";
}

export interface AcompanhamentoQuadro {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
}

export interface AcompanhamentoQuadroRegra {
  id: string;
  quadro_id: string;
  operadora: AcompanhamentoOperadora | null;
  fonte: AcompanhamentoFonte;
  referencia_id: string | null;
  valor_original: string;
  valor_normalizado: string;
  ativo: boolean;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaMensalRow {
  id: string;
  ano: number;
  mes: number;
  grupo: MetaMensalGrupo;
  valor: number;
  updated_by: string | null;
  updated_at: string;
}

export interface MetaSemanalRow {
  id: string;
  ano: number;
  mes: number;
  semana: number;
  grupo: MetaSemanalGrupo;
  valor: number;
  origem: "automatico" | "manual";
  updated_by: string | null;
  updated_at: string;
}

export interface MetaConsultorRow {
  id: string;
  ano: number;
  mes: number;
  quadro: MetaConsultorQuadro;
  consultor_id: string;
  meta_semanal: number;
  updated_by: string | null;
  updated_at: string;
}

export interface ProcessoTipoProdutoRegra {
  tipoPedido: string;
  label: string;
  grupo: string;
  produtos: string[];
}

export interface AcompanhamentoBootstrap {
  classificacoesProcesso: Record<AcompanhamentoOperadora, ProcessoTipoProdutoRegra[]>;
  role: AcompanhamentoRole;
  ano: number;
  mes: number;
  semanas: OperationalWeek[];
  consultoresAtivos: ConsultorAcompanhamento[];
  consultoresHistoricos: ConsultorAcompanhamento[];
  tiposPedido: TipoPedidoCatalogo[];
  grupos: AcompanhamentoGrupo[];
  vinculosTipo: TipoPedidoVinculo[];
  statusManuais: ManualStatusOption[];
  statusRobo: RobotStatusOption[];
  etapasPipeline: PipelineStageOption[];
  quadros: AcompanhamentoQuadro[];
  regrasQuadros: AcompanhamentoQuadroRegra[];
  metasMensais: MetaMensalRow[];
  metasSemanais: MetaSemanalRow[];
  metasConsultores: MetaConsultorRow[];
}
