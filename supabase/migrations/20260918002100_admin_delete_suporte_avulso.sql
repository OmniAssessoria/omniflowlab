-- Exclusão lógica de suporte avulso exclusiva de Administrador.
-- Preserva histórico, documentos e vínculos para auditoria, mas remove o item das telas operacionais.

alter table public.suporte_solicitacoes
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references auth.users(id),
  add column if not exists deleted_by_nome text,
  add column if not exists deletion_reason text;

create index if not exists idx_suporte_solicitacoes_deleted_at
  on public.suporte_solicitacoes(deleted_at);

create or replace function public.suporte_usuario_tem_acesso(p_solicitacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.suporte_solicitacoes s
    left join public.vendas v on v.id=s.venda_id
    where s.id=p_solicitacao_id
      and s.deleted_at is null
      and auth.uid() is not null
      and (
        public.has_role(auth.uid(),'admin'::public.app_role)
        or public.has_role(auth.uid(),'bko'::public.app_role)
        or public.has_role(auth.uid(),'gestor'::public.app_role)
        or s.criado_por=auth.uid()
        or v.consultor_id=auth.uid()
      )
  );
$$;

revoke all on function public.suporte_usuario_tem_acesso(uuid) from public;
grant execute on function public.suporte_usuario_tem_acesso(uuid) to authenticated;

create or replace function public.excluir_suporte_avulso(p_solicitacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_actor_nome text;
  v_req public.suporte_solicitacoes%rowtype;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not public.has_role(v_user_id,'admin'::public.app_role) then
    raise exception '403: somente Administrador pode excluir suporte avulso.';
  end if;

  select * into v_req
  from public.suporte_solicitacoes
  where id = p_solicitacao_id
  for update;

  if not found then
    raise exception 'Suporte avulso não encontrado.';
  end if;

  if v_req.deleted_at is not null then
    return;
  end if;

  if v_req.venda_id is not null then
    raise exception 'Somente suporte avulso pode ser excluído por esta ação.';
  end if;

  select coalesce(p.nome_completo,p.email,'Administrador')
  into v_actor_nome
  from public.profiles p
  where p.id = v_user_id;

  update public.suporte_solicitacoes
  set deleted_at = now(),
      deleted_by = v_user_id,
      deleted_by_nome = coalesce(v_actor_nome,'Administrador'),
      deletion_reason = 'Exclusão manual de suporte avulso pelo Administrador',
      updated_at = now()
  where id = p_solicitacao_id;

  if v_req.ticket_id is not null then
    update public.tickets
    set deleted_at = coalesce(deleted_at, now()),
        deleted_by = coalesce(deleted_by, v_user_id),
        updated_at = now()
    where id = v_req.ticket_id;
  end if;

  insert into public.audit_logs(
    user_id,
    acao,
    descricao,
    entidade,
    entidade_id,
    valor_anterior,
    valor_novo
  ) values (
    v_user_id,
    'suporte_avulso_exclusao',
    'Suporte avulso excluído: ' || v_req.numero || ' · ' ||
      coalesce(v_req.cliente_razao_social, v_req.cliente_nome, 'Cliente não informado'),
    'suporte_solicitacao',
    v_req.id::text,
    jsonb_build_object(
      'numero', v_req.numero,
      'cliente', coalesce(v_req.cliente_razao_social, v_req.cliente_nome),
      'status', v_req.status,
      'ticket_id', v_req.ticket_id,
      'motivo', v_req.motivo
    ),
    jsonb_build_object(
      'deleted_at', now(),
      'deleted_by', v_user_id,
      'deleted_by_nome', coalesce(v_actor_nome,'Administrador')
    )
  );
end;
$$;

revoke all on function public.excluir_suporte_avulso(uuid) from public;
revoke execute on function public.excluir_suporte_avulso(uuid) from anon;
grant execute on function public.excluir_suporte_avulso(uuid) to authenticated;
