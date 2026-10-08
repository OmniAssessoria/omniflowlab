import { isStageAllowedForOperadora } from "./biometria-operadora";
import type { PipelineEtapa, PipelineFunil, PipelineFunilId } from "./pipeline-structure";

export type CommercialMovementRole = "admin" | "gestor" | "consultor" | "bko" | "suporte" | string;

export interface CommercialDestinationOption {
  funilId: PipelineFunilId;
  funilNome: string;
  funilOrdem: number;
  etapaId: string;
  etapaNome: string;
  etapaOrdem: number;
}

export interface AvailableCommercialDestinationsInput {
  funis: PipelineFunil[];
  etapas: PipelineEtapa[];
  visibleFunilIds: string[];
  currentFunilId: string;
  currentEtapaId: string;
  role?: CommercialMovementRole | null;
  operadora?: string | null;
}

export const COMMERCIAL_COMPLETION_SOURCE_STAGE_IDS = ["a-assinado"] as const;
export const CONSULTOR_PROCESSOS_BKO_STAGE_IDS = ["bko-pendente", "bko-montar", "bko-apoio", "bko-troca"] as const;
export const CONSULTOR_ASSINATURA_STAGE_IDS = ["a-d1", "a-d2", "a-d3", "a-d4", "a-apoio"] as const;

const COMMERCIAL_MOVEMENT_ROLES = new Set(["admin", "gestor", "consultor", "bko"]);
const COMMERCIAL_COMPLETION_ROLES = new Set(["admin", "bko"]);
const CONSULTOR_PROCESSOS_BKO_STAGE_SET = new Set<string>(CONSULTOR_PROCESSOS_BKO_STAGE_IDS);
const CONSULTOR_ASSINATURA_STAGE_SET = new Set<string>(CONSULTOR_ASSINATURA_STAGE_IDS);

export function canMoveCommercialOrder(role: CommercialMovementRole | null | undefined) {
  return Boolean(role && COMMERCIAL_MOVEMENT_ROLES.has(role));
}

export function availableCommercialDestinations({
  funis,
  etapas,
  visibleFunilIds,
  currentFunilId,
  currentEtapaId,
  role,
  operadora,
}: AvailableCommercialDestinationsInput): CommercialDestinationOption[] {
  const visible = new Set(visibleFunilIds);
  const consultor = role === "consultor";

  return funis
    .filter((funil) => funil.ativo && funil.participa_fluxo_comercial && visible.has(funil.id))
    .sort((a, b) => a.ordem - b.ordem)
    .flatMap((funil) =>
      etapas
        .filter((etapa) => {
          if (!etapa.ativo || etapa.funil_id !== funil.id) return false;
          if (!isStageAllowedForOperadora(etapa.id, operadora)) return false;
          if (funil.id === currentFunilId && etapa.id === currentEtapaId) return false;

          if (etapa.id === "a-assinado" && role !== "admin" && role !== "bko") return false;
          if (!consultor) return true;

          if (funil.id === "processos_bko") {
            return CONSULTOR_PROCESSOS_BKO_STAGE_SET.has(etapa.id);
          }

          if (funil.id === "assinatura") {
            return CONSULTOR_ASSINATURA_STAGE_SET.has(etapa.id);
          }

          return false;
        })
        .sort((a, b) => a.ordem - b.ordem)
        .map((etapa) => ({
          funilId: funil.id,
          funilNome: funil.nome,
          funilOrdem: funil.ordem,
          etapaId: etapa.id,
          etapaNome: etapa.nome,
          etapaOrdem: etapa.ordem,
        })),
    );
}

export function canConcludeCommercialOrder(
  role: CommercialMovementRole | null | undefined,
  etapaId: string | null | undefined,
  concluidoEm: string | null | undefined,
) {
  if (!role || !COMMERCIAL_COMPLETION_ROLES.has(role) || concluidoEm) return false;
  return COMMERCIAL_COMPLETION_SOURCE_STAGE_IDS.includes(
    etapaId as (typeof COMMERCIAL_COMPLETION_SOURCE_STAGE_IDS)[number],
  );
}
