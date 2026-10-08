export type AuditOrigin =
  | "sistema"
  | "pedido"
  | "status_comercial"
  | "suporte"
  | "importacao"
  | "chamado_sla";

const ORIGIN_LABEL: Record<AuditOrigin, string> = {
  sistema: "Sistema",
  pedido: "Pedido",
  status_comercial: "Status Comercial",
  suporte: "Suporte",
  importacao: "Importação",
  chamado_sla: "SLA de Chamado",
};

const ACTION_LABELS: Record<string, string> = {
  login: "Login realizado",
  login_fail: "Falha de login",
  user_create: "Usuário criado",
  user_reactivate: "Usuário reativado",
  user_update: "Usuário atualizado",
  user_password_reset: "Senha redefinida",
  password_reset: "Senha redefinida",
  password_changed: "Senha alterada",
  pipeline_funil_ativacao: "Funil ativado",
  pipeline_funil_desativacao: "Funil desativado",
  pipeline_etapa_ativacao: "Etapa do Pipeline ativada",
  pipeline_etapa_desativacao: "Etapa do Pipeline desativada",
  pipeline_etapa_renomeacao: "Etapa do Pipeline renomeada",
  exclusao_definitiva: "Exclusão definitiva",
  suporte_avulso_exclusao: "Suporte avulso excluído",
  status_comercial_criado: "Status Comercial criado",
  status_comercial_alterado: "Status Comercial alterado",
  status_comercial_excluido: "Status Comercial excluído",
  sla_status_criado: "SLA Comercial criado",
  sla_status_alterado: "SLA Comercial alterado",
  sla_status_excluido: "SLA Comercial excluído",
  venda_alterada: "Pedido alterado",
  venda_movida: "Pedido movimentado",
  venda_concluida: "Pedido concluído",
  venda_criada: "Pedido criado",
  importacao: "Importação realizada",
  sla_chamado_alterado: "SLA do chamado alterado",
};

export function auditOriginLabel(origin: AuditOrigin): string {
  return ORIGIN_LABEL[origin];
}

export function auditActionLabel(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;
  const normalized = action.replace(/[_-]+/g, " ").trim();
  if (!normalized) return "Ação";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
