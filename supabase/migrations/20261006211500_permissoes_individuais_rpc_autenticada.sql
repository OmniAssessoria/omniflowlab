-- Corrige o carregamento/salvamento da tela de permissões individuais.
-- A configuração continua INERTE: não altera RLS, roles, RPCs operacionais ou regras de negócio.
-- Admin/BKO administram somente configurações de Gestor/Consultor.

create or replace function public.get_individual_permission_config(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_actor uuid := auth.uid();
  v_target_role text;
  v_profile record;
begin
  if v_actor is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_actor, 'admin'::public.app_role)
    or public.has_role(v_actor, 'bko'::public.app_role)
  ) then
    raise exception '403: somente Admin ou BKO pode administrar permissões individuais.';
  end if;

  v_target_role := case
    when public.has_role(p_user_id, 'gestor'::public.app_role) then 'gestor'
    when public.has_role(p_user_id, 'consultor'::public.app_role) then 'consultor'
    else null
  end;

  if v_target_role is null then
    raise exception 'A configuração individual existe somente para Gestor e Consultor.';
  end if;

  select id, nome_completo, email, ativo, coalesce(permissoes, '{}'::jsonb) as permissoes
    into v_profile
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  return jsonb_build_object(
    'user', jsonb_build_object(
      'id', v_profile.id,
      'nome', v_profile.nome_completo,
      'email', v_profile.email,
      'ativo', v_profile.ativo,
      'role', v_target_role
    ),
    'permissions', v_profile.permissoes
  );
end;
$function$;

revoke all on function public.get_individual_permission_config(uuid) from public, anon;
grant execute on function public.get_individual_permission_config(uuid) to authenticated;

create or replace function public.save_individual_permission_config(
  p_user_id uuid,
  p_permissions jsonb,
  p_previous_effective jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor uuid := auth.uid();
  v_actor_role text;
  v_actor_name text;
  v_actor_email text;
  v_target_name text;
  v_target_role text;
  v_existing jsonb;
  v_merged jsonb;
  v_key text;
  v_value jsonb;
  v_before jsonb;
  v_changes integer := 0;
begin
  if v_actor is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if public.has_role(v_actor, 'admin'::public.app_role) then
    v_actor_role := 'admin';
  elsif public.has_role(v_actor, 'bko'::public.app_role) then
    v_actor_role := 'bko';
  else
    raise exception '403: somente Admin ou BKO pode administrar permissões individuais.';
  end if;

  v_target_role := case
    when public.has_role(p_user_id, 'gestor'::public.app_role) then 'gestor'
    when public.has_role(p_user_id, 'consultor'::public.app_role) then 'consultor'
    else null
  end;

  if v_target_role is null then
    raise exception 'A configuração individual existe somente para Gestor e Consultor.';
  end if;

  if p_permissions is null or jsonb_typeof(p_permissions) <> 'object' then
    raise exception 'Configuração de permissões inválida.';
  end if;

  if p_previous_effective is null or jsonb_typeof(p_previous_effective) <> 'object' then
    raise exception 'Estado anterior de permissões inválido.';
  end if;

  -- Todos os valores recebidos precisam ser booleanos.
  for v_key, v_value in
    select key, value from jsonb_each(p_permissions)
  loop
    if jsonb_typeof(v_value) <> 'boolean' then
      raise exception 'Valor inválido para a permissão %.', v_key;
    end if;
  end loop;

  select
    coalesce(permissoes, '{}'::jsonb),
    coalesce(nome_completo, email, p_user_id::text)
  into v_existing, v_target_name
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Usuário não encontrado.';
  end if;

  select coalesce(nome_completo, email, v_actor::text), email
    into v_actor_name, v_actor_email
  from public.profiles
  where id = v_actor;

  v_merged := v_existing || p_permissions;

  update public.profiles
  set permissoes = v_merged,
      updated_at = now()
  where id = p_user_id;

  -- Auditoria somente das chaves cujo estado efetivo realmente mudou.
  for v_key, v_value in
    select key, value from jsonb_each(p_permissions)
  loop
    v_before := p_previous_effective -> v_key;

    if v_before is null or v_before is distinct from v_value then
      insert into public.audit_logs(
        user_id,
        user_email,
        acao,
        descricao,
        entidade,
        entidade_id,
        valor_anterior,
        valor_novo
      ) values (
        v_actor,
        v_actor_email,
        'permission_individual_update',
        v_target_name || ' | ' || v_key || ' | '
          || coalesce(v_before::text, 'null') || ' -> ' || v_value::text
          || ' | alterado por ' || coalesce(v_actor_name, v_actor_role),
        'profile_permission',
        p_user_id::text,
        jsonb_build_object('permission_key', v_key, 'enabled', v_before),
        jsonb_build_object('permission_key', v_key, 'enabled', v_value)
      );
      v_changes := v_changes + 1;
    end if;
  end loop;

  return v_changes;
end;
$function$;

revoke all on function public.save_individual_permission_config(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_individual_permission_config(uuid, jsonb, jsonb) to authenticated;
