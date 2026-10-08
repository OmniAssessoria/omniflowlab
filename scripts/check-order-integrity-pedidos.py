from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
status = (ROOT / "src/components/status-comercial-pedido.tsx").read_text(encoding="utf-8")
pedidos = (ROOT / "src/components/clientes-pedidos.tsx").read_text(encoding="utf-8")
migration = (ROOT / "supabase/migrations/20260917024500_recalc_venda_totais_from_linhas.sql").read_text(encoding="utf-8").lower()

# ATIVADO 100% faz preflight no frontend das mesmas sete datas protegidas pelo banco.
assert 'getMissingAtivado100Dates' in status, "Preflight do ATIVADO 100% não está ligado à UI"
for campo in (
    "data_recebimento",
    "data_preenchimento",
    "data_aceite",
    "data_input",
    "data_ativacao",
    "data_portabilidade",
    "data_entrega",
):
    assert campo in status, f"Data obrigatória ausente no preflight: {campo}"
assert 'ATIVADO_100_DATAS_PENDENTES:' in status, "UI não reutiliza o contrato de erro das datas pendentes"

# Totais da venda são derivados das linhas, com INSERT/UPDATE/DELETE e backfill.
assert 'recalc_venda_totais_from_linhas' in migration, "Migration não possui função de rollup da venda"
assert 'after insert or delete or update of venda_id, valor_mensal, status' in migration, "Trigger não cobre INSERT/UPDATE/DELETE relevantes"
assert 'quantidade_linhas' in migration and 'valor =' in migration, "Rollup não atualiza quantidade e valor"
assert "not in ('cancelada', 'cancelado')" in migration, "Linhas canceladas não estão excluídas dos totais"
assert 'left join public.venda_linhas' in migration, "Migration não possui backfill das vendas existentes"

# Pedidos prioriza SLA e usa linhas reais agrupadas por Tipo de Pedido + Produto.
assert 'pedidoTableColumns(comissoesVisible)' in pedidos, "Tabela de Pedidos não usa o contrato central de colunas"
assert '<SlaPedidoBadge' in pedidos, "Linha da tabela não exibe o indicador de SLA"
assert 'SLA Vencido' in pedidos and 'slaHours ? ` · ${slaHours}h`' in pedidos, "SLA não está suficientemente evidente"
assert 'agruparPedidosPorTipoProduto' in pedidos, "Pedidos não estão agrupando as linhas por Tipo de Pedido + Produto"
assert 'grupo_tipo_pedido' in pedidos, "Tipo de Pedido agrupado não está exibido"
assert 'grupo_produto' in pedidos, "Tipo de Produto agrupado não está exibido"
assert 'grupo_quantidade' in pedidos, "Quantidade agrupada não está exibida"
assert 'grupo_valor' in pedidos, "Valor agrupado não está exibido"
assert 'dataReferenciaFiltroMes' in pedidos and 'AGUARDANDO ENTREGA' in pedidos, "Filtro mensal operacional não está protegido"
assert '<TableCell><ResultadoBadge' not in pedidos, "Resultado legado ainda aparece na tabela"
assert 'max-w-[140px] truncate">{p.status ?? "—"}' not in pedidos, "Status legado ainda aparece na tabela"
assert '>{p.tipo_pedido ?? "—"}</TableCell>' not in pedidos, "Tipo legado da venda ainda aparece diretamente na tabela"
assert '>{p.produto ?? "—"}</TableCell>' not in pedidos, "Produto legado da venda ainda aparece diretamente na tabela"

print("Contrato de integridade de pedidos e SLA em destaque OK")
