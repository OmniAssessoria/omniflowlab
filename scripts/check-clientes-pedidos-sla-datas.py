from pathlib import Path

source = Path('src/components/clientes-pedidos.tsx').read_text(encoding='utf-8')
lifecycle = Path('src/components/venda-lifecycle-actions.tsx').read_text(encoding='utf-8')
migration = Path('supabase/migrations/20260925142000_make_portability_and_installation_dates_optional_for_completion.sql').read_text(encoding='utf-8')

assert 'SLA_FILTER_OPTIONS' in source
assert 'visibleCommercialFunnels(pipelineFunis)' in source
assert '["todos", "Todas as cores"]' not in source
assert 'slaFiltro === "sem_sla"' not in source
assert '["prospeccao", "Prospecção"]' not in source
assert 'setSituacao' not in source
assert 'const [uf, setUf] = useState("");' in source  # cadastro de cliente continua tendo UF
assert '<FilterSelect label="Situação"' not in source
assert 'placeholder="UF" className="w-20' not in source
assert 'placeholder="DDD" className="w-20' not in source
assert 'pedidoTableColumns(comissoesVisible)' in source
assert '<TableCell className="text-xs whitespace-nowrap max-w-[140px] truncate">{p.bko_nome' not in source
assert '<TableCell className="text-xs whitespace-nowrap">{p.etapa_id}</TableCell>' not in source
assert '<ErroBadge' not in source

assert 'missingRequiredCompletionDates' in lifecycle
required_block = migration.split('if v_venda.data_recebimento is null')[1].split('if cardinality(v_datas_faltantes) > 0')[0]
for column in ('data_recebimento', 'data_preenchimento', 'data_aceite', 'data_input', 'data_ativacao'):
    assert f'v_venda.{column} is null' in required_block
assert 'data_portabilidade is null' not in required_block
assert 'data_entrega is null' not in required_block

print('OK: SLA, funil, filtros, tabela e conclusão com portabilidade/entrega opcionais validados.')
