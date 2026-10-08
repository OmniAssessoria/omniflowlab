-- Conclusão automática do pedido por Operadora + Produto.
-- Regras:
-- CLARO geral -> ATIVADO 100%
-- VIVO geral -> LOGÍSTICA CONCLUÍDA
-- CLARO com produto Fixa -> CONECTADO
-- VIVO com produto Fixa -> INSTALADO
-- A conclusão só ocorre em Assinatura -> Contrato Assinado.

create or replace function public.pipeline_auto_concluir_status_final()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_status text;
  v_status_em timestamptz;
  v_norm text;
  v_expected text;
  v_tem_fixa boolean := false;
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

  v_tem_fixa :=
    lower(btrim(coalesce(new.produto,'')))='fixa'
    or exists (
      select 1
      from unnest(coalesce(new.produtos,array[]::text[])) p
      where lower(btrim(p))='fixa'
    )
    or exists (
      select 1
      from public.venda_linhas vl
      where vl.venda_id=new.id
        and lower(btrim(coalesce(vl.produto,'')))='fixa'
        and coalesce(vl.status,'ativa')<>'cancelada'
    );

  if new.operadora::text='CLARO' then
    v_expected := case when v_tem_fixa then 'CONECTADO' else 'ATIVADO100' end;
  elsif new.operadora::text='VIVO' then
    v_expected := case when v_tem_fixa then 'INSTALADO' else 'LOGISTICACONCLUIDA' end;
  else
    return new;
  end if;

  if nullif(btrim(coalesce(new.status_pedido,'')),'') is not null
     and nullif(btrim(coalesce(new.status_comercial_nome,'')),'') is not null then
    if new.status_pedido_em is not null
       and (new.status_comercial_em is null or new.status_pedido_em>=new.status_comercial_em) then
      v_status := new.status_pedido;
      v_status_em := new.status_pedido_em;
    else
      v_status := new.status_comercial_nome;
      v_status_em := new.status_comercial_em;
    end if;
  elsif nullif(btrim(coalesce(new.status_pedido,'')),'') is not null then
    v_status := new.status_pedido;
    v_status_em := new.status_pedido_em;
  else
    v_status := new.status_comercial_nome;
    v_status_em := new.status_comercial_em;
  end if;

  v_norm := regexp_replace(
    translate(
      upper(coalesce(v_status,'')),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'AAAAAEEEEIIIIOOOOOUUUUC'
    ),
    '[^A-Z0-9]+',
    '',
    'g'
  );

  if position(v_expected in v_norm)>0 then
    if v_expected='ATIVADO100' then
      new.ativado_100_em := coalesce(new.ativado_100_em,v_status_em,now());
    end if;

    new.concluido_em := coalesce(v_status_em,now());
    new.concluido_por := null;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_pipeline_auto_concluir_ativado_100_insert on public.vendas;
drop trigger if exists trg_pipeline_auto_concluir_ativado_100_update on public.vendas;
drop trigger if exists trg_pipeline_auto_concluir_status_final_insert on public.vendas;
drop trigger if exists trg_pipeline_auto_concluir_status_final_update on public.vendas;

create trigger trg_pipeline_auto_concluir_status_final_insert
before insert on public.vendas
for each row execute function public.pipeline_auto_concluir_status_final();

create trigger trg_pipeline_auto_concluir_status_final_update
before update of
  status_pedido,status_pedido_em,status_comercial_nome,status_comercial_em,
  etapa_id,funil,operadora,produto,produtos
on public.vendas
for each row execute function public.pipeline_auto_concluir_status_final();

drop function if exists public.pipeline_auto_concluir_ativado_100();

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
  select nome_completo into v_nome from public.profiles where id=v_user;

  if tg_op='INSERT' then
    insert into public.venda_historico(venda_id,tipo,descricao,user_id,user_nome)
    values(new.id,'criacao','Venda criada ('||new.operadora||' · '||new.cliente_razao_social||')',v_user,v_nome);
    return new;
  end if;

  if tg_op='UPDATE' then
    if new.etapa_id is distinct from old.etapa_id then
      insert into public.venda_historico(venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values(new.id,'etapa','etapa_id',old.etapa_id,new.etapa_id,'Etapa: '||old.etapa_id||' → '||new.etapa_id,v_user,v_nome);
    end if;

    if new.funil is distinct from old.funil then
      insert into public.venda_historico(venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values(new.id,'funil','funil',old.funil::text,new.funil::text,'Funil: '||old.funil||' → '||new.funil,v_user,v_nome);
    end if;

    if new.valor is distinct from old.valor then
      insert into public.venda_historico(venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values(new.id,'valor','valor',old.valor::text,new.valor::text,'Valor alterado',v_user,v_nome);
    end if;

    if new.consultor_id is distinct from old.consultor_id then
      insert into public.venda_historico(venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values(new.id,'consultor','consultor_id',old.consultor_id::text,new.consultor_id::text,'Consultor responsável alterado',v_user,v_nome);
    end if;

    if new.tipo_pedidos is distinct from old.tipo_pedidos then
      insert into public.venda_historico(venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values(
        new.id,'campo','tipo_pedidos',
        array_to_string(old.tipo_pedidos,' | '),
        array_to_string(new.tipo_pedidos,' | '),
        'Tipos de pedido alterados',v_user,v_nome
      );
    end if;

    if new.produtos is distinct from old.produtos then
      insert into public.venda_historico(venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values(
        new.id,'campo','produtos',
        array_to_string(old.produtos,' | '),
        array_to_string(new.produtos,' | '),
        'Produtos do pedido alterados',v_user,v_nome
      );
    end if;

    if new.cedente_id is distinct from old.cedente_id then
      insert into public.venda_historico(venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome)
      values(new.id,'campo','cedente_id',old.cedente_id::text,new.cedente_id::text,'Cedente do pedido alterado',v_user,v_nome);
    end if;

    if old.concluido_em is null
       and new.concluido_em is not null
       and new.concluido_por is null
       and new.funil::text='assinatura'
       and new.etapa_id='a-assinado' then

      if nullif(btrim(coalesce(new.status_pedido,'')),'') is not null
         and nullif(btrim(coalesce(new.status_comercial_nome,'')),'') is not null then
        if new.status_pedido_em is not null
           and (new.status_comercial_em is null or new.status_pedido_em>=new.status_comercial_em) then
          v_status_final := new.status_pedido;
        else
          v_status_final := new.status_comercial_nome;
        end if;
      elsif nullif(btrim(coalesce(new.status_pedido,'')),'') is not null then
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
        'Pedido concluído automaticamente após status final "'||
          coalesce(v_status_final,'não informado')||
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

revoke execute on function public.log_venda_historico() from public;
revoke execute on function public.log_venda_historico() from anon;
revoke execute on function public.log_venda_historico() from authenticated;

-- Reavalia pedidos abertos sem tocar em pedidos já concluídos.
update public.vendas
set status_pedido=status_pedido
where funil::text='assinatura'
  and etapa_id='a-assinado'
  and concluido_em is null
  and deleted_at is null
  and coalesce(is_deleted,false)=false;
