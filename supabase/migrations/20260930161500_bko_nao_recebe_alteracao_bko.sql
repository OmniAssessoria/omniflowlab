-- BKO não deve receber notificações de alterações feitas por outros BKOs
-- no canal operacional CLARO/VIVO. Admin mantém visão total de alterações alheias.

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

  -- Este canal é o fluxo Telecom, identificado pela operadora da venda.
  v_marca := v_operadora;

  v_descricao := v_actor_nome || ' alterou o pedido: ' || coalesce(new.descricao, 'Alteração registrada.');

  for v_recipient in
    select distinct ur.user_id
    from public.user_roles ur
    where ur.user_id <> new.user_id
      and (
        ur.role = 'admin'
        or (ur.role = 'bko' and v_actor_role <> 'bko')
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

-- Remove notificações BKO -> BKO já existentes no fluxo Telecom.
delete from public.notificacoes n
where n.canal = 'operadoras'
  and n.actor_role = 'bko'
  and exists (
    select 1
    from public.user_roles ur
    where ur.user_id = n.user_id
      and ur.role = 'bko'
  );
