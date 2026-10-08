-- Número real do pedido passa a ser nulo até preenchimento manual.
-- Também adapta automações que antes pressupunham numero sempre preenchido.
-- A gestão de Planos usa as tabelas existentes e as políticas RLS já limitam escrita a Admin/BKO.

alter table public.vendas
  alter column numero drop not null;

comment on column public.vendas.numero is
  'Número real do pedido. Deve permanecer NULL até ser informado manualmente pela operação.';

create or replace function public.notify_nova_venda()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_numero_exibicao text;
begin
  v_numero_exibicao := coalesce(
    nullif(btrim(new.numero),''),
    case when new.created_by is null then 'VND-Não informado' else 'OMN-Não informado' end
  );

  insert into public.notificacoes(user_id,tipo,titulo,descricao,venda_id,criticidade,link)
  select ur.user_id,
         'nova_venda',
         'Nova venda: ' || v_numero_exibicao,
         new.cliente_razao_social || ' (' || new.operadora || ')',
         new.id,
         'info',
         '/vendas/' || new.id
  from public.user_roles ur
  where ur.role in ('admin','gestor');

  return new;
end;
$function$;

revoke execute on function public.notify_nova_venda() from public;
revoke execute on function public.notify_nova_venda() from anon;
revoke execute on function public.notify_nova_venda() from authenticated;

create or replace function public.auto_ticket_on_funil_suporte()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  existing_id uuid;
  actor uuid := coalesce(auth.uid(),new.consultor_id);
  is_urgente boolean := (new.etapa_id='s-urgente');
  prio text;
  v_numero_exibicao text;
begin
  v_numero_exibicao := coalesce(
    nullif(btrim(new.numero),''),
    case when new.created_by is null then 'VND-Não informado' else 'OMN-Não informado' end
  );

  if new.funil::text='suporte'
     and (tg_op='INSERT' or old.funil::text is distinct from new.funil::text) then
    select id into existing_id
    from public.tickets
    where venda_id=new.id and status not in ('resolvido','fechado')
    limit 1;

    if existing_id is null and actor is not null then
      prio := case when is_urgente then 'urgente' else 'media' end;

      insert into public.tickets(
        venda_id,cliente_razao_social,cliente_cnpj,operadora,
        titulo,descricao,categoria,prioridade,status,
        criado_por,atribuido_a,sla_due_at
      ) values (
        new.id,new.cliente_razao_social,new.cliente_cnpj,new.operadora::text,
        'Suporte — venda ' || v_numero_exibicao,
        coalesce(
          new.status_pedido_obs,
          'Chamado gerado automaticamente pela venda ' || v_numero_exibicao || ' ao entrar no funil Suporte.'
        ),
        'operacional',prio,'aberto',actor,null,
        now() + case when is_urgente then interval '4 hours' else interval '24 hours' end
      );
    end if;
  end if;

  return new;
end;
$function$;

revoke execute on function public.auto_ticket_on_funil_suporte() from public;
revoke execute on function public.auto_ticket_on_funil_suporte() from anon;
revoke execute on function public.auto_ticket_on_funil_suporte() from authenticated;

create or replace function public.atualizar_observacao_status_robo(
  p_venda_id uuid,
  p_robo_log_id uuid,
  p_observacao text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_venda_numero text;
  v_venda_existe boolean := false;
  v_log public.venda_robo_logs%rowtype;
  v_observacao text := nullif(btrim(coalesce(p_observacao,'')),'');
  v_nome text;
  v_role text;
begin
  if v_uid is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_uid,'admin'::public.app_role)
    or public.has_role(v_uid,'bko'::public.app_role)
  ) then
    raise exception '403: somente BKO ou Administrador podem registrar observação em status do robô.';
  end if;

  if v_observacao is null then
    raise exception 'Informe uma observação.';
  end if;

  select true,numero
    into v_venda_existe,v_venda_numero
  from public.vendas
  where id=p_venda_id
    and deleted_at is null
    and not coalesce(is_deleted,false);

  if not coalesce(v_venda_existe,false) then
    raise exception 'Pedido não encontrado.';
  end if;

  select *
    into v_log
  from public.venda_robo_logs l
  where l.id=p_robo_log_id
    and (
      l.venda_id=p_venda_id
      or (v_venda_numero is not null and l.venda_numero=v_venda_numero)
    )
    and l.campo in ('status_pedido','status_comercial_nome','status_portabilidade','status_biometria')
  for update;

  if not found then
    raise exception 'Status automático não encontrado para este pedido.';
  end if;

  select coalesce(nullif(btrim(p.nome_completo),''),nullif(btrim(p.email),''),'Usuário')
    into v_nome
  from public.profiles p
  where p.id=v_uid;

  v_role := case
    when public.has_role(v_uid,'admin'::public.app_role) then 'admin'
    else 'bko'
  end;

  update public.venda_robo_logs
  set observacao_bko=v_observacao,
      observacao_bko_user_id=v_uid,
      observacao_bko_user_nome=coalesce(v_nome,'Usuário'),
      observacao_bko_user_role=v_role,
      observacao_bko_em=now()
  where id=p_robo_log_id;

  insert into public.venda_historico(
    venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome
  ) values (
    p_venda_id,
    'observacao'::public.historico_tipo_enum,
    'observacao_status_robo',
    v_log.observacao_bko,
    v_observacao,
    'Observação do status automático "' ||
      coalesce(v_log.valor_novo,v_log.campo_label,'Status do robô') ||
      '" atualizada.',
    v_uid,
    coalesce(v_nome,'Usuário')
  );

  return p_robo_log_id;
end;
$function$;

revoke execute on function public.atualizar_observacao_status_robo(uuid,uuid,text) from public;
revoke execute on function public.atualizar_observacao_status_robo(uuid,uuid,text) from anon;
grant execute on function public.atualizar_observacao_status_robo(uuid,uuid,text) to authenticated;

-- A etapa Contrato Assinado é única. Remove referência residual da função de troca de operadora.
do $$
declare
  v_def text;
  v_old text := E'  v_new_etapa := v_venda.etapa_id;\n  if v_new_operadora = ''VIVO''::public.operadora_enum and v_venda.etapa_id = ''a-assinado'' then\n    v_new_etapa := ''a-assinado-vivo'';\n  elsif v_new_operadora = ''CLARO''::public.operadora_enum and v_venda.etapa_id = ''a-assinado-vivo'' then\n    v_new_etapa := ''a-assinado'';\n  end if;';
begin
  select pg_get_functiondef(p.oid)
    into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='pipeline_trocar_operadora'
  limit 1;

  if v_def is not null and position(v_old in v_def)>0 then
    v_def := replace(v_def,v_old,E'  v_new_etapa := v_venda.etapa_id;');
    execute v_def;
  end if;
end $$;

update public.vendas
set etapa_id='a-assinado'
where etapa_id='a-assinado-vivo';
