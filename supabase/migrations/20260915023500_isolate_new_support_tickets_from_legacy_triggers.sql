-- O fluxo novo de suporte usa suporte_solicitacoes como entidade raiz.
-- Tickets com solicitacao_id não podem acionar notificações/retornos do fluxo legado.

-- Notificação antiga de ticket aponta para /suporte/<ticket_id>, o que não é o chat
-- da solicitação nova. Solicitações novas já possuem suas próprias notificações.
drop trigger if exists tickets_notify_new on public.tickets;
create trigger tickets_notify_new
after insert on public.tickets
for each row
when (new.solicitacao_id is null)
execute function public.notify_novo_ticket();

-- A estrutura venda_suporte_retorno pertence ao modelo antigo que movia a venda
-- para o funil Suporte. Cards novos nunca devem se vincular a ela.
drop trigger if exists trg_omni_vincular_ticket_retorno_suporte on public.tickets;
create trigger trg_omni_vincular_ticket_retorno_suporte
after insert on public.tickets
for each row
when (new.solicitacao_id is null)
execute function public.omni_vincular_ticket_retorno_suporte();

-- Resolver um card novo altera somente a solicitação/ticket. O pedido comercial
-- permanece onde estiver e não participa da restauração do fluxo legado.
drop trigger if exists trg_omni_restaurar_venda_apos_chamado_resolvido on public.tickets;
create trigger trg_omni_restaurar_venda_apos_chamado_resolvido
after update of status on public.tickets
for each row
when (new.solicitacao_id is null)
execute function public.omni_restaurar_venda_apos_chamado_resolvido();

-- Helpers internos SECURITY DEFINER não devem ser RPCs públicos invocáveis.
revoke all on function public.suporte_nome_usuario(uuid) from public, anon, authenticated;
revoke all on function public.suporte_registrar_evento(uuid, uuid, text, text, uuid, text, jsonb) from public, anon, authenticated;
