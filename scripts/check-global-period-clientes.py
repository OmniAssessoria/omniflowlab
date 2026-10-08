from pathlib import Path

helper = Path('src/components/global-period-filters-visibility.tsx')
global_route = Path('src/routes/_shell.clientes.index.tsx')
meus_route = Path('src/routes/_shell.meus-clientes.tsx')
app_shell = Path('src/components/app-shell.tsx')

assert helper.exists(), 'Componente de ocultação do período global ainda não existe'
helper_source = helper.read_text(encoding='utf-8')
global_source = global_route.read_text(encoding='utf-8')
meus_source = meus_route.read_text(encoding='utf-8')
app_shell_source = app_shell.read_text(encoding='utf-8')

assert 'GlobalPeriodFiltersVisibility' in helper_source
assert '<GlobalPeriodFiltersVisibility />' in global_source
assert '<GlobalPeriodFiltersVisibility />' in meus_source

# Os seletores continuam no AppShell para as demais páginas; somente Clientes/Pedidos os oculta.
assert 'MESES_LONG.map' in app_shell_source
assert 'setMesRef' in app_shell_source
assert 'setAnoRef' in app_shell_source

print('OK: período global oculto apenas nas áreas Clientes/Pedidos e Meus Clientes/Pedidos.')
