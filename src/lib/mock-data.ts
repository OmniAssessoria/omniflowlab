
// Tipos e constantes legados restaurados para estabilidade do sistema

export type FunilId = "prospeccao" | "followup" | "processos_bko" | "assinatura" | "suporte";
export type Operadora = "CLARO" | "VIVO";

export interface Cliente {
  id: string;
  razaoSocial: string;
  cnpj: string;
  ddd: string;
  contato: string;
  telefone: string;
  email: string;
  uf: string;
  operadoras: Operadora[];
  totalLinhas: number;
  receitaMensal: number;
}


export interface Etapa {
  id: string;
  nome: string;
  funil: FunilId;
  cor: "default" | "warning" | "destructive" | "omni" | "success" | "info";
  ordem: number;
}

export interface Venda {
  id: string;
  numero: string;
  clienteId: string;
  operadora: Operadora;
  mesRef: number;
  anoRef: number;
  funil: FunilId;
  etapaId: string;
  status: string;
  tipoPedido: string;
  tipoPedidos?: string[];
  produto: string;
  produtos?: string[];
  quantidadeLinhas: number;
  receita: number;
  consultorId: string;
  consultorColabId?: string;
  consultorNome?: string;
  clienteRazaoSocial: string;
  clienteCnpj: string;
  clienteUf?: string;
  clienteContato?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  dataRecebimento: string;
  dataAceite?: string;
  dataAtivacao?: string;
  dataPreenchimento?: string;
  dataEnvio?: string;
  dataInput?: string;
  dataEntrega?: string;
  dataPortabilidade?: string;
  criadoEm?: string;
  atualizadoEm?: string;
  bkoColabId?: string;
  bkoId?: string;
  proximaAcao: string;
  proximaAcaoData: string;
  diasNaEtapa: number;
  slaStatus: "ok" | "atencao" | "alerta" | "atrasado";
  prioridade: "baixa" | "media" | "alta" | "urgente";
  observacao?: string;
  temErro: boolean;
  temBiometria: boolean;
  statusBiometria: "" | "pendente" | "concluido" | "cancelado";
  notaModo: "auto" | "manual";
  notaManual?: string;
  statusPedido: "" | "ativado" | "cancelado" | "reprovado" | "prd_suporte";
  statusPedidoObs?: string;
  statusPedidoUserNome?: string;
  statusPedidoEm?: string;
  statusPedidoRoboNome?: string;
  statusPedidoRoboEm?: string;
  concluidoEm?: string;
  concluidoPor?: string;
  statusComercialId?: string;
  statusComercialNome?: string;
  statusComercialEm?: string;
  slaHorasAtual?: number;
  slaMetadeEm?: string;
  slaLimiteEm?: string;
  ativado100Em?: string;
  ativado100Por?: string;
}

// Legado/fallback: disponibilidade e nomes operacionais vêm de pipeline_funis no Supabase.
export const FUNIS: { id: FunilId; nome: string; cor: string; icone: string }[] = [
  { id: "prospeccao", nome: "Prospecção", cor: "slate", icone: "Search" },
  { id: "followup", nome: "Follow Up", cor: "amber", icone: "Clock" },
  { id: "processos_bko", nome: "Processos BKO", cor: "omni", icone: "Workflow" },
  { id: "assinatura", nome: "Assinatura", cor: "purple", icone: "PenTool" },
  { id: "suporte", nome: "Suporte", cor: "blue", icone: "LifeBuoy" },
];

