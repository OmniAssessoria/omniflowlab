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

    -- Uma única ação pode gerar vários registros de histórico. Primeiro
    -- procura o pai da mesma transação para impedir notificações duplicadas.
    select n.id, n.actor_user_id, n.grupo_aberto, n.source_txid
      into v_parent, v_last_actor, v_last_open, v_last_txid
    from public.notificacoes n
    where n.user_id = v_recipient
      and n.venda_id = new.venda_id
      and n.tipo in ('pedido_alterado_grupo','pedido_alterado_importante')
      and n.source_txid = v_txid
    order by n.id desc
    limit 1;

    if v_parent is null then
      select n.id, n.actor_user_id, n.grupo_aberto, n.source_txid
        into v_parent, v_last_actor, v_last_open, v_last_txid
      from public.notificacoes n
      where n.user_id = v_recipient
        and n.venda_id = new.venda_id
        and n.tipo in ('pedido_alterado_grupo','pedido_alterado_importante')
      order by n.updated_at desc, n.created_at desc, n.id desc
      limit 1;
    end if;

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
        clock_timestamp(),
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
        updated_at = clock_timestamp(),
        item_count = greatest(v_count, 1),
        cliente_cnpj_snapshot = v_cnpj,
        cliente_razao_snapshot = v_razao
    where id = v_parent;
  end loop;

  return new;
end;
$function$;
