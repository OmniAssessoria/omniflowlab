-- Operação Closer: edição das informações do pedido por Closer/BKO/Admin,
-- com histórico completo das alterações do cliente e do pedido.

-- BKO também pode corrigir os dados cadastrais exibidos dentro do pedido.
drop policy if exists closer_clientes_update on public.closer_clientes;
create policy closer_clientes_update
on public.closer_clientes
for update
to authenticated
using (
  (
    public.has_role((select auth.uid()), 'closer'::public.app_role)
    and closer_id = (select auth.uid())
  )
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
)
with check (
  (
    public.has_role((select auth.uid()), 'closer'::public.app_role)
    and closer_id = (select auth.uid())
  )
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
);

-- Guarda atualizada: produto e observação comercial podem ser corrigidos por
-- Closer, BKO e Admin. Se a troca de produto exigir reinício do fluxo, a etapa
-- pode voltar para CONTRATO no mesmo update.
create or replace function public.closer_guard_pedido_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  v_is_gestor boolean := public.has_role(auth.uid(), 'gestor'::public.app_role);
  v_is_bko boolean := public.has_role(auth.uid(), 'bko'::public.app_role);
  v_is_closer boolean := public.has_role(auth.uid(), 'closer'::public.app_role);
  v_stage_category text;
  v_stage_valid boolean;
  v_product_reset boolean := false;
begin
  if new.numero is distinct from old.numero then
    if not (v_is_admin or v_is_bko or v_is_closer) then
      raise exception 'Somente Admin, BKO ou Closer podem editar o número do pedido.';
    end if;
    if new.numero is null or new.numero <= 0 then
      raise exception 'O número do pedido deve ser maior que zero.';
    end if;
  end if;

  if new.produto is distinct from old.produto then
    if not (v_is_admin or v_is_bko or v_is_closer) then
      raise exception 'Somente Admin, BKO ou Closer podem editar o produto do pedido.';
    end if;
    if new.produto not in ('ONVOX', 'TAKE_FLOW') then
      raise exception 'Produto inválido.';
    end if;
  end if;

  v_product_reset :=
    new.produto is distinct from old.produto
    and new.etapa is distinct from old.etapa
    and new.etapa = 'CONTRATO';

  if new.etapa is distinct from old.etapa then
    if not v_is_bko and not v_is_admin and not (v_is_closer and v_product_reset) then
      raise exception 'A etapa operacional do pedido é exclusiva do BKO.';
    end if;

    v_stage_category := case new.produto
      when 'ONVOX' then 'onvox_stage'
      when 'TAKE_FLOW' then 'takeflow_stage'
      else null
    end;

    select exists (
      select 1
      from public.closer_opcoes_catalogo c
      where c.categoria = v_stage_category
        and c.valor = new.etapa
        and c.ativo
    ) into v_stage_valid;

    if not coalesce(v_stage_valid, false) then
      raise exception 'Etapa operacional inválida ou desativada para este produto.';
    end if;
  end if;

  if v_is_closer and not (v_is_admin or v_is_gestor or v_is_bko) then
    if new.cliente_id is distinct from old.cliente_id
       or new.closer_id is distinct from old.closer_id
       or new.closer_nome is distinct from old.closer_nome
       or new.bko_id is distinct from old.bko_id
       or new.bko_nome is distinct from old.bko_nome
       or (
         new.etapa is distinct from old.etapa
         and not v_product_reset
       )
       or new.data_recebimento is distinct from old.data_recebimento
       or new.data_envio is distinct from old.data_envio
       or new.data_assinatura is distinct from old.data_assinatura
       or new.data_implantacao is distinct from old.data_implantacao
       or new.data_ativacao is distinct from old.data_ativacao
       or new.data_entrega is distinct from old.data_entrega
       or new.erro is distinct from old.erro
       or new.observacao_bko is distinct from old.observacao_bko
       or new.concluido_em is distinct from old.concluido_em
       or new.cancelado_em is distinct from old.cancelado_em then
      raise exception 'Campos operacionais são exclusivos da operação responsável.';
    end if;
  end if;

  if v_is_bko and not (v_is_admin or v_is_gestor) then
    if new.cliente_id is distinct from old.cliente_id
       or new.closer_id is distinct from old.closer_id
       or new.closer_nome is distinct from old.closer_nome
       or new.receita_total is distinct from old.receita_total
       or new.take_conexoes is distinct from old.take_conexoes
       or new.take_usuarios is distinct from old.take_usuarios
       or new.take_valor_implantacao is distinct from old.take_valor_implantacao then
      raise exception 'O BKO pode alterar apenas o acompanhamento operacional e as informações do pedido.';
    end if;
  end if;

  return new;
