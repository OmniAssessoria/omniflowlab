-- Notificações operacionais de alterações em pedidos.
-- Distribuição:
-- Admin/BKO: todas as alterações de outros usuários.
-- Gestor: alterações feitas por Admin ou Consultor.
-- Consultor: alterações feitas por Gestor somente nos próprios pedidos.

alter table public.notificacoes
  add column if not exists actor_user_id uuid,
  add column if not exists actor_nome text,
  add column if not exists actor_role text;

drop policy if exists "user remove suas notificacoes" on public.notificacoes;
create policy "user remove suas notificacoes"
on public.notificacoes
for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.preencher_contexto_notificacao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_marca text;
  v_produtos text[];
  v_produto text;
begin
  if new.canal is null or trim(new.canal) = '' then
    new.canal := case
      when new.tipo like 'closer_%' or new.closer_pedido_id is not null then 'closer'
      else 'operadoras'
    end;
  end if;

  if new.marca is null or trim(new.marca) = '' then
    if new.closer_pedido_id is not null then
      select p.produto into v_marca
      from public.closer_pedidos p
      where p.id = new.closer_pedido_id;
    elsif new.venda_id is not null then
      select v.operadora::text, v.produtos, v.produto
        into v_marca, v_produtos, v_produto
      from public.vendas v
      where v.id = new.venda_id;

      if exists (
        select 1
        from unnest(coalesce(v_produtos, array[]::text[])) item
        where upper(btrim(item)) = 'PABX'
      ) or upper(btrim(coalesce(v_produto,''))) = 'PABX' then
        v_marca := 'PABX';
      end if;
    elsif new.ticket_id is not null then
      select t.operadora::text into v_marca
      from public.tickets t
      where t.id = new.ticket_id;
    elsif new.solicitacao_id is not null then
      select coalesce(t.operadora::text, v.operadora::text)
        into v_marca
      from public.suporte_solicitacoes s
      left join public.tickets t on t.id = s.ticket_id
      left join public.vendas v on v.id = s.venda_id
      where s.id = new.solicitacao_id;
    end if;

    new.marca := v_marca;
  end if;

  return new;
end;
$function$;

create or replace function public.notificar_alteracao_historico_venda()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor_role text;
  v_actor_nome text;
  v_numero text;
  v_consultor_id uuid;
  v_operadora text;
  v_marca text;
  v_produtos text[];
  v_produto text;
  v_recipient uuid;
  v_existing uuid;
  v_descricao text;
begin
  -- Criação já possui notificação própria. Automação/robô sem usuário humano não entra aqui.
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
    when exists(select 1 from public.user_roles where user_id=new.user_id and role='admin') then 'admin'
    when exists(select 1 from public.user_roles where user_id=new.user_id and role='bko') then 'bko'
    when exists(select 1 from public.user_roles where user_id=new.user_id and role='gestor') then 'gestor'
    when exists(select 1 from public.user_roles where user_id=new.user_id and role='consultor') then 'consultor'
    else null
  end into v_actor_role;

  if v_actor_role is null then
    return new;
  end if;

  select
    coalesce(nullif(btrim(v.numero),''), nullif(btrim(v.numero_pedido),''), 'Pedido'),
    v.consultor_id,
    v.operadora::text,
    v.produtos,
    v.produto
  into v_numero, v_consultor_id, v_operadora, v_produtos, v_produto
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

  v_descricao := v_actor_nome || ' alterou o pedido: ' || coalesce(new.descricao, 'Alteração registrada.');

  for v_recipient in
    select distinct ur.user_id
    from public.user_roles ur
    where ur.user_id <> new.user_id
      and (
        ur.role in ('admin','bko')
        or (ur.role = 'gestor' and v_actor_role in ('admin','consultor'))
        or (ur.role = 'consultor' and v_actor_role = 'gestor' and ur.user_id = v_consultor_id)
      )
  loop
    select n.id
      into v_existing
    from public.notificacoes n
    where n.user_id = v_recipient
      and n.venda_id = new.venda_id
      and n.tipo = 'pedido_alterado'
      and n.actor_user_id = new.user_id
      and n.lida = false
      and n.created_at >= now() - interval '2 seconds'
    order by n.created_at desc
    limit 1;

    if v_existing is not null then
      update public.notificacoes
      set descricao = left(v_descricao, 500),
          titulo = '[' || coalesce(v_marca,'OMNI') || '] Pedido alterado: ' || v_numero,
          actor_nome = v_actor_nome,
          actor_role = v_actor_role,
          marca = v_marca
      where id = v_existing;
    else
      insert into public.notificacoes(
        user_id, tipo, titulo, descricao, venda_id, criticidade, link,
        canal, marca, actor_user_id, actor_nome, actor_role
      ) values (
        v_recipient,
        'pedido_alterado',
        '[' || coalesce(v_marca,'OMNI') || '] Pedido alterado: ' || v_numero,
        left(v_descricao, 500),
        new.venda_id,
        'media',
        '/vendas/' || new.venda_id,
        'operadoras',
        v_marca,
        new.user_id,
        v_actor_nome,
        v_actor_role
      );
    end if;

    v_existing := null;
  end loop;

  return new;
end;
$function$;

