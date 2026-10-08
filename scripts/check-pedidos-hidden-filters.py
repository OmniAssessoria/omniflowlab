from pathlib import Path

helper = Path('src/components/pedidos-filter-visibility.tsx').read_text(encoding='utf-8')
global_route = Path('src/routes/_shell.clientes.index.tsx').read_text(encoding='utf-8')
meus_route = Path('src/routes/_shell.meus-clientes.tsx').read_text(encoding='utf-8')
rules = Path('src/lib/clientes-pedidos-rules.ts').read_text(encoding='utf-8')

for label in ('BKO', 'BIOMETRIA', 'ERRO'):
    assert label in helper, f'Regra de ocultação de {label} ausente'

assert 'shouldHidePedidosFilter' in helper
assert 'input[placeholder="Cliente, nº do pedido, CNPJ, telefone…"]' in helper
assert '<PedidosFilterVisibility />' in global_route
assert '<PedidosFilterVisibility />' in meus_route

# A coluna Biometria da tabela continua disponível; somente o filtro some da interface.
assert '"Biometria"' in rules

print('OK: BKO, Biometria e Erro ficam ocultos nos filtros de Pedidos, mantendo a coluna Biometria.')
