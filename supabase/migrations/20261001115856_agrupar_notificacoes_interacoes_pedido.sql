alter table public.notificacoes
  add column if not exists updated_at timestamptz,
  add column if not exists item_count integer not null default 1,
  add column if not exists grupo_aberto boolean not null default false,
  add column if not exists source_txid bigint,
  add column if not exists cliente_cnpj_snapshot text,
  add column if not exists cliente_razao_snapshot text;

update public.notificacoes
set updated_at = coalesce(updated_at, created_at)
where updated_at is null;

alter table public.notificacoes
  alter column updated_at set default now(),
  alter column updated_at set not null;

create index if not exists notificacoes_user_updated_idx
  on public.notificacoes(user_id, updated_at desc);

create index if not exists notificacoes_venda_grupo_idx
  on public.notificacoes(user_id, venda_id, grupo_aberto, updated_at desc)
  where venda_id is not null;

create table if not exists public.notificacao_itens (
  id uuid primary key default gen_random_uuid(),
  notificacao_id uuid not null references public.notificacoes(id) on delete cascade,
  venda_id uuid not null references public.vendas(id) on delete cascade,
  historico_id uuid references public.venda_historico(id) on delete set null,
  actor_user_id uuid,
  actor_nome text,
  actor_role text,
  campo text,
  campo_label text,
  valor_anterior text,
  valor_novo text,
  descricao text not null,
  source_txid bigint,
  created_at timestamptz not null default now()
);

create index if not exists notificacao_itens_notificacao_created_idx
  on public.notificacao_itens(notificacao_id, created_at asc);

create unique index if not exists notificacao_itens_hist_parent_uq
  on public.notificacao_itens(notificacao_id, historico_id)
  where historico_id is not null;

alter table public.notificacao_itens enable row level security;

revoke all on table public.notificacao_itens from anon;
revoke all on table public.notificacao_itens from authenticated;
grant select on table public.notificacao_itens to authenticated;
grant select, insert, update, delete on table public.notificacao_itens to service_role;

drop policy if exists "usuario le itens das proprias notificacoes" on public.notificacao_itens;
create policy "usuario le itens das proprias notificacoes"
on public.notificacao_itens
for select
to authenticated
using (
  exists (
    select 1
    from public.notificacoes n
    where n.id = notificacao_itens.notificacao_id
      and n.user_id = (select auth.uid())
  )
);

create or replace function public.notificar_alteracao_historico_venda()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor_role text;
  v_actor_nome text;
  v_consultor_id uuid;
  v_operadora text;
  v_marca text;
  v_produtos text[];
  v_produto text;
  v_cnpj text;
  v_razao text;
  v_recipient uuid;
  v_parent uuid;
  v_last_actor uuid;
  v_last_open boolean;
  v_last_txid bigint;
  v_txid bigint := txid_current();
  v_importante boolean;
  v_label text;
  v_count integer;
  v_summary text;
