import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canMoveSupportCard,
  isSupportStage,
  reopenTarget,
  supportStatusLabel,
} from './support-flow.ts';

test('BKO e Admin podem movimentar card de suporte', () => {
  assert.equal(canMoveSupportCard('bko'), true);
  assert.equal(canMoveSupportCard('admin'), true);
  assert.equal(canMoveSupportCard('consultor'), false);
  assert.equal(canMoveSupportCard('gestor'), false);
  assert.equal(canMoveSupportCard('suporte'), false);
});

test('reabertura com card usa a primeira etapa ativa informada', () => {
  assert.deepEqual(reopenTarget(true, 's-tratar'), {
    status: 'em_atendimento',
    etapaSuporteId: 's-tratar',
  });
});

test('reabertura com card sem etapa ativa não inventa destino legado', () => {
  assert.deepEqual(reopenTarget(true, null), {
    status: 'em_atendimento',
    etapaSuporteId: null,
  });
});

test('reabertura sem card volta para aguardando criação', () => {
  assert.deepEqual(reopenTarget(false, 's-tratar'), {
    status: 'aguardando_criacao',
    etapaSuporteId: null,
  });
});

test('status pendente usa o texto aprovado', () => {
  assert.equal(
    supportStatusLabel('aguardando_criacao', false),
    'Aguardando criação do atendimento',
  );
  assert.equal(supportStatusLabel('concluido', false), 'Concluído');
});

test('reconhece somente etapas técnicas do funil suporte', () => {
  assert.equal(isSupportStage('s-espera'), true);
  assert.equal(isSupportStage('s-concluido'), true);
  assert.equal(isSupportStage('bko-pendente'), false);
  assert.equal(isSupportStage('p-d1-lig'), false);
});