end;
$$;

-- Histórico do cadastro do cliente vinculado ao pedido.
create or replace function public.closer_registrar_historico_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_nome text;
  v_role text;
  v_meta jsonb;
begin
  select coalesce(nome_completo, email, 'Sistema')
    into v_nome
    from public.profiles
   where id = uid;

  select role::text
    into v_role
    from public.user_roles
   where user_id = uid
   order by case role
     when 'admin' then 1
     when 'gestor' then 2
     when 'bko' then 3
     when 'closer' then 4
     else 9 end
   limit 1;

  v_meta := jsonb_build_object(
    'user_nome', coalesce(v_nome, 'Sistema'),
    'user_role', coalesce(v_role, 'sistema')
  );

  if new.razao_social is distinct from old.razao_social then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    select p.id, uid, 'cliente', 'cliente', old.razao_social, new.razao_social, v_meta
    from public.closer_pedidos p where p.cliente_id = new.id;
  end if;

  if new.cnpj is distinct from old.cnpj then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    select p.id, uid, 'cliente', 'cnpj', old.cnpj, new.cnpj, v_meta
    from public.closer_pedidos p where p.cliente_id = new.id;
  end if;

  if new.contato is distinct from old.contato then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    select p.id, uid, 'cliente', 'contato', old.contato, new.contato, v_meta
    from public.closer_pedidos p where p.cliente_id = new.id;
  end if;

  if new.telefone is distinct from old.telefone then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    select p.id, uid, 'cliente', 'telefone', old.telefone, new.telefone, v_meta
    from public.closer_pedidos p where p.cliente_id = new.id;
  end if;

  if new.email is distinct from old.email then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    select p.id, uid, 'cliente', 'email', old.email, new.email, v_meta
    from public.closer_pedidos p where p.cliente_id = new.id;
  end if;

  if new.origem_lead is distinct from old.origem_lead then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    select p.id, uid, 'cliente', 'origem', old.origem_lead, new.origem_lead, v_meta
    from public.closer_pedidos p where p.cliente_id = new.id;
  end if;

  if new.razao_social is distinct from old.razao_social
     or new.cnpj is distinct from old.cnpj
     or new.contato is distinct from old.contato
     or new.telefone is distinct from old.telefone
     or new.email is distinct from old.email
     or new.origem_lead is distinct from old.origem_lead then
    update public.closer_pedidos
       set updated_at = now()
     where cliente_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.closer_registrar_historico_cliente() from public, anon, authenticated;

drop trigger if exists trg_closer_clientes_historico on public.closer_clientes;
create trigger trg_closer_clientes_historico
after update of razao_social, cnpj, contato, telefone, email, origem_lead
on public.closer_clientes
for each row execute function public.closer_registrar_historico_cliente();

-- Histórico do pedido agora inclui também a troca de produto.
create or replace function public.closer_registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_nome text;
  v_role text;
  v_meta jsonb;
begin
  select coalesce(nome_completo, email, 'Sistema')
    into v_nome
    from public.profiles
   where id = uid;

  select role::text
    into v_role
    from public.user_roles
   where user_id = uid
   order by case role
     when 'admin' then 1
     when 'gestor' then 2
     when 'bko' then 3
     when 'closer' then 4
     else 9 end
   limit 1;

  v_meta := jsonb_build_object(
    'user_nome', coalesce(v_nome, 'Sistema'),
    'user_role', coalesce(v_role, 'sistema')
  );

  if tg_op = 'INSERT' then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, valor_novo, metadata)
    values (new.id, uid, 'criacao', new.etapa, v_meta);
    return new;
  end if;

  if new.numero is distinct from old.numero then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'campo','numero',old.numero::text,new.numero::text,v_meta);
  end if;

  if new.produto is distinct from old.produto then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'campo','produto',old.produto,new.produto,v_meta);
  end if;

  if new.etapa is distinct from old.etapa then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'etapa','etapa',old.etapa,new.etapa,v_meta);
  end if;

  if new.bko_id is distinct from old.bko_id then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'bko','bko_id',old.bko_id::text,new.bko_id::text,v_meta);
  end if;

  if new.data_recebimento is distinct from old.data_recebimento then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'campo','data_recebimento',old.data_recebimento::text,new.data_recebimento::text,v_meta);
  end if;

  if new.data_envio is distinct from old.data_envio then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'campo','data_envio',old.data_envio::text,new.data_envio::text,v_meta);
  end if;

  if new.data_assinatura is distinct from old.data_assinatura then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'campo','data_assinatura',old.data_assinatura::text,new.data_assinatura::text,v_meta);
  end if;

  if new.data_implantacao is distinct from old.data_implantacao then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'campo','data_implantacao',old.data_implantacao::text,new.data_implantacao::text,v_meta);
  end if;

  if new.data_ativacao is distinct from old.data_ativacao then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'campo','data_ativacao',old.data_ativacao::text,new.data_ativacao::text,v_meta);
  end if;

  if new.data_entrega is distinct from old.data_entrega then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'campo','data_entrega',old.data_entrega::text,new.data_entrega::text,v_meta);
  end if;

  if new.erro is distinct from old.erro then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'pendencia','erro',old.erro,new.erro,v_meta);
  end if;

  if new.observacao is distinct from old.observacao then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'observacao','observacao_closer',old.observacao,new.observacao,v_meta);
  end if;

  if new.observacao_bko is distinct from old.observacao_bko then
    insert into public.closer_pedido_historico(pedido_id,user_id,tipo,campo,valor_anterior,valor_novo,metadata)
    values (new.id,uid,'observacao','observacao_bko',old.observacao_bko,new.observacao_bko,v_meta);
  end if;

  return new;
