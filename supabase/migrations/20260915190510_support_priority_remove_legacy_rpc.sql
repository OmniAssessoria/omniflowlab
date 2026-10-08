-- Limpeza pós-deploy da ponte temporária de compatibilidade.
-- Aplicar somente depois que o frontend com prioridade explícita estiver publicado.

revoke all on function public.criar_solicitacao_suporte(uuid, text)
  from public, anon, authenticated;

drop function if exists public.criar_solicitacao_suporte(uuid, text);
