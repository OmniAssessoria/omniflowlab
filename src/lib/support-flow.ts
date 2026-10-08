export const SUPPORT_STAGE_IDS = new Set([
  's-espera',
  's-urgente',
  's-prevendas',
  's-devolutiva',
  's-tratar',
  's-retorno-cliente',
  's-conferencia',
  's-retorno-omni',
  's-retorno-interno',
  's-anatel',
  's-pendencia-comercial',
  's-concluido',
]);

export type SupportRequestStatus = 'aguardando_criacao' | 'em_atendimento' | 'concluido';

export function canMoveSupportCard(role: string | null | undefined) {
  const normalized = String(role ?? '').trim().toLowerCase();
  return normalized === 'bko' || normalized === 'admin';
}

export function isSupportStage(stageId: string | null | undefined) {
  return SUPPORT_STAGE_IDS.has(String(stageId ?? ''));
}

export function reopenTarget(
  hasTicket: boolean,
  firstActiveSupportStageId: string | null,
): {
  status: SupportRequestStatus;
  etapaSuporteId: string | null;
} {
  if (!hasTicket) {
    return { status: 'aguardando_criacao', etapaSuporteId: null };
  }
  return {
    status: 'em_atendimento',
    etapaSuporteId: firstActiveSupportStageId,
  };
}

export function supportStatusLabel(status: string | null | undefined, hasTicket: boolean) {
  if (status === 'concluido') return 'Concluído';
  if (!hasTicket || status === 'aguardando_criacao') return 'Aguardando criação do atendimento';
  return 'Em atendimento';
}