end;
$$;

-- Uma única RPC mantém cliente + pedido consistentes e grava histórico pelos triggers.
create or replace function public.closer_editar_informacoes_pedido(
  p_pedido_id uuid,
  p_razao_social text,
  p_cnpj text,
  p_contato text,
  p_telefone text,
  p_email text,
  p_origem_lead text,
  p_produto text,
  p_observacao text
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_pedido public.closer_pedidos%rowtype;
  v_stage_category text;
  v_stage text;
  v_stage_valid boolean;
  v_uid uuid := auth.uid();
  v_allowed boolean;
begin
  v_allowed :=
    public.has_role(v_uid, 'admin'::public.app_role)
    or public.has_role(v_uid, 'bko'::public.app_role)
    or public.has_role(v_uid, 'closer'::public.app_role);

  if not v_allowed then
    raise exception 'Perfil sem permissão para editar as informações do pedido.';
  end if;

  select * into v_pedido
  from public.closer_pedidos
  where id = p_pedido_id;

  if not found then
    raise exception 'Pedido não encontrado ou sem acesso.';
  end if;

  if public.has_role(v_uid, 'closer'::public.app_role)
     and not public.has_role(v_uid, 'admin'::public.app_role)
     and not public.has_role(v_uid, 'bko'::public.app_role)
     and v_pedido.closer_id <> v_uid then
    raise exception 'O Closer só pode editar os próprios pedidos.';
  end if;

  if p_produto not in ('ONVOX', 'TAKE_FLOW') then
    raise exception 'Produto inválido.';
  end if;

  if nullif(btrim(p_razao_social), '') is null
     or nullif(btrim(p_cnpj), '') is null
     or nullif(btrim(p_contato), '') is null
     or nullif(btrim(p_telefone), '') is null
     or nullif(btrim(p_email), '') is null
     or nullif(btrim(p_origem_lead), '') is null then
    raise exception 'Preencha todos os dados obrigatórios do cliente.';
  end if;

  update public.closer_clientes
     set razao_social = btrim(p_razao_social),
         cnpj = btrim(p_cnpj),
         contato = btrim(p_contato),
         telefone = btrim(p_telefone),
         email = lower(btrim(p_email)),
         origem_lead = btrim(p_origem_lead)
   where id = v_pedido.cliente_id;

  v_stage := v_pedido.etapa;

  if p_produto is distinct from v_pedido.produto then
    v_stage_category := case p_produto
      when 'ONVOX' then 'onvox_stage'
      when 'TAKE_FLOW' then 'takeflow_stage'
    end;

    select exists (
      select 1
      from public.closer_opcoes_catalogo c
      where c.categoria = v_stage_category
        and c.valor = v_stage
        and c.ativo
    ) into v_stage_valid;

    if not coalesce(v_stage_valid, false) then
      v_stage := 'CONTRATO';
    end if;
  end if;

  update public.closer_pedidos
     set produto = p_produto,
         etapa = v_stage,
         observacao = nullif(btrim(p_observacao), ''),
         updated_by = v_uid
   where id = p_pedido_id;
end;
$$;

revoke all on function public.closer_editar_informacoes_pedido(uuid,text,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.closer_editar_informacoes_pedido(uuid,text,text,text,text,text,text,text,text) to authenticated;