// Legado/fallback: disponibilidade e nomes operacionais vêm de pipeline_etapas no Supabase.
export const ETAPAS: Etapa[] = [
  // Prospecção (10)
  { id: "p-aguardando", nome: "Aguardando Início", funil: "prospeccao", cor: "default", ordem: 1 },
  { id: "p-d1-lig", nome: "Dia 1 - Ligação", funil: "prospeccao", cor: "info", ordem: 2 },
  { id: "p-d2-lig", nome: "Dia 2 - Ligação", funil: "prospeccao", cor: "info", ordem: 3 },
  { id: "p-d2-wpp", nome: "Dia 2 - WhatsApp", funil: "prospeccao", cor: "info", ordem: 4 },
  { id: "p-d3-lig", nome: "Dia 3 - Ligação", funil: "prospeccao", cor: "info", ordem: 5 },
  { id: "p-d4-lig", nome: "Dia 4 - Ligação", funil: "prospeccao", cor: "info", ordem: 6 },
  { id: "p-d4-wpp", nome: "Dia 4 - WhatsApp", funil: "prospeccao", cor: "info", ordem: 7 },
  { id: "p-d5-lig", nome: "Dia 5 - Ligação", funil: "prospeccao", cor: "info", ordem: 8 },
  { id: "p-d5-declinio", nome: "Dia 5 - Declínio WhatsApp", funil: "prospeccao", cor: "destructive", ordem: 9 },
  { id: "p-proposta", nome: "Montar Proposta", funil: "prospeccao", cor: "warning", ordem: 10 },

  // Follow Up (10)
  { id: "f-proposta", nome: "Montar Proposta", funil: "followup", cor: "warning", ordem: 11 },
  { id: "f-troca", nome: "Troca de Carteira", funil: "followup", cor: "info", ordem: 12 },
  { id: "f-d1", nome: "Dia 1 - Follow Up", funil: "followup", cor: "info", ordem: 13 },
  { id: "f-d2", nome: "Dia 2 - Follow Up", funil: "followup", cor: "info", ordem: 14 },
  { id: "f-d3", nome: "Dia 3 - Follow Up", funil: "followup", cor: "info", ordem: 15 },
  { id: "f-d4-apoio", nome: "Dia 4 - Apoio Gestão", funil: "followup", cor: "warning", ordem: 16 },
  { id: "f-d5", nome: "Dia 5 - Follow Up", funil: "followup", cor: "info", ordem: 17 },
  { id: "f-d6", nome: "Dia 6 - Follow Up", funil: "followup", cor: "info", ordem: 18 },
  { id: "f-d7-declinio", nome: "Dia 7 - Declínio WhatsApp", funil: "followup", cor: "destructive", ordem: 19 },
  { id: "f-contrato", nome: "Preenchimento de Contrato", funil: "followup", cor: "info", ordem: 20 },

  // Processos BKO (8)
  { id: "bko-pendente", nome: "Pendente Consultor", funil: "processos_bko", cor: "warning", ordem: 21 },
  { id: "bko-apoio", nome: "Apoio Gestão", funil: "processos_bko", cor: "info", ordem: 22 },
  { id: "bko-troca", nome: "Troca de Carteira | Abertura de Caso", funil: "processos_bko", cor: "info", ordem: 23 },
  { id: "bko-montar", nome: "Montar Pedido", funil: "processos_bko", cor: "info", ordem: 24 },
  { id: "bko-suporte", nome: "Tratativa de Suporte", funil: "processos_bko", cor: "warning", ordem: 25 },
  { id: "bko-input", nome: "Tempo para Input", funil: "processos_bko", cor: "info", ordem: 26 },
  { id: "bko-enviado", nome: "Enviado para Preenchimento", funil: "processos_bko", cor: "info", ordem: 27 },
  { id: "bko-assinatura", nome: "Aguardando Assinatura", funil: "processos_bko", cor: "info", ordem: 28 },

  // Assinatura (13)
  { id: "a-aguardando", nome: "Aguardando Assinatura", funil: "assinatura", cor: "warning", ordem: 29 },
  { id: "a-reenvio", nome: "Aguardando Reenvio", funil: "assinatura", cor: "warning", ordem: 30 },
  { id: "a-correcao", nome: "Correção Cadastral", funil: "assinatura", cor: "warning", ordem: 31 },
  { id: "a-d1", nome: "Dia 1 - Assinatura", funil: "assinatura", cor: "info", ordem: 32 },
  { id: "a-d2", nome: "Dia 2 - Assinatura", funil: "assinatura", cor: "info", ordem: 33 },
  { id: "a-d3", nome: "Dia 3 - Assinatura", funil: "assinatura", cor: "info", ordem: 34 },
  { id: "a-d4", nome: "Dia 4 - Assinatura", funil: "assinatura", cor: "info", ordem: 35 },
  { id: "a-confirmar", nome: "AG Confirmar Assinatura", funil: "assinatura", cor: "info", ordem: 36 },
  { id: "a-biometria", nome: "Aguardando Biometria", funil: "assinatura", cor: "warning", ordem: 37 },
  { id: "a-tt", nome: "Aguardando Concluir TT", funil: "assinatura", cor: "warning", ordem: 38 },
  { id: "a-apoio", nome: "Apoio Gestão", funil: "assinatura", cor: "info", ordem: 39 },
  { id: "a-assinado", nome: "Contrato Assinado - Claro", funil: "assinatura", cor: "success", ordem: 40 },
  { id: "a-assinado-vivo", nome: "Contrato Assinado - Vivo", funil: "assinatura", cor: "success", ordem: 41 },

  // Suporte (12)
  { id: "s-espera", nome: "Suportes em Espera", funil: "suporte", cor: "warning", ordem: 42 },
  { id: "s-urgente", nome: "Urgente", funil: "suporte", cor: "destructive", ordem: 43 },
  { id: "s-prevendas", nome: "Pré Vendas", funil: "suporte", cor: "info", ordem: 44 },
  { id: "s-devolutiva", nome: "Devolutiva do Consultor", funil: "suporte", cor: "info", ordem: 45 },
  { id: "s-tratar", nome: "A Tratar", funil: "suporte", cor: "info", ordem: 46 },
  { id: "s-retorno-cliente", nome: "Aguardando Retorno Cliente", funil: "suporte", cor: "warning", ordem: 47 },
  { id: "s-conferencia", nome: "Conferência Agendada", funil: "suporte", cor: "info", ordem: 48 },
  { id: "s-retorno-omni", nome: "Aguardando Retorno OMNI/DATAVOXX", funil: "suporte", cor: "warning", ordem: 49 },
  { id: "s-retorno-interno", nome: "Aguardando Retorno Interno", funil: "suporte", cor: "warning", ordem: 50 },
  { id: "s-anatel", nome: "Aguardando Prazo Anatel/Operadora", funil: "suporte", cor: "warning", ordem: 51 },
  { id: "s-pendencia-comercial", nome: "Pendência Comercial", funil: "suporte", cor: "warning", ordem: 52 },
  { id: "s-concluido", nome: "Concluído", funil: "suporte", cor: "success", ordem: 53 },
];

