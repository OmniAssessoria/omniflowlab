-- Reabertura comercial: retorna ao primeiro funil/etapa comercial ativo, sem escolha manual.
create or replace function public.pipeline_reabrir_venda(p_venda_id uuid)
returns table(funil_id text, etapa_id text, funil_nome text, etapa_nome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_target_funil_id text;
  v_target_funil_nome text;
  v_target_etapa_id text;
  v_target_etapa_nome text;
  v_old_funil_nome text;
  v_old_etapa_nome text;
  v_user_nome text;
  v_roles text;
  v_broad boolean;
  v_consultor boolean;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  v_broad := public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'gestor'::public.app_role)
    or public.has_role(v_user_id, 'bko'::public.app_role);
  v_consultor := public.has_role(v_user_id, 'consultor'::public.app_role);

  if not v_broad and not v_consultor then
    raise exception '403: perfil sem permissão para reabrir pedidos comerciais.';
  end if;

  select * into v_venda
  from public.vendas
  where id = p_venda_id
  for update;

  if not found or v_venda.deleted_at is not null or coalesce(v_venda.is_deleted, false) then
    raise exception 'Pedido não encontrado.';
  end if;
  if v_venda.concluido_em is null then
    raise exception 'Pedido não está concluído.';
  end if;
  if coalesce(v_venda.status_pedido, '') in ('cancelado', 'reprovado') then
    raise exception 'Pedido cancelado ou reprovado não pode ser reaberto por esta ação.';
  end if;
  if v_consultor and not v_broad and v_venda.consultor_id is distinct from v_user_id then
    raise exception '403: consultor sem acesso a este pedido.';
  end if;

  select d.funil_id, d.etapa_id
    into v_target_funil_id, v_target_etapa_id
  from public.pipeline_resolve_initial_destination() d;

  if v_target_funil_id is null or v_target_etapa_id is null then
    raise exception 'Não há destino comercial ativo disponível para reabertura.';
  end if;

  select f.nome, e.nome
    into v_target_funil_nome, v_target_etapa_nome
  from public.pipeline_funis f
  join public.pipeline_etapas e on e.funil_id = f.id
  where f.id = v_target_funil_id
    and e.id = v_target_etapa_id
    and f.ativo
    and f.participa_fluxo_comercial
    and e.ativo
  for share of f, e;

  if not found then
    raise exception 'Destino comercial de reabertura deixou de estar disponível.';
  end if;

  select nome into v_old_funil_nome from public.pipeline_funis where id = v_venda.funil::text;
  select nome into v_old_etapa_nome from public.pipeline_etapas where id = v_venda.etapa_id;
  select coalesce(nome_completo, email, 'Usuário') into v_user_nome from public.profiles where id = v_user_id;
  select coalesce(string_agg(role::text, ', ' order by role::text), 'sem_perfil') into v_roles
  from public.user_roles where user_id = v_user_id;

  update public.vendas
  set funil = v_target_funil_id::public.funil_enum,
      etapa_id = v_target_etapa_id,
      concluido_em = null,
      concluido_por = null,
      dias_na_etapa = 0
  where id = p_venda_id;

  insert into public.venda_historico(
    venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome
  ) values (
    p_venda_id,
    'funil'::public.historico_tipo_enum,
    'reabertura_pipeline',
    v_venda.funil::text || ' / ' || v_venda.etapa_id || ' / concluído',
    v_target_funil_id || ' / ' || v_target_etapa_id,
    'Pedido comercial reaberto. Perfil: ' || v_roles || E'\nOrigem concluída: ' ||
      coalesce(v_old_funil_nome, v_venda.funil::text) || ' → ' || coalesce(v_old_etapa_nome, v_venda.etapa_id) ||
      E'\nDestino automático: ' || v_target_funil_nome || ' → ' || v_target_etapa_nome,
    v_user_id,
    coalesce(v_user_nome, 'Usuário')
  );

  return query select v_target_funil_id, v_target_etapa_id, v_target_funil_nome, v_target_etapa_nome;
end;
$$;

revoke all on function public.pipeline_reabrir_venda(uuid) from public, anon;
grant execute on function public.pipeline_reabrir_venda(uuid) to authenticated;
