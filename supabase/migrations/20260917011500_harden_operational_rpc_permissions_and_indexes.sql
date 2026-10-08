-- Evolução Operacional 2026-09-16
-- Endurece permissões das RPCs SECURITY DEFINER expostas pelo upgrade
-- e corrige índices relacionados às novas estruturas operacionais.

-- RPCs chamadas pelo app: autenticados podem executar, anon/public não.
revoke execute on function public.assumir_atendimento_suporte(uuid) from public, anon;
grant execute on function public.assumir_atendimento_suporte(uuid) to authenticated;

revoke execute on function public.criar_suporte_avulso(text,text,text,text,text,text) from public, anon;
grant execute on function public.criar_suporte_avulso(text,text,text,text,text,text) to authenticated;

revoke execute on function public.excluir_documento_suporte(uuid) from public, anon;
grant execute on function public.excluir_documento_suporte(uuid) to authenticated;

revoke execute on function public.registrar_documento_suporte(uuid,uuid,text,text,text,text,bigint) from public, anon;
grant execute on function public.registrar_documento_suporte(uuid,uuid,text,text,text,text,bigint) to authenticated;

revoke execute on function public.suporte_usuario_tem_acesso(uuid) from public, anon;
grant execute on function public.suporte_usuario_tem_acesso(uuid) to authenticated;

-- RPCs administrativas legadas que também estavam executáveis anonimamente.
revoke execute on function public.excluir_cliente_definitivo(uuid,text) from public, anon;
grant execute on function public.excluir_cliente_definitivo(uuid,text) to authenticated;

revoke execute on function public.excluir_linha_venda(uuid) from public, anon;
grant execute on function public.excluir_linha_venda(uuid) to authenticated;

revoke execute on function public.excluir_venda_definitiva(uuid,text) from public, anon;
grant execute on function public.excluir_venda_definitiva(uuid,text) to authenticated;

-- Funções de trigger não são RPCs de aplicação.
revoke execute on function public.notify_suporte_mensagem_created() from public, anon, authenticated;
revoke execute on function public.notify_suporte_solicitacao_created() from public, anon, authenticated;

-- O upgrade criou um índice equivalente a um já existente; preservar o índice histórico.
drop index if exists public.idx_venda_status_hist_venda_created;

-- Cobrir FKs novas do upgrade operacional.
create index if not exists idx_venda_linha_doadores_created_by
  on public.venda_linha_doadores(created_by);
create index if not exists idx_suporte_informacoes_created_by
  on public.suporte_informacoes(created_by);
create index if not exists idx_suporte_documentos_created_by
  on public.suporte_documentos(created_by);
create index if not exists idx_suporte_documentos_deleted_by
  on public.suporte_documentos(deleted_by) where deleted_by is not null;
create index if not exists idx_vendas_ativado_100_por
  on public.vendas(ativado_100_por) where ativado_100_por is not null;