/** Remapeia etapas legadas/órfãs para a etapa correta do mesmo funil (por funil + etapa, nunca por nome). */
const ETAPA_LEGADA_MAP: Record<string, string> = {
  "p-contato": "p-aguardando",
  "p-qualificacao": "p-d1-lig",
  "f-analise": "f-proposta",
  "f-biometria": "f-d1",
  "a-assinada": "a-assinado",
  "a-validacao": "a-confirmar",
  "s-atendimento": "s-tratar",
};

const PRIMEIRA_ETAPA_POR_FUNIL: Record<string, string> = {
  prospeccao: "p-aguardando",
  followup: "f-proposta",
  processos_bko: "bko-pendente",
  assinatura: "a-aguardando",
  suporte: "s-espera",
};

/** Normaliza funil+etapa de um pedido, sem apagar nada. */
export function normalizarEtapa(funil: string | null | undefined, etapaId: string | null | undefined) {
  const funilOk = funil && PRIMEIRA_ETAPA_POR_FUNIL[funil] ? funil : "prospeccao";
  const alvo = etapaId ? (ETAPA_LEGADA_MAP[etapaId] ?? etapaId) : "";
  const etapa = ETAPAS.find(e => e.id === alvo && e.funil === funilOk);
  return { funil: funilOk as FunilId, etapaId: etapa ? etapa.id : PRIMEIRA_ETAPA_POR_FUNIL[funilOk] };
}


export const MESES_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function getEtapa(id: string) {
  return ETAPAS.find(e => e.id === id);
}

// Fallbacks para dados que agora vêm do banco, mantidos para não quebrar componentes legados
export function getCliente(id: string): Cliente | undefined {
  return undefined;
}

export function getColaborador(id: string) {
  return COLABORADORES.find(c => c.id === id);
}

export const COLABORADORES: any[] = [
  { id: "imported", nome: "Importado / Outros", cor: "slate", iniciais: "IM" }
];

export function getColaboradorPorIniciais(nome: string) {
  return nome.split(/\s+/).slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase();
}


export const HISTORICO: any[] = [];
export const STATUS_CLARO: string[] = ["Pendente", "Em Análise", "Aprovado", "Reprovado", "Cancelado", "Ativado"];
export const STATUS_VIVO: string[] = ["Pendente", "Em Análise", "Aprovado", "Reprovado", "Cancelado", "Ativado"];


export function maskCpfCnpj(v: string) {
  v = v.replace(/\D/g, "");
  if (v.length <= 11) {
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d)/, "$1.$2");
    v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  } else {
    v = v.replace(/^(\d{2})(\d)/, "$1.$2");
    v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
    v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
  }
  return v;
}
