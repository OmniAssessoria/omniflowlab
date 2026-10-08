-- Auditoria da configuração de Status Comercial x Operadora x SLA.
-- Registra mudanças feitas por Admin/BKO sem depender de função server-side.

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
     and old.sla_horas is not distinct from new.sla_horas
     and old.ativo is not distinct from new.ativo then
    return new;
  end if;

  v_status_id := case when tg_op = 'DELETE' then old.status_id else new.status_id end;
  v_operadora := case when tg_op = 'DELETE' then old.operadora::text else new.operadora::text end;

  select nome into v_status_nome
  from public.status_comercial_catalogo
  where id = v_status_id;

  if tg_op = 'INSERT' then
    v_action := 'sla_status_criado';
    v_before := null;
    v_after := jsonb_build_object(
      'status', v_status_nome,
      'operadora', v_operadora,
      'sla_horas', new.sla_horas,
      'ativo', new.ativo
    );
  elsif tg_op = 'DELETE' then
    v_action := 'sla_status_excluido';
    v_before := jsonb_build_object(
      'status', v_status_nome,
      'operadora', v_operadora,
      'sla_horas', old.sla_horas,
      'ativo', old.ativo
    );
    v_after := null;
  else
    v_action := 'sla_status_alterado';
    v_before := jsonb_build_object(
      'status', v_status_nome,
      'operadora', old.operadora::text,
      'sla_horas', old.sla_horas,
      'ativo', old.ativo
    );
    v_after := jsonb_build_object(
      'status', v_status_nome,
      'operadora', new.operadora::text,
      'sla_horas', new.sla_horas,
      'ativo', new.ativo
    );
  end if;

  insert into public.audit_logs(
    user_id,
    acao,
    descricao,
    entidade,
    entidade_id,
    valor_anterior,
    valor_novo
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

drop trigger if exists trg_audit_status_comercial_operadora on public.status_comercial_operadoras;
create trigger trg_audit_status_comercial_operadora
after insert or update or delete on public.status_comercial_operadoras
for each row execute function public.audit_status_comercial_operadora_change();

revoke all on function public.audit_status_comercial_operadora_change() from public;
