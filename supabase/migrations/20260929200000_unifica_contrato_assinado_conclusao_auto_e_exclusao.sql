-- Unifica Contrato Assinado, conclui automaticamente em ATIVADO 100%
-- e corrige a ordem transacional da exclusão física de pedidos.

-- 1. Uma única etapa de Contrato Assinado para CLARO e VIVO.
update public.pipeline_etapas
set nome='Contrato Assinado',
    cor='success',
    ordem=40,
    ativo=true,
    updated_at=now()
where id='a-assinado';

update public.vendas
set etapa_id='a-assinado'
where etapa_id='a-assinado-vivo'
  and deleted_at is null
  and coalesce(is_deleted,false)=false;

delete from public.pipeline_etapas
where id='a-assinado-vivo';

-- 2. Conclusão automática quando o status atual mais recente for ATIVADO 100%
-- e o pedido estiver em Assinatura -> Contrato Assinado.
create or replace function public.pipeline_auto_concluir_ativado_100()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_status text;
  v_status_em timestamptz;
  v_norm text;
begin
  if new.deleted_at is not null or coalesce(new.is_deleted,false) then
    return new;
  end if;

  if new.concluido_em is not null then
    return new;
  end if;

  if new.funil::text <> 'assinatura' or new.etapa_id <> 'a-assinado' then
    return new;
  end if;

  if nullif(btrim(coalesce(new.status_pedido,'')), '') is not null
     and nullif(btrim(coalesce(new.status_comercial_nome,'')), '') is not null then
    if new.status_pedido_em is not null
       and (new.status_comercial_em is null or new.status_pedido_em >= new.status_comercial_em) then
      v_status := new.status_pedido;
      v_status_em := new.status_pedido_em;
    else
      v_status := new.status_comercial_nome;
      v_status_em := new.status_comercial_em;
    end if;
  elsif nullif(btrim(coalesce(new.status_pedido,'')), '') is not null then
    v_status := new.status_pedido;
    v_status_em := new.status_pedido_em;
  else
    v_status := new.status_comercial_nome;
    v_status_em := new.status_comercial_em;
  end if;

  v_norm := regexp_replace(upper(coalesce(v_status,'')), '[^A-Z0-9]+', '', 'g');

  if v_norm like '%ATIVADO100%' then
    new.ativado_100_em := coalesce(new.ativado_100_em, v_status_em, now());
    new.concluido_em := coalesce(v_status_em, now());
    new.concluido_por := null;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_pipeline_auto_concluir_ativado_100_insert on public.vendas;
create trigger trg_pipeline_auto_concluir_ativado_100_insert
before insert on public.vendas
for each row execute function public.pipeline_auto_concluir_ativado_100();

drop trigger if exists trg_pipeline_auto_concluir_ativado_100_update on public.vendas;
create trigger trg_pipeline_auto_concluir_ativado_100_update
before update of status_pedido,status_pedido_em,status_comercial_nome,status_comercial_em,etapa_id,funil
on public.vendas
for each row execute function public.pipeline_auto_concluir_ativado_100();

revoke execute on function public.pipeline_auto_concluir_ativado_100() from public;
revoke execute on function public.pipeline_auto_concluir_ativado_100() from anon;
revoke execute on function public.pipeline_auto_concluir_ativado_100() from authenticated;

-- 3. Histórico automático, sem duplicar a conclusão manual.
create or replace function public.log_venda_historico()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_nome text;
begin
  select nome_completo into v_nome from public.profiles where id = v_user;

  if tg_op = 'INSERT' then
    insert into public.venda_historico (venda_id, tipo, descricao, user_id, user_nome)
    values (new.id, 'criacao', 'Venda criada (' || new.operadora || ' · ' || new.cliente_razao_social || ')', v_user, v_nome);
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.etapa_id is distinct from old.etapa_id then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (new.id, 'etapa', 'etapa_id', old.etapa_id, new.etapa_id, 'Etapa: ' || old.etapa_id || ' → ' || new.etapa_id, v_user, v_nome);
    end if;

    if new.funil is distinct from old.funil then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (new.id, 'funil', 'funil', old.funil::text, new.funil::text, 'Funil: ' || old.funil || ' → ' || new.funil, v_user, v_nome);
    end if;

    if new.valor is distinct from old.valor then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (new.id, 'valor', 'valor', old.valor::text, new.valor::text, 'Valor alterado', v_user, v_nome);
    end if;

    if new.consultor_id is distinct from old.consultor_id then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (new.id, 'consultor', 'consultor_id', old.consultor_id::text, new.consultor_id::text, 'Consultor responsável alterado', v_user, v_nome);
    end if;

    if new.tipo_pedidos is distinct from old.tipo_pedidos then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (
        new.id,'campo','tipo_pedidos',
        array_to_string(old.tipo_pedidos,' | '),
        array_to_string(new.tipo_pedidos,' | '),
        'Tipos de pedido alterados',v_user,v_nome
      );
    end if;

    if new.produtos is distinct from old.produtos then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (
        new.id,'campo','produtos',
        array_to_string(old.produtos,' | '),
        array_to_string(new.produtos,' | '),
        'Produtos do pedido alterados',v_user,v_nome
      );
    end if;

    if new.cedente_id is distinct from old.cedente_id then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (new.id,'campo','cedente_id',old.cedente_id::text,new.cedente_id::text,'Cedente do pedido alterado',v_user,v_nome);
    end if;

    if old.concluido_em is null
       and new.concluido_em is not null
       and new.concluido_por is null
       and new.funil::text='assinatura'
       and new.etapa_id='a-assinado' then
      insert into public.venda_historico(
        venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome
      ) values (
        new.id,
        'campo'::public.historico_tipo_enum,
        'concluido_em',
        null,
        new.concluido_em::text,
        'Pedido concluído automaticamente após status ATIVADO 100%. Origem: Assinatura → Contrato Assinado.',
        null,
        'Automação OMNI'
      );
    end if;

    return new;
  end if;

  return new;
