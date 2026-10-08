import test from 'node:test';
import assert from 'node:assert/strict';
import {
  firstActiveCommercialDestination,
  firstActiveDestinationForFunnel,
  nextActiveCommercialDestination,
  isDestinationActive,
  activeStagesFor,
  type PipelineFunil,
  type PipelineEtapa,
} from './pipeline-structure.ts';

const funis: PipelineFunil[] = [
  { id: 'prospeccao', nome: 'Prospecção', ordem: 1, ativo: false, participa_fluxo_comercial: true },
  { id: 'followup', nome: 'Follow Up', ordem: 2, ativo: false, participa_fluxo_comercial: true },
  { id: 'processos_bko', nome: 'Processos BKO', ordem: 3, ativo: true, participa_fluxo_comercial: true },
  { id: 'assinatura', nome: 'Assinatura', ordem: 4, ativo: true, participa_fluxo_comercial: true },
  { id: 'suporte', nome: 'Suporte', ordem: 5, ativo: true, participa_fluxo_comercial: false },
];

const etapas: PipelineEtapa[] = [
  { id: 'bko-pendente', funil_id: 'processos_bko', nome: 'Pendente Consultor', cor: 'warning', ordem: 21, ativo: false },
  { id: 'bko-apoio', funil_id: 'processos_bko', nome: 'Apoio Gestão', cor: 'info', ordem: 22, ativo: true },
  { id: 'a-aguardando', funil_id: 'assinatura', nome: 'Aguardando Assinatura', cor: 'warning', ordem: 29, ativo: true },
  { id: 's-espera', funil_id: 'suporte', nome: 'Suportes em Espera', cor: 'warning', ordem: 42, ativo: true },
];

test('nova venda cai no primeiro funil comercial e primeira etapa ativos', () => {
  assert.deepEqual(firstActiveCommercialDestination(funis, etapas), {
    funilId: 'processos_bko',
    etapaId: 'bko-apoio',
  });
});

test('suporte nunca é usado como fallback comercial', () => {
  const semComercial = funis.map((f) =>
    f.participa_fluxo_comercial ? { ...f, ativo: false } : f,
  );
  assert.equal(firstActiveCommercialDestination(semComercial, etapas), null);
});

test('avanço pula funis inativos e usa primeira etapa ativa do próximo funil', () => {
  assert.deepEqual(nextActiveCommercialDestination('prospeccao', funis, etapas), {
    funilId: 'processos_bko',
    etapaId: 'bko-apoio',
  });
});

test('ação nominal para Assinatura usa a primeira etapa ativa de Assinatura', () => {
  assert.deepEqual(firstActiveDestinationForFunnel('assinatura', funis, etapas), {
    funilId: 'assinatura',
    etapaId: 'a-aguardando',
  });
});

test('ação nominal não usa funil inativo', () => {
  assert.equal(firstActiveDestinationForFunnel('followup', funis, etapas), null);
});

test('destino exige funil e etapa ativos e correspondentes', () => {
  assert.equal(isDestinationActive('processos_bko', 'bko-apoio', funis, etapas), true);
  assert.equal(isDestinationActive('processos_bko', 'bko-pendente', funis, etapas), false);
  assert.equal(isDestinationActive('assinatura', 'bko-apoio', funis, etapas), false);
});

test('etapas ativas são ordenadas por ordem', () => {
  const foraDeOrdem: PipelineEtapa[] = [
    { id: 'b', funil_id: 'assinatura', nome: 'B', cor: 'info', ordem: 31, ativo: true },
    { id: 'a', funil_id: 'assinatura', nome: 'A', cor: 'info', ordem: 30, ativo: true },
    { id: 'x', funil_id: 'assinatura', nome: 'X', cor: 'info', ordem: 29, ativo: false },
  ];
  assert.deepEqual(activeStagesFor('assinatura', foraDeOrdem).map((e) => e.id), ['a', 'b']);
});
