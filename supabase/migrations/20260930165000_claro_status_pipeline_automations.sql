-- Automações do Pipeline por Status do Pedido - somente CLARO.
-- CANCELADO é declínio operacional: não exclui o pedido.
-- VALIDAÇÃO PENDENTE -> Assinatura / Contrato Assinado
-- AGUARDANDO ACEITE -> Assinatura / Aguardando Assinatura

create or replace function public.pipeline_auto_movimentar_claro_por_status()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_status text;
begin
  if new.deleted_at is not null
     or coalesce(new.is_deleted, false)
     or new.concluido_em is not null
     or new.operadora::text <> 'CLARO'
     or new.status_pedido is not distinct from old.status_pedido then
    return new;
  end if;

  v_status := regexp_replace(
    translate(
      upper(btrim(coalesce(new.status_pedido, ''))),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'AAAAAEEEEIIIIOOOOOUUUUC'
    ),
    '[^A-Z0-9]+',
    ' ',
    'g'
  );
  v_status := regexp_replace(btrim(v_status), '\\s+', ' ', 'g');

  if v_status = 'VALIDACAO PENDENTE' then
    if not exists (
      select 1
      from public.pipeline_funis f
      join public.pipeline_etapas e on e.funil_id = f.id
      where f.id = 'assinatura'
        and f.ativo
        and f.participa_fluxo_comercial
        and e.id = 'a-assinado'
        and e.ativo
    ) then
      raise exception 'Automação CLARO: destino Assinatura → Contrato Assinado está indisponível.';
    end if;

    new.funil := 'assinatura'::public.funil_enum;
    new.etapa_id := 'a-assinado';
    new.dias_na_etapa := 0;

  elsif v_status = 'AGUARDANDO ACEITE' then
    if not exists (
      select 1
      from public.pipeline_funis f
      join public.pipeline_etapas e on e.funil_id = f.id
      where f.id = 'assinatura'
        and f.ativo
        and f.participa_fluxo_comercial
        and e.id = 'a-aguardando'
        and e.ativo
    ) then
      raise exception 'Automação CLARO: destino Assinatura → Aguardando Assinatura está indisponível.';
    end if;

    new.funil := 'assinatura'::public.funil_enum;
    new.etapa_id := 'a-aguardando';
    new.dias_na_etapa := 0;
  end if;

  -- CANCELADO não altera deleted_at/is_deleted.
  -- O frontend trata o Status como declínio e o remove apenas do Pipeline ativo.
  return new;
end;
$function$;

drop trigger if exists trg_pipeline_auto_claro_status_update on public.vendas;

create trigger trg_pipeline_auto_claro_status_update
before update of status_pedido on public.vendas
for each row
execute function public.pipeline_auto_movimentar_claro_por_status();


-- Mantém a ação "Finalizar pedido cancelado" consistente com o último Status real.
create or replace function public.pipeline_finalizar_pedido_cancelado(p_venda_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_now timestamptz := now();
  v_user_nome text;
  v_status_atual text;
  v_origem_status text;
  v_funil_nome text;
  v_etapa_nome text;
  v_robo_status text;
  v_robo_em timestamptz;
  v_status_pedido_efetivo text;
  v_status_pedido_em_efetivo timestamptz;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not public.has_role(v_user_id, 'bko'::public.app_role) then
    raise exception '403: somente BKO pode finalizar pedido cancelado.';
  end if;

  select *
    into v_venda
  from public.vendas
  where id = p_venda_id
  for update;

  if not found
     or v_venda.deleted_at is not null
     or coalesce(v_venda.is_deleted, false) then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_venda.concluido_em is not null then
    raise exception 'Pedido já está finalizado.';
  end if;

  select l.valor_novo, l.created_at
    into v_robo_status, v_robo_em
  from public.venda_robo_logs l
  where l.campo = 'status_pedido'
    and (
      l.venda_id = p_venda_id
      or (
        l.venda_id is null
        and v_venda.numero is not null
        and l.venda_numero = v_venda.numero
      )
    )
    and l.valor_novo is not null
  order by l.created_at desc, l.id desc
  limit 1;

  if v_robo_status is null then
    v_status_pedido_efetivo := v_venda.status_pedido;
    v_status_pedido_em_efetivo := v_venda.status_pedido_em;
  elsif v_robo_status is distinct from v_venda.status_pedido then
    -- Houve uma alteração humana de Status do Pedido depois do último log do robô.
    v_status_pedido_efetivo := v_venda.status_pedido;
    v_status_pedido_em_efetivo := v_venda.status_pedido_em;
  else
    v_status_pedido_efetivo := v_robo_status;
    v_status_pedido_em_efetivo := v_robo_em;
  end if;

  if nullif(btrim(v_venda.status_comercial_nome), '') is not null
     and nullif(btrim(coalesce(v_status_pedido_efetivo, '')), '') is not null then
    if coalesce(v_status_pedido_em_efetivo, '-infinity'::timestamptz)
       >= coalesce(v_venda.status_comercial_em, '-infinity'::timestamptz) then
      v_status_atual := v_status_pedido_efetivo;
      v_origem_status := case
        when v_robo_status is not null and v_robo_status is not distinct from v_status_pedido_efetivo
          then 'Robô / status do pedido'
        else 'Status do pedido manual'
      end;
    else
      v_status_atual := v_venda.status_comercial_nome;
      v_origem_status := 'Status Comercial manual';
    end if;
  elsif nullif(btrim(coalesce(v_status_pedido_efetivo, '')), '') is not null then
    v_status_atual := v_status_pedido_efetivo;
    v_origem_status := case
      when v_robo_status is not null and v_robo_status is not distinct from v_status_pedido_efetivo
        then 'Robô / status do pedido'
      else 'Status do pedido manual'
    end;
  else
    v_status_atual := v_venda.status_comercial_nome;
    v_origem_status := 'Status Comercial manual';
  end if;

  if upper(coalesce(v_status_atual, '')) not like '%CANCELAD%' then
    raise exception 'O status atual do pedido não está cancelado.';
  end if;

  select nome into v_funil_nome
  from public.pipeline_funis
  where id = v_venda.funil::text;

  select nome into v_etapa_nome
  from public.pipeline_etapas
  where id = v_venda.etapa_id;

  select coalesce(nome_completo, email, 'BKO')
    into v_user_nome
  from public.profiles
  where id = v_user_id;

  update public.vendas
  set concluido_em = v_now,
      concluido_por = v_user_id
  where id = p_venda_id;

  insert into public.venda_historico(
    venda_id,
    tipo,
    campo,
    valor_anterior,
    valor_novo,
    descricao,
    user_id,
    user_nome
  ) values (
    p_venda_id,
    'campo'::public.historico_tipo_enum,
    'concluido_em',
    null,
    v_now::text,
    'Pedido cancelado finalizado pelo BKO e removido do Pipeline ativo.'
      || E'\nStatus preservado: ' || coalesce(v_status_atual, 'Cancelado')
      || E'\nOrigem do status: ' || coalesce(v_origem_status, 'Não identificada')
      || E'\nOrigem no Pipe: ' || coalesce(v_funil_nome, v_venda.funil::text)
      || ' → ' || coalesce(v_etapa_nome, v_venda.etapa_id),
    v_user_id,
    coalesce(v_user_nome, 'BKO')
  );

  return v_now;
end;
$function$;

revoke all on function public.pipeline_finalizar_pedido_cancelado(uuid) from public, anon;
grant execute on function public.pipeline_finalizar_pedido_cancelado(uuid) to authenticated;
