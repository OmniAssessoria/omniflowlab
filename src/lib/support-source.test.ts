import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

test('enviar suporte não move o pedido nem pede etapa de suporte', () => {
  const venda = source('src/routes/_shell.vendas.$id.tsx');
  const inicio = venda.indexOf('async function confirmarSuporte()');
  const fim = venda.indexOf('\n\n\n  return (', inicio);
  assert.notEqual(inicio, -1, 'confirmarSuporte deve existir');
  const bloco = venda.slice(inicio, fim === -1 ? inicio + 2000 : fim);
  assert.equal(bloco.includes('moveVenda('), false, 'confirmarSuporte não pode mover a venda');
  assert.equal(venda.includes('Etapa no Suporte'), false, 'modal não deve pedir etapa de suporte');
  assert.equal(
    venda.includes('será movido para o funil Suporte'),
    false,
    'modal não pode informar que o pedido será movido para o funil Suporte',
  );
  assert.equal(
    venda.includes('permanecerá no funil e na etapa atuais'),
    true,
    'modal deve informar claramente que o pedido permanece no fluxo comercial atual',
  );
});

test('pipeline de suporte usa canal realtime próprio para não conflitar com o hook do PipelinePage', () => {
  const supportPipeline = source('src/components/support-pipeline.tsx');
  const pipelineHook = source('src/hooks/use-pipeline-structure.ts');
  assert.equal(supportPipeline.includes('usePipelineStructure'), true);
  assert.equal(
    supportPipeline.includes('usePipelineStructure("support-pipeline-structure-live")'),
    true,
    'SupportPipeline deve usar um tópico realtime próprio',
  );
  assert.equal(
    pipelineHook.includes("channelName = 'pipeline-structure-live'"),
    true,
    'hook deve aceitar nome de canal por consumidor',
  );
  assert.equal(
    pipelineHook.includes('.channel(channelName)'),
    true,
    'hook deve assinar o tópico informado pelo consumidor',
  );
  assert.equal(supportPipeline.includes('from \"@/lib/mock-data\"'), false);
});

test('central BKO cria card em vez de assumir pedido', () => {
  const central = source('src/routes/_shell.suporte.central.tsx');
  assert.equal(central.includes('Criar card de atendimento'), true);
});

test('meus chamados mostra estado aguardando criação', () => {
  const chamados = source('src/routes/_shell.suporte.index.tsx');
  assert.equal(chamados.includes('Aguardando criação do atendimento'), true);
});

test('detalhe dá acesso claro ao pedido e permite reabrir', () => {
  const detalhe = source('src/routes/_shell.suporte.$id.tsx');
  assert.equal(detalhe.includes('Ver pedido completo'), true);
  assert.equal(detalhe.includes('Reabrir'), true);
});

test('sininho acompanha notificações em realtime', () => {
  const notificacoes = source('src/lib/notifications.tsx');
  const shell = source('src/components/app-shell.tsx');
  assert.equal(notificacoes.includes('postgres_changes'), true);
  assert.equal(notificacoes.includes('table: \"notificacoes\"'), true);
  assert.equal(shell.includes('suporte_solicitacao'), true);
  assert.equal(shell.includes('suporte_mensagem'), true);
});
