export type PipelineFunilId =
  | 'prospeccao'
  | 'followup'
  | 'processos_bko'
  | 'assinatura'
  | 'suporte';

export interface PipelineFunil {
  id: PipelineFunilId;
  nome: string;
  ordem: number;
  ativo: boolean;
  participa_fluxo_comercial: boolean;
}

export interface PipelineEtapa {
  id: string;
  funil_id: PipelineFunilId;
  nome: string;
  cor: string;
  ordem: number;
  ordem_exibicao?: number;
  ativo: boolean;
}

export interface PipelineDestination {
  funilId: PipelineFunilId;
  etapaId: string;
}

export function activeFunnels(funis: PipelineFunil[]) {
  return funis.filter((f) => f.ativo).sort((a, b) => a.ordem - b.ordem);
}

export function activeStagesFor(funilId: string, etapas: PipelineEtapa[]) {
  return etapas
    .filter((e) => e.funil_id === funilId && e.ativo)
    .sort((a, b) => a.ordem - b.ordem);
}

export function displayStagesFor(funilId: string, etapas: PipelineEtapa[]) {
  return etapas
    .filter((e) => e.funil_id === funilId && e.ativo)
    .sort((a, b) =>
      (a.ordem_exibicao ?? a.ordem) - (b.ordem_exibicao ?? b.ordem)
      || a.ordem - b.ordem,
    );
}

export function firstActiveDestinationForFunnel(
  funilId: string,
  funis: PipelineFunil[],
  etapas: PipelineEtapa[],
): PipelineDestination | null {
  const funil = funis.find((f) => f.id === funilId && f.ativo);
  if (!funil) return null;
  const etapa = activeStagesFor(funilId, etapas)[0];
  return etapa ? { funilId: funil.id, etapaId: etapa.id } : null;
}

export function firstActiveCommercialDestination(
  funis: PipelineFunil[],
  etapas: PipelineEtapa[],
): PipelineDestination | null {
  const comerciais = funis
    .filter((f) => f.ativo && f.participa_fluxo_comercial)
    .sort((a, b) => a.ordem - b.ordem);

  for (const funil of comerciais) {
    const destino = firstActiveDestinationForFunnel(funil.id, funis, etapas);
    if (destino) return destino;
  }

  return null;
}

export function nextActiveCommercialDestination(
  currentFunilId: string,
  funis: PipelineFunil[],
  etapas: PipelineEtapa[],
): PipelineDestination | null {
  const current = funis.find((f) => f.id === currentFunilId);
  if (!current) return null;

  const posteriores = funis
    .filter(
      (f) =>
        f.ativo &&
        f.participa_fluxo_comercial &&
        f.ordem > current.ordem,
    )
    .sort((a, b) => a.ordem - b.ordem);

  for (const funil of posteriores) {
    const destino = firstActiveDestinationForFunnel(funil.id, funis, etapas);
    if (destino) return destino;
  }

  return null;
}

export function isDestinationActive(
  funilId: string,
  etapaId: string,
  funis: PipelineFunil[],
  etapas: PipelineEtapa[],
) {
  const funil = funis.find((f) => f.id === funilId && f.ativo);
  const etapa = etapas.find(
    (e) => e.id === etapaId && e.funil_id === funilId && e.ativo,
  );
  return Boolean(funil && etapa);
}