begin
  if new.tipo::text = 'criacao' or new.user_id is null then
    return new;
  end if;

  select coalesce(new.user_nome, p.nome_completo, 'Usuário')
    into v_actor_nome
  from public.profiles p
  where p.id = new.user_id;

  if v_actor_nome is null then
    v_actor_nome := coalesce(new.user_nome, 'Usuário');
  end if;

  select case
    when exists(select 1 from public.user_roles where user_id=new.user_id and role='bko') then 'bko'
    when exists(select 1 from public.user_roles where user_id=new.user_id and role='gestor') then 'gestor'
    when exists(select 1 from public.user_roles where user_id=new.user_id and role='consultor') then 'consultor'
    when exists(select 1 from public.user_roles where user_id=new.user_id and role='admin') then 'admin'
    else null
  end into v_actor_role;

  if v_actor_role is null then
    return new;
  end if;

  select
    v.consultor_id,
    v.operadora::text,
    v.produtos,
    v.produto,
    v.cliente_cnpj,
    v.cliente_razao_social
  into
    v_consultor_id,
    v_operadora,
    v_produtos,
    v_produto,
    v_cnpj,
    v_razao
  from public.vendas v
  where v.id = new.venda_id;

  if not found then
    return new;
  end if;

  v_marca := v_operadora;
  if exists (
    select 1
    from unnest(coalesce(v_produtos, array[]::text[])) item
    where upper(btrim(item)) = 'PABX'
  ) or upper(btrim(coalesce(v_produto,''))) = 'PABX' then
    v_marca := 'PABX';
  end if;

  v_importante :=
    new.campo in ('movimentacao_pipeline','concluido_em','status_pedido','status_comercial_nome')
    or new.tipo::text in ('etapa','funil');

  v_label := case new.campo
    when 'movimentacao_pipeline' then 'Movimentação do pedido'
    when 'etapa_id' then 'Etapa'
    when 'funil' then 'Funil'
    when 'valor' then 'Valor do pedido'
    when 'consultor_id' then 'Consultor responsável'
    when 'bko_colab_id' then 'BKO responsável'
    when 'bko_nome' then 'BKO responsável'
    when 'tipo_pedidos' then 'Tipos de pedido'
    when 'produtos' then 'Produtos'
    when 'cedente_id' then 'Cedente'
    when 'numero' then 'Número do pedido'
    when 'numero_pedido' then 'Número do pedido'
    when 'cliente_razao_social' then 'Razão social'
    when 'cliente_cnpj' then 'CNPJ/CPF'
    when 'cliente_contato' then 'Contato'
    when 'cliente_telefone' then 'Telefone'
    when 'cliente_email' then 'E-mail'
    when 'cliente_uf' then 'UF'
    when 'operadora' then 'Operadora'
    when 'status' then 'Status'
    when 'status_pedido' then 'Status do pedido'
    when 'status_biometria' then 'Biometria'
    when 'data_recebimento' then 'Data de recebimento'
    when 'data_preenchimento' then 'Data de preenchimento'
    when 'data_envio' then 'Data de envio'
    when 'data_aceite' then 'Data de aceite'
    when 'data_input' then 'Data de input'
    when 'data_ativacao' then 'Data de ativação'
    when 'data_portabilidade' then 'Data de portabilidade'
    when 'data_entrega' then 'Data de entrega/instalação'
    when 'observacao' then 'Observação'
    when 'observacao_status_robo' then 'Observação do status'
    when 'documento_pedido' then 'Documento'
    when 'concluido_em' then 'Conclusão do pedido'
    when 'linha' then 'Linha'
    when 'cedente_linha' then 'Cedente da linha'
    else initcap(replace(coalesce(new.campo, new.tipo::text, 'alteração'), '_', ' '))
  end;

  for v_recipient in
    select distinct ur.user_id
    from public.user_roles ur
    where ur.user_id <> new.user_id
      and (
        ur.role = 'admin'
        or (ur.role = 'bko' and v_actor_role in ('consultor','gestor'))
        or (ur.role = 'gestor' and v_actor_role in ('bko','consultor'))
        or (
          ur.role = 'consultor'
          and v_actor_role = 'bko'
          and ur.user_id = v_consultor_id
        )
      )
  loop
    v_parent := null;
    v_last_actor := null;
    v_last_open := false;
    v_last_txid := null;

    select n.id, n.actor_user_id, n.grupo_aberto, n.source_txid
      into v_parent, v_last_actor, v_last_open, v_last_txid
    from public.notificacoes n
    where n.user_id = v_recipient
      and n.venda_id = new.venda_id
      and n.tipo in ('pedido_alterado_grupo','pedido_alterado_importante')
    order by n.updated_at desc, n.created_at desc
    limit 1;

    if v_parent is not null and v_last_txid = v_txid then
      null;
    elsif not v_importante
      and v_parent is not null
      and v_last_open
      and v_last_actor = new.user_id then
      null;
    else
      update public.notificacoes
      set grupo_aberto = false
      where user_id = v_recipient
        and venda_id = new.venda_id
        and grupo_aberto = true;

      insert into public.notificacoes(
        user_id, tipo, titulo, descricao, venda_id, criticidade, link,
        canal, marca, actor_user_id, actor_nome, actor_role,
        updated_at, item_count, grupo_aberto, source_txid,
        cliente_cnpj_snapshot, cliente_razao_snapshot
      ) values (
        v_recipient,
        case when v_importante then 'pedido_alterado_importante' else 'pedido_alterado_grupo' end,
        '[' || coalesce(v_marca,'OMNI') || '] ALTERAÇÕES NO PEDIDO',
        '',
        new.venda_id,
        case when v_importante then 'media' else 'info' end,
        '/vendas/' || new.venda_id,
        'operadoras',
        v_marca,
        new.user_id,
        v_actor_nome,
        v_actor_role,
        now(),
        0,
        not v_importante,
        v_txid,
        v_cnpj,
        v_razao
      )
      returning id into v_parent;
    end if;

    if new.campo = 'movimentacao_pipeline' then
      delete from public.notificacao_itens
      where notificacao_id = v_parent
        and source_txid = v_txid
        and campo in ('etapa_id','funil');
    elsif new.campo in ('etapa_id','funil')
      and exists (
        select 1
        from public.notificacao_itens i
        where i.notificacao_id = v_parent
          and i.source_txid = v_txid
          and i.campo = 'movimentacao_pipeline'
      ) then
      null;
    else
      insert into public.notificacao_itens(
        notificacao_id, venda_id, historico_id,
        actor_user_id, actor_nome, actor_role,
        campo, campo_label, valor_anterior, valor_novo,
        descricao, source_txid, created_at
      ) values (
        v_parent,
        new.venda_id,
        new.id,
        new.user_id,
        v_actor_nome,
        v_actor_role,
        new.campo,
        v_label,
        new.valor_anterior,
        new.valor_novo,
        coalesce(nullif(btrim(new.descricao),''), v_label || ' alterado'),
        v_txid,
        new.created_at
      )
      on conflict (notificacao_id, historico_id) where historico_id is not null
      do nothing;
    end if;

    select count(*) into v_count
    from public.notificacao_itens i
    where i.notificacao_id = v_parent;

    v_summary :=
      coalesce(nullif(btrim(v_cnpj),''), 'CNPJ/CPF não informado')
      || ' · '
      || coalesce(nullif(btrim(v_razao),''), 'Razão social não informada')
      || ' · '
      || v_actor_nome
      || case
          when v_importante and v_count = 1 then ' realizou uma alteração importante'
          when v_count = 1 then ' realizou 1 alteração'
          else ' realizou ' || v_count || ' alterações'
        end;

    update public.notificacoes
    set descricao = left(v_summary, 500),
        titulo = case
          when v_importante then '[' || coalesce(v_marca,'OMNI') || '] ATUALIZAÇÃO IMPORTANTE'
          else '[' || coalesce(v_marca,'OMNI') || '] ALTERAÇÕES NO PEDIDO'
        end,
        actor_nome = v_actor_nome,
        actor_role = v_actor_role,
        marca = v_marca,
        lida = false,
        updated_at = now(),
        item_count = greatest(v_count, 1),
        cliente_cnpj_snapshot = v_cnpj,
        cliente_razao_snapshot = v_razao
    where id = v_parent;
  end loop;

  return new;