drop trigger if exists trg_notificar_alteracao_historico_venda on public.venda_historico;
create trigger trg_notificar_alteracao_historico_venda
after insert on public.venda_historico
for each row execute function public.notificar_alteracao_historico_venda();

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
  v_campos text;
  v_created_at timestamptz;
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

    v_label := coalesce(nullif(new.numero,''), new.produto, 'linha');
    insert into public.venda_historico(venda_id,tipo,campo,valor_novo,descricao,user_id,user_nome)
    values(v_venda_id,'campo'::public.historico_tipo_enum,'linha',new.id::text,'Linha adicionada: '||v_label,v_user,v_nome);
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_label := coalesce(nullif(old.numero,''), old.produto, 'linha');
    insert into public.venda_historico(venda_id,tipo,campo,valor_anterior,descricao,user_id,user_nome)
    values(v_venda_id,'campo'::public.historico_tipo_enum,'linha',old.id::text,'Linha removida: '||v_label,v_user,v_nome);
    return old;
  end if;

  select string_agg(n.key, ', ' order by n.key)
    into v_campos
  from jsonb_each(to_jsonb(new)) n
  left join jsonb_each(to_jsonb(old)) o on o.key=n.key
  where n.value is distinct from o.value
    and n.key not in ('updated_at');

  if nullif(v_campos,'') is not null then
    v_label := coalesce(nullif(new.numero,''), nullif(old.numero,''), new.produto, old.produto, 'linha');
    insert into public.venda_historico(venda_id,tipo,campo,descricao,user_id,user_nome)
    values(
      v_venda_id,
      'campo'::public.historico_tipo_enum,
      'linha',
      'Linha '||v_label||' alterada ('||v_campos||').',
      v_user,
      v_nome
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_log_venda_linha_alteracao on public.venda_linhas;
create trigger trg_log_venda_linha_alteracao
after insert or update or delete on public.venda_linhas
for each row execute function public.log_venda_linha_alteracao();

create or replace function public.log_venda_linha_cedente_alteracao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_nome text;
  v_venda_id uuid;
  v_linha text;
  v_cedente text;
  v_linha_id uuid;
  v_cedente_id uuid;
begin
  if v_user is null then
    return case when tg_op='DELETE' then old else new end;
  end if;

  v_linha_id := case when tg_op='DELETE' then old.linha_id else new.linha_id end;
  v_cedente_id := case when tg_op='DELETE' then old.cedente_id else new.cedente_id end;

  select vl.venda_id, coalesce(nullif(vl.numero,''), vl.produto, 'linha')
    into v_venda_id, v_linha
  from public.venda_linhas vl
  where vl.id = v_linha_id;

  select coalesce(nullif(c.razao_social,''), nullif(c.nome,''), c.cnpj_cpf, 'Cedente')
    into v_cedente
  from public.cedentes c
  where c.id = v_cedente_id;

  select nome_completo into v_nome from public.profiles where id = v_user;

  if v_venda_id is not null then
    insert into public.venda_historico(venda_id,tipo,campo,descricao,user_id,user_nome)
    values(
      v_venda_id,
      'campo'::public.historico_tipo_enum,
      'cedente_linha',
      case
        when tg_op='DELETE' then 'Cedente removido da linha '||v_linha||': '||coalesce(v_cedente,'Cedente')
        when tg_op='UPDATE' then 'Cedente alterado na linha '||v_linha||': '||coalesce(v_cedente,'Cedente')
        else 'Cedente vinculado à linha '||v_linha||': '||coalesce(v_cedente,'Cedente')
      end,
      v_user,
      v_nome
    );
  end if;

  return case when tg_op='DELETE' then old else new end;
end;
$function$;

drop trigger if exists trg_log_venda_linha_cedente_alteracao on public.venda_linha_doadores;
create trigger trg_log_venda_linha_cedente_alteracao
after insert or update or delete on public.venda_linha_doadores
for each row execute function public.log_venda_linha_cedente_alteracao();

create or replace function public.notify_nova_venda()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_numero_exibicao text;
  v_actor_nome text;
  v_actor_role text;
  v_marca text;
begin
  v_numero_exibicao := coalesce(
    nullif(btrim(new.numero),''),
    case when new.created_by is null then 'VND-Não informado' else 'OMN-Não informado' end
  );

  select coalesce(p.nome_completo, 'Usuário') into v_actor_nome
  from public.profiles p
  where p.id = auth.uid();

  select case
    when exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin') then 'admin'
    when exists(select 1 from public.user_roles where user_id=auth.uid() and role='bko') then 'bko'
    when exists(select 1 from public.user_roles where user_id=auth.uid() and role='gestor') then 'gestor'
    when exists(select 1 from public.user_roles where user_id=auth.uid() and role='consultor') then 'consultor'
    else null
  end into v_actor_role;

  v_marca := new.operadora::text;
  if exists (
    select 1 from unnest(coalesce(new.produtos,array[]::text[])) item
    where upper(btrim(item))='PABX'
  ) or upper(btrim(coalesce(new.produto,'')))='PABX' then
    v_marca := 'PABX';
  end if;

  insert into public.notificacoes(
    user_id,tipo,titulo,descricao,venda_id,criticidade,link,
    canal,marca,actor_user_id,actor_nome,actor_role
  )
  select distinct
    ur.user_id,
    'nova_venda',
    '['||coalesce(v_marca,'OMNI')||'] Nova venda: ' || v_numero_exibicao,
    new.cliente_razao_social || ' (' || new.operadora || ')' ||
      case when v_actor_nome is not null then ' · Criada por '||v_actor_nome else '' end,
    new.id,
    'info',
    '/vendas/' || new.id,
    'operadoras',
    v_marca,
    auth.uid(),
    v_actor_nome,
    v_actor_role
  from public.user_roles ur
  where ur.role in ('admin','gestor','bko')
    and (auth.uid() is null or ur.user_id <> auth.uid());

  return new;
end;
$function$;
