-- Respostas do BKO devem notificar o consultor responsável pelo pedido.
create or replace function public.notify_suporte_mensagem_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.suporte_solicitacoes%rowtype;
  v_consultor_id uuid;
  v_destinatario uuid;
begin
  select * into v_req
  from public.suporte_solicitacoes
  where id = new.solicitacao_id;

  select v.consultor_id into v_consultor_id
  from public.vendas v
  where v.id = v_req.venda_id;

  if new.autor_role = 'bko' then
    v_destinatario := coalesce(v_consultor_id, v_req.criado_por);
    if v_destinatario is not null and v_destinatario <> new.autor_id then
      insert into public.notificacoes (
        user_id, tipo, titulo, descricao, venda_id, ticket_id, solicitacao_id, link, criticidade
      ) values (
        v_destinatario,
        'suporte_mensagem',
        'Nova resposta do suporte',
        coalesce(new.autor_nome, 'BKO') || ': ' || left(new.mensagem, 180),
        v_req.venda_id,
        v_req.ticket_id,
        v_req.id,
        '/suporte/' || v_req.id::text,
        'info'
      );
    end if;
  else
    insert into public.notificacoes (
      user_id, tipo, titulo, descricao, venda_id, ticket_id, solicitacao_id, link, criticidade
    )
    select distinct
      ur.user_id,
      'suporte_mensagem',
      'Nova mensagem de suporte',
      coalesce(new.autor_nome, 'Consultor') || ': ' || left(new.mensagem, 180),
      v_req.venda_id,
      v_req.ticket_id,
      v_req.id,
      '/suporte/' || v_req.id::text,
      'info'
    from public.user_roles ur
    where ur.role = 'bko'::public.app_role
      and ur.user_id <> new.autor_id;
  end if;

  return new;
end;
$$;
