-- Conclusão comercial terminal: preserva último funil/etapa e retira o card do Pipeline ativo.
create or replace function public.pipeline_concluir_venda(p_venda_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_now timestamptz := now();
  v_user_nome text;
  v_roles text;
  v_funil_nome text;
  v_etapa_nome text;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;
  if not (
    public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode concluir pedido comercial.';
  end if;

  select * into v_venda
  from public.vendas
  where id = p_venda_id
  for update;

  if not found or v_venda.deleted_at is not null or coalesce(v_venda.is_deleted, false) then
    raise exception 'Pedido não encontrado.';
  end if;
  if coalesce(v_venda.status_pedido, '') in ('cancelado', 'reprovado') then
    raise exception 'Pedido cancelado ou reprovado não pode ser concluído por esta ação.';
  end if;
  if v_venda.concluido_em is not null then
    raise exception 'Pedido já está concluído.';
  end if;
  if v_venda.etapa_id not in ('a-assinado', 'a-assinado-vivo') then
    raise exception 'Pedido só pode ser concluído após Contrato Assinado - Claro ou Contrato Assinado - Vivo.';
  end if;

  select nome into v_funil_nome from public.pipeline_funis where id = v_venda.funil::text;
  select nome into v_etapa_nome from public.pipeline_etapas where id = v_venda.etapa_id;
  select coalesce(nome_completo, email, 'Usuário') into v_user_nome from public.profiles where id = v_user_id;
  select coalesce(string_agg(role::text, ', ' order by role::text), 'sem_perfil') into v_roles
  from public.user_roles where user_id = v_user_id;

  update public.vendas
  set concluido_em = v_now,
      concluido_por = v_user_id
  where id = p_venda_id;

  insert into public.venda_historico(
    venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome
  ) values (
    p_venda_id,
    'campo'::public.historico_tipo_enum,
    'concluido_em',
    null,
    v_now::text,
    'Pedido comercial concluído. Perfil: ' || v_roles || E'\nOrigem preservada: ' ||
      coalesce(v_funil_nome, v_venda.funil::text) || ' → ' || coalesce(v_etapa_nome, v_venda.etapa_id),
    v_user_id,
    coalesce(v_user_nome, 'Usuário')
  );

  return v_now;
end;
$$;

revoke all on function public.pipeline_concluir_venda(uuid) from public, anon;
grant execute on function public.pipeline_concluir_venda(uuid) to authenticated;