end;
$function$;

create or replace function public.notify_nova_venda()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor_nome text;
  v_actor_role text;
  v_marca text;
begin
  select coalesce(p.nome_completo, 'Usuário') into v_actor_nome
  from public.profiles p
  where p.id = auth.uid();

  if v_actor_nome is null then
    v_actor_nome := 'Usuário';
  end if;

  select case
    when exists(select 1 from public.user_roles where user_id=auth.uid() and role='bko') then 'bko'
    when exists(select 1 from public.user_roles where user_id=auth.uid() and role='gestor') then 'gestor'
    when exists(select 1 from public.user_roles where user_id=auth.uid() and role='consultor') then 'consultor'
    when exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin') then 'admin'
    else null
  end into v_actor_role;

  if v_actor_role is null then
    return new;
  end if;

  v_marca := new.operadora::text;
  if exists (
    select 1 from unnest(coalesce(new.produtos,array[]::text[])) item
    where upper(btrim(item))='PABX'
  ) or upper(btrim(coalesce(new.produto,'')))='PABX' then
    v_marca := 'PABX';
  end if;

  insert into public.notificacoes(
    user_id,tipo,titulo,descricao,venda_id,criticidade,link,
    canal,marca,actor_user_id,actor_nome,actor_role,
    updated_at,item_count,grupo_aberto,source_txid,
    cliente_cnpj_snapshot,cliente_razao_snapshot
  )
  select distinct
    ur.user_id,
    'nova_venda',
    '['||coalesce(v_marca,'OMNI')||'] LEAD CRIADO',
    coalesce(nullif(btrim(new.cliente_cnpj),''),'CNPJ/CPF não informado')
      || ' · ' || new.cliente_razao_social
      || ' · Lead criado por ' || v_actor_nome,
    new.id,
    'info',
    '/vendas/' || new.id,
    'operadoras',
    v_marca,
    auth.uid(),
    v_actor_nome,
    v_actor_role,
    now(),
    1,
    false,
    txid_current(),
    new.cliente_cnpj,
    new.cliente_razao_social
  from public.user_roles ur
  where ur.user_id <> auth.uid()
    and (
      ur.role = 'admin'
      or (ur.role = 'bko' and v_actor_role in ('consultor','gestor'))
      or (ur.role = 'gestor' and v_actor_role in ('bko','consultor'))
      or (
        ur.role = 'consultor'
        and v_actor_role = 'bko'
        and ur.user_id = new.consultor_id
      )
    );

  return new;
