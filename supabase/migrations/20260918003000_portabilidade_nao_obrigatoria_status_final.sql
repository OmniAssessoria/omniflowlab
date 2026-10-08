-- Portabilidade deixa de ser obrigatória para o marco comercial final.
-- Permanecem obrigatórias: Recebimento, Preenchimento, Aceite, Input e Ativação.
-- Portabilidade e Entrega/Instalação continuam disponíveis para preenchimento,
-- mas não bloqueiam a finalização da CLARO nem da VIVO.

create or replace function public.prepare_status_comercial_historico()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_catalog_nome text;
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

  select c.nome, sco.sla_horas into v_catalog_nome, v_sla_horas
  from public.status_comercial_catalogo c
  join public.status_comercial_operadoras sco
    on sco.status_id = c.id
   and sco.operadora = v_operadora
   and sco.ativo = true
  where c.id = new.status_id and c.ativo = true;

  if v_catalog_nome is null then
    raise exception 'Status Comercial não disponível para a operadora %.', v_operadora;
  end if;

  v_status_final := (
    (v_operadora = 'CLARO'::public.operadora_enum and v_catalog_nome = 'MV - ATIVADO 100%')
    or
    (v_operadora = 'VIVO'::public.operadora_enum and v_catalog_nome = 'MV - LOGÍSTICA CONCLUÍDA')
  );

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
  from public.profiles p where p.id = auth.uid();

  new.status_nome_snapshot := v_catalog_nome;
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

revoke all on function public.prepare_status_comercial_historico() from public;
