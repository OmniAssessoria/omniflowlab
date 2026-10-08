from pathlib import Path

root = Path('.')
model = root / 'src/lib/pedido-nota-live.ts'
pdf = root / 'src/lib/pdf-nota-live.ts'
enhancer = root / 'src/lib/nota-cliente-enhancer.ts'

assert model.exists(), 'Camada canônica da Nota ao vivo não existe'
assert pdf.exists(), 'Gerador de PDF ao vivo não existe'
assert enhancer.exists(), 'Enhancer da Nota não existe'

model_text = model.read_text(encoding='utf-8')
pdf_text = pdf.read_text(encoding='utf-8')
enhancer_text = enhancer.read_text(encoding='utf-8')

for trecho in (
    'fetchPedidoNotaLive',
    'formatPedidoNotaText',
    'getVendaIdFromLocation',
    'venda_linhas',
    'venda_linha_doadores',
    'venda_observacoes',
    'venda_documentos',
    'pipeline_funis',
    'pipeline_etapas',
    'possui_bonus',
    'bonus_gb',
    'tipo_produto',
):
    assert trecho in model_text, f'Modelo canônico não contém requisito: {trecho}'

for trecho in (
    'gerarNotaLivePDF',
    'PedidoNotaLive',
    'autoTable',
    'bonus',
    'tipoProduto',
    'valorMensal',
):
    assert trecho in pdf_text, f'PDF ao vivo não contém requisito: {trecho}'

for trecho in (
    'fetchPedidoNotaLive',
    'formatPedidoNotaText',
    'gerarNotaLivePDF',
    'Nota PDF',
    'Gerar PDF',
    'PDF preview',
    'Pré-visualizar',
    'postgres_changes',
    'data-omni-live-note-summary',
):
    assert trecho in enhancer_text, f'Enhancer não contém requisito: {trecho}'

assert 'grabBodyMetric' not in enhancer_text, 'Enhancer ainda depende de reconstrução da nota a partir do texto da tela'
assert 'grabCurrency' not in enhancer_text, 'Enhancer ainda depende de reconstrução do valor a partir do DOM'

print('OK: Nota do Pedido fiel e PDF canônico validados')
