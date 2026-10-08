-- Remove a implementação experimental de Gestão de Vendas criada a partir da planilha.
-- Mantém intactos vendas, clientes, robô, logs, status, SLA e demais módulos existentes.

drop view if exists public.vw_gestao_vendas_base;

drop table if exists public.gestao_venda_classificacao_override cascade;
drop table if exists public.gestao_cancelamentos cascade;
drop table if exists public.gestao_cancelamento_motivos cascade;
drop table if exists public.gestao_metas cascade;
drop table if exists public.gestao_status_classificacao cascade;
