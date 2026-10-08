-- Closer pode acompanhar e excluir somente os suportes que ele próprio criou.
-- Não pode responder, editar prioridade, operar atendimento, adicionar informações
-- nem alterar documentos. BKO/Admin continuam recebendo e operando normalmente.

create or replace function public.suporte_usuario_tem_acesso(p_solicitacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.suporte_solicitacoes s
    left join public.vendas v on v.id=s.venda_id
    where s.id=p_solicitacao_id
      and s.deleted_at is null
      and auth.uid() is not null
      and (
        (
          public.has_role(s.criado_por,'closer'::public.app_role)
          and (
            public.has_role(auth.uid(),'admin'::public.app_role)
            or public.has_role(auth.uid(),'bko'::public.app_role)
            or (
              s.criado_por=auth.uid()
              and public.has_role(auth.uid(),'closer'::public.app_role)
            )
          )
        )
        or
        (
          not public.has_role(s.criado_por,'closer'::public.app_role)
          and (
            public.has_role(auth.uid(),'admin'::public.app_role)
            or public.has_role(auth.uid(),'bko'::public.app_role)
            or public.has_role(auth.uid(),'gestor'::public.app_role)
            or s.criado_por=auth.uid()
            or v.consultor_id=auth.uid()
          )
        )
      )
  );
$function$;

create or replace function public.excluir_suporte_avulso(p_solicitacao_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_actor_nome text;
  v_req public.suporte_solicitacoes%rowtype;
  v_is_admin boolean;
  v_is_closer boolean;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  v_is_admin := public.has_role(v_user_id,'admin'::public.app_role);
  v_is_closer := public.has_role(v_user_id,'closer'::public.app_role);

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

  if not (
    v_is_admin
    or (
      v_is_closer
      and v_req.criado_por = v_user_id
      and public.has_role(v_req.criado_por,'closer'::public.app_role)
    )
  ) then
    raise exception '403: sem permissão para excluir este suporte.';
  end if;

  select coalesce(p.nome_completo,p.email,case when v_is_closer then 'Closer' else 'Administrador' end)
  into v_actor_nome
  from public.profiles p
  where p.id = v_user_id;

  update public.suporte_solicitacoes
  set deleted_at = now(),
      deleted_by = v_user_id,
      deleted_by_nome = coalesce(v_actor_nome,case when v_is_closer then 'Closer' else 'Administrador' end),
      deletion_reason = case
        when v_is_closer then 'Exclusão manual do próprio suporte pelo Closer'
        else 'Exclusão manual de suporte avulso pelo Administrador'
      end,
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
      'deleted_by_nome', coalesce(v_actor_nome,case when v_is_closer then 'Closer' else 'Administrador' end),
      'origem_perfil', case when v_is_closer then 'closer' else 'admin' end
    )
  );
end;
$function$;

-- Closer pode ler documentos do próprio suporte, mas não alterar/excluir documentos.
drop policy if exists "suporte_documentos_soft_delete" on public.suporte_documentos;

create policy "suporte_documentos_soft_delete"
on public.suporte_documentos
for update
to authenticated
using (
  public.suporte_usuario_tem_acesso(solicitacao_id)
  and (
    public.has_role(auth.uid(),'admin'::public.app_role)
    or public.has_role(auth.uid(),'bko'::public.app_role)
    or public.has_role(auth.uid(),'consultor'::public.app_role)
  )
)
with check (
  public.suporte_usuario_tem_acesso(solicitacao_id)
  and (
    public.has_role(auth.uid(),'admin'::public.app_role)
    or public.has_role(auth.uid(),'bko'::public.app_role)
    or public.has_role(auth.uid(),'consultor'::public.app_role)
  )
);
