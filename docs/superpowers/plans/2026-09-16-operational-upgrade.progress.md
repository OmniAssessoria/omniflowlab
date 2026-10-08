# Progresso — Evolução Operacional 2026-09-16

- [x] Especificação aprovada
- [x] Plano aprovado
- [x] Branch isolada criada
- [x] Teste RED do semáforo SLA criado
- [x] Implementação do helper SLA
- [x] Migração Status Comercial + Operadora + SLA
- [x] UI Status Comercial/Ativado 100%
- [x] Encerramento definitivo e permissões
- [x] Restrição Consultor no Processos BKO
- [x] Bônus VIVO e doadores por linha
- [x] Suporte avulso
- [x] Informações/documentos do suporte
- [x] Configurações > SLA
- [x] Indicadores/filtros SLA
- [x] Permissões operacionais de Admin no suporte
- [x] Hardening de RPCs SECURITY DEFINER e índices do upgrade
- [x] Otimização das políticas RLS novas do upgrade
- [x] Regressões e validação final
- [x] PR final preparado
- [ ] Merge na `main` — aguardando autorização explícita

## Estado atual

- Supabase alvo: `jgruzxaibvjejkjjgxcu`.
- Migrations operacionais aplicadas no banco e versionadas nesta branch.
- Carga Status Comercial por operadora comparada com o banco real: zero divergências.
- Pipeline exibe indicador SLA em todos os cards, inclusive Verde e Sem SLA.
- Pedido comercial concluído é definitivo e não possui fluxo de reabertura.
- Reabertura permanece somente no fluxo de atendimento de suporte, conforme regra funcional.
- Permissões operacionais do suporte alinhadas para BKO/Admin no frontend e backend.
- RPCs novas sem execução anônima desnecessária; funções internas de trigger não são expostas ao cliente.
- Índices e políticas RLS novas do upgrade revisados e otimizados.
- Artefatos temporários da implementação removidos; alterações cosméticas fora do escopo revertidas.
- HEAD validado com `Check Operational Upgrade`, `Check Pipeline Structure` e `Check Observacao Tags` em sucesso.
- PR #16 permanece em modo draft apenas para impedir integração acidental; implementação está pronta para decisão de merge.
