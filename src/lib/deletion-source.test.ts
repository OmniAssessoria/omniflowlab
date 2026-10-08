import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

test('exclusão de linha usa função confirmada no servidor e não delete direto sem confirmação', () => {
  const venda = source('src/routes/_shell.vendas.$id.tsx');
  assert.equal(
    venda.includes('deleteVendaLinha'),
    true,
    'a tela deve usar deleteVendaLinha para confirmar que a linha foi realmente excluída',
  );
  assert.equal(
    venda.includes('supabase.from("venda_linhas").delete()'),
    false,
    'a tela não deve fazer DELETE direto sem verificar linha afetada',
  );
});

test('pedido e cliente usam exclusão física definitiva', () => {
  const exclusao = source('src/lib/exclusao.functions.ts');
  assert.equal(
    exclusao.includes('excluir_venda_definitiva'),
    true,
    'deleteVenda deve chamar a RPC de exclusão definitiva da venda',
  );
  assert.equal(
    exclusao.includes('excluir_cliente_definitivo'),
    true,
    'deleteCliente deve chamar a RPC de exclusão definitiva do cliente',
  );
});

test('migração de exclusão definitiva existe e protege dependências', () => {
  const path = 'supabase/migrations/20260915030000_hard_delete_flow.sql';
  assert.equal(existsSync(path), true, 'a migração de exclusão definitiva deve existir');
  if (!existsSync(path)) return;

  const migration = source(path);
  assert.equal(migration.includes('excluir_linha_venda'), true);
  assert.equal(migration.includes('excluir_venda_definitiva'), true);
  assert.equal(migration.includes('excluir_cliente_definitivo'), true);
  assert.equal(migration.includes('audit_logs'), true, 'a exclusão física deve preservar auditoria fora da entidade excluída');
});

test('validação da linha converte o enum funil para texto antes de coalesce', () => {
  const migration = source('supabase/migrations/20260915030000_hard_delete_flow.sql');
  assert.equal(
    migration.includes("coalesce(v_venda.funil::text, '')"),
    true,
    'funil_enum precisa ser convertido para text antes de comparar com string vazia',
  );
});

test('tela de clientes comunica que cliente e pedidos são excluídos definitivamente', () => {
  const clientes = source('src/components/clientes-pedidos.tsx');
  assert.equal(
    clientes.includes('excluídos das áreas operacionais do sistema'),
    false,
    'a interface não deve mais descrever exclusão lógica',
  );
  assert.equal(
    clientes.includes('A exclusão é lógica'),
    false,
    'o modal não pode afirmar que a exclusão continua lógica',
  );
  assert.equal(
    clientes.includes('excluídos definitivamente do sistema'),
    true,
    'a interface deve avisar que a exclusão é definitiva',
  );
  assert.equal(
    clientes.includes('registro separado de auditoria'),
    true,
    'o modal deve explicar que apenas a auditoria separada é preservada',
  );
});