end;
$function$;

revoke execute on function public.log_venda_historico() from public;
revoke execute on function public.log_venda_historico() from anon;
revoke execute on function public.log_venda_historico() from authenticated;

-- 4. Conclusão manual usa somente a etapa unificada.
create or replace function public.pipeline_concluir_venda(p_venda_id uuid)
returns timestamp with time zone
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_now timestamptz := now();
  v_user_nome text;
  v_roles text;
  v_funil_nome text;
  v_etapa_nome text;
  v_datas_faltantes text[] := array[]::text[];
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_user_id,'admin'::public.app_role)
    or public.has_role(v_user_id,'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode concluir pedido comercial.';
  end if;

  select * into v_venda
  from public.vendas
  where id=p_venda_id
  for update;

  if not found or v_venda.deleted_at is not null or coalesce(v_venda.is_deleted,false) then
    raise exception 'Pedido não encontrado.';
  end if;

  if coalesce(v_venda.status_pedido,'') in ('cancelado','reprovado') then
    raise exception 'Pedido cancelado ou reprovado não pode ser concluído por esta ação.';
  end if;

  if v_venda.concluido_em is not null then
    raise exception 'Pedido já está concluído.';
  end if;

  if v_venda.etapa_id <> 'a-assinado' then
    raise exception 'Pedido só pode ser concluído após Contrato Assinado.';
  end if;

  if v_venda.data_recebimento is null then v_datas_faltantes := array_append(v_datas_faltantes,'Recebimento'); end if;
  if v_venda.data_preenchimento is null then v_datas_faltantes := array_append(v_datas_faltantes,'Preenchimento'); end if;
  if v_venda.data_aceite is null then v_datas_faltantes := array_append(v_datas_faltantes,'Aceite'); end if;
  if v_venda.data_input is null then v_datas_faltantes := array_append(v_datas_faltantes,'Input'); end if;
  if v_venda.data_ativacao is null then v_datas_faltantes := array_append(v_datas_faltantes,'Ativação'); end if;

  if cardinality(v_datas_faltantes)>0 then
    raise exception 'Preencha as Datas do Sistema obrigatórias antes de concluir: %.',
      array_to_string(v_datas_faltantes,', ');
  end if;

  select nome into v_funil_nome from public.pipeline_funis where id=v_venda.funil::text;
  select nome into v_etapa_nome from public.pipeline_etapas where id=v_venda.etapa_id;
  select coalesce(nome_completo,email,'Usuário') into v_user_nome from public.profiles where id=v_user_id;
  select coalesce(string_agg(role::text,', ' order by role::text),'sem_perfil')
    into v_roles from public.user_roles where user_id=v_user_id;

  update public.vendas
  set concluido_em=v_now,
      concluido_por=v_user_id
  where id=p_venda_id;

  insert into public.venda_historico(
    venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome
  ) values (
    p_venda_id,
    'campo'::public.historico_tipo_enum,
    'concluido_em',
    null,
    v_now::text,
    'Pedido comercial concluído. Perfil: ' || v_roles || E'\nOrigem preservada: ' ||
      coalesce(v_funil_nome,v_venda.funil::text) || ' → ' || coalesce(v_etapa_nome,v_venda.etapa_id),
    v_user_id,
    coalesce(v_user_nome,'Usuário')
  );

  return v_now;
end;
$function$;

-- 5. Triggers de Cedente não tentam registrar histórico depois que o pai já sumiu.
create or replace function public.log_venda_cedente_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_nome text;
  v_cedente_nome text;
  v_venda uuid;
  v_cedente uuid;
begin
  v_venda := coalesce(new.venda_id,old.venda_id);
  v_cedente := coalesce(new.cedente_id,old.cedente_id);

  if tg_op='DELETE'
     and not exists (select 1 from public.vendas where id=v_venda) then
    return old;
  end if;

  select nome_completo into v_nome from public.profiles where id=v_user;
  select coalesce(razao_social,nome,cnpj_cpf) into v_cedente_nome
  from public.cedentes where id=v_cedente;

  if tg_op='INSERT' then
    insert into public.venda_historico(venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
    values(v_venda,'campo','cedente_id',null,v_cedente::text,'Cedente incluído no pedido: '||coalesce(v_cedente_nome,v_cedente::text),v_user,v_nome);
    return new;
  end if;

  if tg_op='DELETE' then
    insert into public.venda_historico(venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
    values(v_venda,'campo','cedente_id',v_cedente::text,null,'Cedente removido do pedido: '||coalesce(v_cedente_nome,v_cedente::text),v_user,v_nome);
    return old;
  end if;

  return coalesce(new,old);
end;
$function$;

revoke execute on function public.log_venda_cedente_change() from public;
revoke execute on function public.log_venda_cedente_change() from anon;
revoke execute on function public.log_venda_cedente_change() from authenticated;

create or replace function public.proteger_cedente_em_uso_na_venda()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from public.vendas where id=old.venda_id) then
    return old;
  end if;

  if exists (
    select 1
    from public.venda_linha_doadores vld
    join public.venda_linhas vl on vl.id=vld.linha_id
    where vl.venda_id=old.venda_id
      and vld.cedente_id=old.cedente_id
  ) then
    raise exception 'Cedente está vinculado a uma ou mais linhas deste pedido';
  end if;

  return old;
end;
$function$;

-- 6. Exclusão física remove relações com triggers enquanto a venda pai ainda existe.
create or replace function public.omni_excluir_venda_fisica(
  p_venda_id uuid,
  p_reason text,
  p_user_id uuid,
  p_user_email text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_venda public.vendas%rowtype;
  v_solicitacao_ids uuid[] := array[]::uuid[];
  v_ticket_ids uuid[] := array[]::uuid[];
  v_deleted_count integer := 0;
begin
  select * into v_venda
  from public.vendas
  where id=p_venda_id
  for update;

  if not found then
    return jsonb_build_object('success',false,'message','Pedido não encontrado ou já excluído.');
  end if;

  select coalesce(array_agg(s.id),array[]::uuid[])
    into v_solicitacao_ids
  from public.suporte_solicitacoes s
  where s.venda_id=p_venda_id;

  select coalesce(array_agg(t.id),array[]::uuid[])
    into v_ticket_ids
  from public.tickets t
  where t.venda_id=p_venda_id
     or t.solicitacao_id=any(v_solicitacao_ids);

  insert into public.audit_logs(
    user_id,user_email,acao,descricao,entidade,entidade_id,valor_anterior,valor_novo
  ) values (
    p_user_id,p_user_email,'exclusao_definitiva',
    'Pedido excluído definitivamente. Motivo: '||p_reason,
    'venda',p_venda_id::text,to_jsonb(v_venda),null
  );

  delete from public.notificacoes n
  where n.venda_id=p_venda_id
     or n.solicitacao_id=any(v_solicitacao_ids)
     or n.ticket_id=any(v_ticket_ids);

  delete from public.tickets where id=any(v_ticket_ids);
  delete from public.suporte_solicitacoes where venda_id=p_venda_id;

  delete from public.venda_linha_doadores
  where linha_id in (select id from public.venda_linhas where venda_id=p_venda_id);

  delete from public.venda_cedentes where venda_id=p_venda_id;
  delete from public.venda_linhas where venda_id=p_venda_id;

  delete from public.ia_adm_logs where venda_id=p_venda_id;

  delete from public.venda_historico where venda_id=p_venda_id;

  delete from public.vendas where id=p_venda_id;
  get diagnostics v_deleted_count=row_count;

  if v_deleted_count<>1 then
    raise exception 'O pedido não foi excluído. Nenhum registro removido.';
  end if;

  return jsonb_build_object(
    'success',true,
    'venda_id',p_venda_id,
    'deleted',v_deleted_count,
    'solicitacoes_deleted',cardinality(v_solicitacao_ids),
    'tickets_deleted',cardinality(v_ticket_ids)
  );
end;
$function$;

revoke execute on function public.omni_excluir_venda_fisica(uuid,text,uuid,text) from public;
revoke execute on function public.omni_excluir_venda_fisica(uuid,text,uuid,text) from anon;
revoke execute on function public.omni_excluir_venda_fisica(uuid,text,uuid,text) from authenticated;

-- 7. Regulariza pedidos que já estavam em Contrato Assinado + ATIVADO 100%.
update public.vendas
set status_pedido=status_pedido
where etapa_id='a-assinado'
  and concluido_em is null
  and deleted_at is null
  and coalesce(is_deleted,false)=false
  and (
    regexp_replace(upper(coalesce(status_pedido,'')),'[^A-Z0-9]+','','g') like '%ATIVADO100%'
    or regexp_replace(upper(coalesce(status_comercial_nome,'')),'[^A-Z0-9]+','','g') like '%ATIVADO100%'
  );
