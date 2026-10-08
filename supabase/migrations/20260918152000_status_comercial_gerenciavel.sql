-- Status Comercial passa a ter nome/SLA por operadora.
-- O catálogo-base mantém a identidade histórica; nome, SLA e ativação operacional
-- passam a viver em status_comercial_operadoras.

alter table public.status_comercial_operadoras
  add column if not exists nome text,
  add column if not exists is_final boolean not null default false;

update public.status_comercial_operadoras o
set nome = c.nome
from public.status_comercial_catalogo c
where c.id = o.status_id
  and (o.nome is null or btrim(o.nome) = '');

alter table public.status_comercial_operadoras
  alter column nome set not null;

update public.status_comercial_operadoras o
set is_final = true
from public.status_comercial_catalogo c
where c.id = o.status_id
  and (
    (o.operadora = 'CLARO'::public.operadora_enum and c.nome = 'MV - ATIVADO 100%')
    or
    (o.operadora = 'VIVO'::public.operadora_enum and c.nome = 'MV - LOGÍSTICA CONCLUÍDA')
  );

create unique index if not exists uq_status_comercial_nome_operadora_ativo
  on public.status_comercial_operadoras (operadora, lower(nome))
  where ativo = true;

create or replace function public.audit_status_comercial_operadora_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status_id uuid;
  v_operadora text;
  v_status_nome text;
  v_action text;
  v_before jsonb;
  v_after jsonb;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE'
     and old.nome is not distinct from new.nome
     and old.sla_horas is not distinct from new.sla_horas
     and old.ativo is not distinct from new.ativo
     and old.is_final is not distinct from new.is_final then
    return new;
  end if;

  v_status_id := case when tg_op = 'DELETE' then old.status_id else new.status_id end;
  v_operadora := case when tg_op = 'DELETE' then old.operadora::text else new.operadora::text end;
  v_status_nome := case when tg_op = 'DELETE' then old.nome else new.nome end;

  if tg_op = 'INSERT' then
    v_action := 'status_comercial_criado';
    v_before := null;
    v_after := jsonb_build_object(
      'status', new.nome,
      'operadora', new.operadora::text,
      'sla_horas', new.sla_horas,
      'ativo', new.ativo,
      'finalizador', new.is_final
    );
  elsif tg_op = 'DELETE' then
    v_action := 'status_comercial_excluido';
    v_before := jsonb_build_object(
      'status', old.nome,
      'operadora', old.operadora::text,
      'sla_horas', old.sla_horas,
      'ativo', old.ativo,
      'finalizador', old.is_final
    );
    v_after := null;
  else
    v_action := 'status_comercial_alterado';
    v_before := jsonb_build_object(
      'status', old.nome,
      'operadora', old.operadora::text,
      'sla_horas', old.sla_horas,
      'ativo', old.ativo,
      'finalizador', old.is_final
    );
    v_after := jsonb_build_object(
      'status', new.nome,
      'operadora', new.operadora::text,
      'sla_horas', new.sla_horas,
      'ativo', new.ativo,
      'finalizador', new.is_final
    );
  end if;

  insert into public.audit_logs(
    user_id, acao, descricao, entidade, entidade_id, valor_anterior, valor_novo
  ) values (
    auth.uid(),
    v_action,
    coalesce(v_status_nome, 'Status Comercial') || ' · ' || v_operadora,
    'status_comercial_operadora',
    v_status_id::text || ':' || v_operadora,
    v_before,
    v_after
  );

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.prepare_status_comercial_historico()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status_nome text;
  v_actor_nome text;
  v_operadora public.operadora_enum;
  v_sla_horas integer;
  v_missing text[] := array[]::text[];
  v_status_final boolean := false;
begin
  if auth.uid() is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode alterar Status Comercial.';
  end if;

  select v.operadora into v_operadora
  from public.vendas v
  where v.id = new.venda_id
    and v.deleted_at is null
    and not coalesce(v.is_deleted, false);

  if v_operadora is null then
    raise exception 'Pedido não encontrado.';
  end if;

  select sco.nome, sco.sla_horas, sco.is_final
    into v_status_nome, v_sla_horas, v_status_final
  from public.status_comercial_catalogo c
  join public.status_comercial_operadoras sco
    on sco.status_id = c.id
   and sco.operadora = v_operadora
   and sco.ativo = true
  where c.id = new.status_id
    and c.ativo = true;

  if v_status_nome is null then
    raise exception 'Status Comercial não disponível para a operadora %.', v_operadora;
  end if;

  if v_status_final then
    select array_remove(array[
      case when v.data_recebimento is null then 'Recebimento' end,
      case when v.data_preenchimento is null then 'Preenchimento' end,
      case when v.data_aceite is null then 'Aceite' end,
      case when v.data_input is null then 'Input' end,
      case when v.data_ativacao is null then 'Ativação' end
    ], null)
    into v_missing
    from public.vendas v
    where v.id = new.venda_id;

    if coalesce(array_length(v_missing, 1), 0) > 0 then
      raise exception 'ATIVADO_100_DATAS_PENDENTES:%', array_to_string(v_missing, '|');
    end if;
  end if;

  select coalesce(p.nome_completo, p.email) into v_actor_nome
  from public.profiles p
  where p.id = auth.uid();

  new.status_nome_snapshot := v_status_nome;
  new.user_id := auth.uid();
  new.user_nome := coalesce(v_actor_nome, auth.jwt() ->> 'email', 'Sistema');
  new.user_role := case when public.has_role(auth.uid(), 'admin'::public.app_role) then 'admin' else 'bko' end;
  new.operadora_snapshot := v_operadora;
  new.sla_horas_snapshot := v_sla_horas;
  new.created_at := coalesce(new.created_at, now());
  new.sla_inicio_em := case when v_sla_horas is null then null else new.created_at end;
  new.sla_metade_em := case when v_sla_horas is null then null else new.created_at + make_interval(secs => v_sla_horas * 1800.0) end;
  new.sla_limite_em := case when v_sla_horas is null then null else new.created_at + make_interval(hours => v_sla_horas) end;

  return new;