end;
$function$;

create or replace function public.log_venda_linha_alteracao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_nome text;
  v_venda_id uuid;
  v_label text;
  v_created_at timestamptz;
  v_key text;
  v_old text;
  v_new text;
begin
  if v_user is null then
    return case when tg_op='DELETE' then old else new end;
  end if;

  select nome_completo into v_nome from public.profiles where id = v_user;
  v_venda_id := case when tg_op='DELETE' then old.venda_id else new.venda_id end;

  if tg_op = 'INSERT' then
    select created_at into v_created_at from public.vendas where id=v_venda_id;
    if v_created_at is not null and v_created_at >= now() - interval '10 seconds' then
      return new;
    end if;

    v_label := coalesce(nullif(new.numero,''), new.produto, new.tipo_produto, 'linha');
    insert into public.venda_historico(venda_id,tipo,campo,valor_novo,descricao,user_id,user_nome)
    values(v_venda_id,'campo'::public.historico_tipo_enum,'linha',v_label,'Linha adicionada: '||v_label,v_user,v_nome);
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_label := coalesce(nullif(old.numero,''), old.produto, old.tipo_produto, 'linha');
    insert into public.venda_historico(venda_id,tipo,campo,valor_anterior,descricao,user_id,user_nome)
    values(v_venda_id,'campo'::public.historico_tipo_enum,'linha',v_label,'Linha removida: '||v_label,v_user,v_nome);
    return old;
  end if;

  v_label := coalesce(nullif(new.numero,''), nullif(old.numero,''), new.produto, old.produto, new.tipo_produto, old.tipo_produto, 'linha');

  for v_key, v_old, v_new in
    select
      n.key,
      case when o.value is null or o.value = 'null'::jsonb then null else o.value #>> '{}' end,
      case when n.value is null or n.value = 'null'::jsonb then null else n.value #>> '{}' end
    from jsonb_each(to_jsonb(new)) n
    left join jsonb_each(to_jsonb(old)) o on o.key=n.key
    where n.value is distinct from o.value
      and n.key not in (
        'id','venda_id','created_at','updated_at','created_by',
        'plano_catalogo_id','plano_oferta_id',
        'passaporte_produto_id','passaporte_plano_oferta_id'
      )
  loop
    insert into public.venda_historico(
      venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome
    ) values (
      v_venda_id,
      'campo'::public.historico_tipo_enum,
      'linha.'||v_key,
      v_old,
      v_new,
      'Linha '||v_label||': '||
        case v_key
          when 'ddd' then 'DDD'
          when 'numero' then 'Número'
          when 'produto' then 'Produto'
          when 'tipo_produto' then 'Tipo de produto'
          when 'plano' then 'Plano'
          when 'valor_mensal' then 'Valor mensal'
          when 'passaporte_plano' then 'Passaporte'
          when 'passaporte_valor' then 'Valor do passaporte'
          when 'operadora_doadora' then 'Operadora doadora'
          when 'descricao_adicional' then 'Descrição'
          when 'nome_aparelho' then 'Aparelho'
          when 'possui_bonus' then 'Bônus'
          when 'bonus_gb' then 'Bônus GB'
          else initcap(replace(v_key,'_',' '))
        end || ' alterado',
      v_user,
      v_nome
    );
  end loop;

  return new;
