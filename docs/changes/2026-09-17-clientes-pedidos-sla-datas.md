# Clientes / Pedidos — SLA, filtros e datas de conclusão

Alterações aprovadas em 17/09/2026:

- Filtro SLA: `Todos os prazos`, `No prazo`, `Atenção`, `Fora do prazo`; sem opção `Sem SLA`.
- Tabela Pedidos: remove visualmente BKO, Etapa, Ciclo e Erro; mantém os filtros operacionais correspondentes quando aplicável.
- Filtro Funil: usa somente funis ativos que participam do fluxo comercial, carregados de `pipeline_funis`.
- Aba Clientes: remove filtros Situação, UF e DDD, inclusive da lógica da consulta.
- Conclusão de pedido: exige Recebimento, Preenchimento, Aceite, Input, Ativação e Portabilidade; Entrega/Instalação não é obrigatória e pode ser preenchida depois por BKO/Admin.

A validação de datas existe tanto na interface quanto em `pipeline_concluir_venda`, sendo o banco a camada autoritativa.