end;
$$;

create or replace function public.criar_status_comercial(
  p_nome text,
  p_operadoras text[],
  p_sla_horas integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := btrim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g'));
  v_ops text[];
  v_op_text text;
  v_op public.operadora_enum;
  v_status_id uuid;
  v_ordem integer;
begin
  if auth.uid() is null then
    raise exception '401: usuário não autenticado.';
  end if;
  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode criar Status Comercial.';
  end if;

  if v_nome = '' then
    raise exception 'Informe o nome do Status Comercial.';
  end if;
  if p_sla_horas is not null and p_sla_horas <= 0 then
    raise exception 'SLA deve ser maior que zero ou vazio para Sem SLA.';
  end if;

  select array_agg(distinct upper(btrim(x)))
  into v_ops
  from unnest(coalesce(p_operadoras, array[]::text[])) x
  where btrim(x) <> '';

  if coalesce(cardinality(v_ops),0) = 0 then
    raise exception 'Selecione ao menos uma operadora.';
  end if;

  foreach v_op_text in array v_ops loop
    if v_op_text not in ('CLARO','VIVO') then
      raise exception 'Operadora inválida: %', v_op_text;
    end if;
    v_op := v_op_text::public.operadora_enum;

    if exists (
      select 1
      from public.status_comercial_operadoras o
      where o.operadora = v_op
        and o.ativo = true
        and lower(btrim(o.nome)) = lower(v_nome)
    ) then
      raise exception 'Já existe um Status Comercial chamado "%" na %.', v_nome, v_op_text;
    end if;
  end loop;

  select coalesce(max(ordem),0) + 10 into v_ordem
  from public.status_comercial_catalogo;

  insert into public.status_comercial_catalogo(nome, ordem, ativo)
  values(v_nome, v_ordem, true)
  returning id into v_status_id;

  foreach v_op_text in array v_ops loop
    insert into public.status_comercial_operadoras(
      status_id, operadora, nome, sla_horas, ativo, is_final, updated_at
    ) values (
      v_status_id,
      v_op_text::public.operadora_enum,
      v_nome,
      p_sla_horas,
      true,
      false,
      now()
    );
  end loop;

  return jsonb_build_object(
    'status_id', v_status_id,
    'nome', v_nome,
    'operadoras', v_ops,
    'sla_horas', p_sla_horas
  );
end;
$$;

create or replace function public.atualizar_status_comercial(
  p_status_id uuid,
  p_operadora text,
  p_nome text,
  p_sla_horas integer default null,
  p_ativo boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := btrim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g'));
  v_op public.operadora_enum;
begin
  if auth.uid() is null then
    raise exception '401: usuário não autenticado.';
  end if;
  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode editar Status Comercial.';
  end if;

  if upper(btrim(coalesce(p_operadora,''))) not in ('CLARO','VIVO') then
    raise exception 'Operadora inválida.';
  end if;
  v_op := upper(btrim(p_operadora))::public.operadora_enum;

  if v_nome = '' then
    raise exception 'Informe o nome do Status Comercial.';
  end if;
  if p_sla_horas is not null and p_sla_horas <= 0 then
    raise exception 'SLA deve ser maior que zero ou vazio para Sem SLA.';
  end if;

  if not exists (
    select 1
    from public.status_comercial_operadoras
    where status_id = p_status_id and operadora = v_op
  ) then
    raise exception 'Status Comercial não encontrado para a operadora %.', v_op;
  end if;

  if p_ativo and exists (
    select 1
    from public.status_comercial_operadoras o
    where o.operadora = v_op
      and o.status_id <> p_status_id
      and o.ativo = true
      and lower(btrim(o.nome)) = lower(v_nome)
  ) then
    raise exception 'Já existe um Status Comercial chamado "%" na %.', v_nome, v_op;
  end if;

  update public.status_comercial_operadoras
  set nome = v_nome,
      sla_horas = p_sla_horas,
      ativo = p_ativo,
      updated_at = now()
  where status_id = p_status_id
    and operadora = v_op;
end;
$$;

create or replace function public.excluir_status_comercial(
  p_status_id uuid,
  p_operadora text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op public.operadora_enum;
begin
  if auth.uid() is null then
    raise exception '401: usuário não autenticado.';
  end if;
  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode excluir Status Comercial.';
  end if;

  if upper(btrim(coalesce(p_operadora,''))) not in ('CLARO','VIVO') then
    raise exception 'Operadora inválida.';
  end if;
  v_op := upper(btrim(p_operadora))::public.operadora_enum;

  delete from public.status_comercial_operadoras
  where status_id = p_status_id
    and operadora = v_op;

  if not found then
    raise exception 'Status Comercial não encontrado para a operadora %.', v_op;
  end if;

  if not exists (
    select 1 from public.status_comercial_operadoras
    where status_id = p_status_id
  ) then
    update public.status_comercial_catalogo
    set ativo = false
    where id = p_status_id;
  end if;
end;
$$;

revoke all on function public.criar_status_comercial(text,text[],integer) from public;
revoke all on function public.atualizar_status_comercial(uuid,text,text,integer,boolean) from public;
revoke all on function public.excluir_status_comercial(uuid,text) from public;
grant execute on function public.criar_status_comercial(text,text[],integer) to authenticated;
grant execute on function public.atualizar_status_comercial(uuid,text,text,integer,boolean) to authenticated;
grant execute on function public.excluir_status_comercial(uuid,text) to authenticated;