end;
$function$;

create or replace function public.log_venda_historico()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_nome text;
  v_status_final text;
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
      values (new.id, 'etapa', 'etapa_id', old.etapa_id, new.etapa_id, 'Etapa alterada', v_user, v_nome);
    end if;

    if new.funil is distinct from old.funil then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (new.id, 'funil', 'funil', old.funil::text, new.funil::text, 'Funil alterado', v_user, v_nome);
    end if;

    if new.valor is distinct from old.valor then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (new.id, 'valor', 'valor', old.valor::text, new.valor::text, 'Valor do pedido alterado', v_user, v_nome);
    end if;

    if new.consultor_id is distinct from old.consultor_id then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (new.id, 'consultor', 'consultor_id', old.consultor_nome, new.consultor_nome, 'Consultor responsável alterado', v_user, v_nome);
    end if;

    if new.bko_colab_id is distinct from old.bko_colab_id or new.bko_nome is distinct from old.bko_nome then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (new.id, 'bko', 'bko_nome', old.bko_nome, new.bko_nome, 'BKO responsável alterado', v_user, v_nome);
    end if;

    if new.tipo_pedidos is distinct from old.tipo_pedidos then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (new.id,'campo','tipo_pedidos',array_to_string(old.tipo_pedidos,' | '),array_to_string(new.tipo_pedidos,' | '),'Tipos de pedido alterados',v_user,v_nome);
    end if;

    if new.produtos is distinct from old.produtos then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (new.id,'campo','produtos',array_to_string(old.produtos,' | '),array_to_string(new.produtos,' | '),'Produtos do pedido alterados',v_user,v_nome);
    end if;

    if new.cedente_id is distinct from old.cedente_id then
      insert into public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      values (new.id,'campo','cedente_id',old.cedente_id::text,new.cedente_id::text,'Cedente do pedido alterado',v_user,v_nome);
    end if;

    if new.numero is distinct from old.numero then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','numero',old.numero,new.numero,'Número do pedido alterado',v_user,v_nome);
    end if;

    if new.cliente_razao_social is distinct from old.cliente_razao_social then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','cliente_razao_social',old.cliente_razao_social,new.cliente_razao_social,'Razão social alterada',v_user,v_nome);
    end if;

    if new.cliente_cnpj is distinct from old.cliente_cnpj then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','cliente_cnpj',old.cliente_cnpj,new.cliente_cnpj,'CNPJ/CPF alterado',v_user,v_nome);
    end if;

    if new.cliente_contato is distinct from old.cliente_contato then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','cliente_contato',old.cliente_contato,new.cliente_contato,'Contato alterado',v_user,v_nome);
    end if;

    if new.cliente_telefone is distinct from old.cliente_telefone then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','cliente_telefone',old.cliente_telefone,new.cliente_telefone,'Telefone alterado',v_user,v_nome);
    end if;

    if new.cliente_email is distinct from old.cliente_email then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','cliente_email',old.cliente_email,new.cliente_email,'E-mail alterado',v_user,v_nome);
    end if;

    if new.cliente_uf is distinct from old.cliente_uf then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','cliente_uf',old.cliente_uf,new.cliente_uf,'UF alterada',v_user,v_nome);
    end if;

    if new.operadora is distinct from old.operadora then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','operadora',old.operadora::text,new.operadora::text,'Operadora alterada',v_user,v_nome);
    end if;

    if new.status is distinct from old.status then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','status',old.status,new.status,'Status alterado',v_user,v_nome);
    end if;

    if new.status_pedido is distinct from old.status_pedido then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','status_pedido',old.status_pedido,new.status_pedido,'Status do pedido alterado',v_user,v_nome);
    end if;

    if new.status_biometria is distinct from old.status_biometria then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','status_biometria',old.status_biometria,new.status_biometria,'Biometria alterada',v_user,v_nome);
    end if;

    if new.data_recebimento is distinct from old.data_recebimento then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','data_recebimento',old.data_recebimento::text,new.data_recebimento::text,'Data de recebimento alterada',v_user,v_nome);
    end if;
    if new.data_preenchimento is distinct from old.data_preenchimento then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','data_preenchimento',old.data_preenchimento::text,new.data_preenchimento::text,'Data de preenchimento alterada',v_user,v_nome);
    end if;
    if new.data_envio is distinct from old.data_envio then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','data_envio',old.data_envio::text,new.data_envio::text,'Data de envio alterada',v_user,v_nome);
    end if;
    if new.data_aceite is distinct from old.data_aceite then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','data_aceite',old.data_aceite::text,new.data_aceite::text,'Data de aceite alterada',v_user,v_nome);
    end if;
    if new.data_input is distinct from old.data_input then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','data_input',old.data_input::text,new.data_input::text,'Data de input alterada',v_user,v_nome);
    end if;
    if new.data_ativacao is distinct from old.data_ativacao then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','data_ativacao',old.data_ativacao::text,new.data_ativacao::text,'Data de ativação alterada',v_user,v_nome);
    end if;
    if new.data_portabilidade is distinct from old.data_portabilidade then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','data_portabilidade',old.data_portabilidade::text,new.data_portabilidade::text,'Data de portabilidade alterada',v_user,v_nome);
    end if;
    if new.data_entrega is distinct from old.data_entrega then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'campo','data_entrega',old.data_entrega::text,new.data_entrega::text,'Data de entrega/instalação alterada',v_user,v_nome);
    end if;

    if new.observacao is distinct from old.observacao then
      insert into public.venda_historico (venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values (new.id,'observacao','observacao',old.observacao,new.observacao,'Observação do pedido alterada',v_user,v_nome);
    end if;

    if old.concluido_em is null
       and new.concluido_em is not null
       and new.concluido_por is null
       and new.funil::text='assinatura'
       and new.etapa_id='a-assinado' then
      if nullif(btrim(coalesce(new.status_pedido,'')), '') is not null
         and nullif(btrim(coalesce(new.status_comercial_nome,'')), '') is not null then
        if new.status_pedido_em is not null
           and (new.status_comercial_em is null or new.status_pedido_em >= new.status_comercial_em) then
          v_status_final := new.status_pedido;
        else
          v_status_final := new.status_comercial_nome;
        end if;
      elsif nullif(btrim(coalesce(new.status_pedido,'')), '') is not null then
        v_status_final := new.status_pedido;
      else
        v_status_final := new.status_comercial_nome;
      end if;

      insert into public.venda_historico(
        venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome
      ) values (
        new.id,
        'campo'::public.historico_tipo_enum,
        'concluido_em',
        null,
        new.concluido_em::text,
        'Pedido concluído automaticamente após status final "' ||
          coalesce(v_status_final,'não informado') ||
          '". Origem: Assinatura → Contrato Assinado.',
        null,
        'Automação OMNI'
      );
    end if;

    return new;
  end if;

  return new;
end;
$function$;
