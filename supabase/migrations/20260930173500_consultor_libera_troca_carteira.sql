create or replace function public.pipeline_move_venda(p_venda_id uuid, p_etapa_id text)
returns table(funil_id text, etapa_id text, funil_nome text, etapa_nome text)
language plpgsql
security definer
set search_path to 'public'
as $function$
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
  v_allowed_consultor_processos_bko text[] := array['bko-pendente','bko-montar','bko-apoio','bko-troca'];
  v_allowed_consultor_assinatura text[] := array['a-d1','a-d2','a-d3','a-d4','a-apoio','a-assinado'];
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  v_broad := public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'gestor'::public.app_role)
    or public.has_role(v_user_id, 'bko'::public.app_role);
  v_consultor := public.has_role(v_user_id, 'consultor'::public.app_role);

  if not v_broad and not v_consultor then
    raise exception '403: perfil sem permissão para movimentar pedidos comerciais.';
  end if;

  select * into v_venda
  from public.vendas
  where id = p_venda_id
  for update;

  if not found or v_venda.deleted_at is not null or coalesce(v_venda.is_deleted, false) then
    raise exception 'Pedido não encontrado.';
  end if;

  if coalesce(v_venda.status_pedido, '') in ('cancelado', 'reprovado') then
    raise exception 'Pedido cancelado ou reprovado não pode ser movimentado.';
  end if;

  if v_venda.concluido_em is not null then
    raise exception 'Pedido concluído não pode ser movimentado nem reaberto.';
  end if;

  if v_consultor and not v_broad and v_venda.consultor_id is distinct from v_user_id then
    raise exception '403: consultor sem acesso a este pedido.';
  end if;

  select f.id, f.nome, e.id, e.nome
    into v_target_funil_id, v_target_funil_nome, v_target_etapa_id, v_target_etapa_nome
  from public.pipeline_funis f
  join public.pipeline_etapas e on e.funil_id = f.id
  where e.id = p_etapa_id
    and f.ativo
    and f.participa_fluxo_comercial
    and e.ativo
  for share of f, e;

  if not found then
    raise exception 'Destino comercial inválido ou desativado.';
  end if;

  if v_venda.funil::text = v_target_funil_id and v_venda.etapa_id = v_target_etapa_id then
    raise exception 'O pedido já está neste destino.';
  end if;

  if v_venda.operadora = 'VIVO'::public.operadora_enum and v_target_etapa_id = 'a-biometria' then
    raise exception 'Pedidos VIVO não utilizam biometria.';
  end if;

  if v_consultor and not v_broad then
    if not (
      (v_target_funil_id = 'processos_bko' and v_target_etapa_id = any(v_allowed_consultor_processos_bko))
      or
      (v_target_funil_id = 'assinatura' and v_target_etapa_id = any(v_allowed_consultor_assinatura))
    ) then
      raise exception '403: Consultor só pode mover para Pendente Consultor, Montar Pedido, Apoio Gestão, Troca de Carteira / Abertura de Caso, Dia 1/2/3/4 - Assinatura, Apoio Gestão de Assinatura ou Contrato Assinado.';
    end if;
  end if;

  select nome into v_old_funil_nome from public.pipeline_funis where id = v_venda.funil::text;
  select nome into v_old_etapa_nome from public.pipeline_etapas where id = v_venda.etapa_id;
  select coalesce(nome_completo, email, 'Usuário') into v_user_nome from public.profiles where id = v_user_id;
  select coalesce(string_agg(role::text, ', ' order by role::text), 'sem_perfil') into v_roles
  from public.user_roles where user_id = v_user_id;

  update public.vendas
  set funil = v_target_funil_id::public.funil_enum,
      etapa_id = v_target_etapa_id,
      dias_na_etapa = 0
  where id = p_venda_id;

  insert into public.venda_historico(
    venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome
  ) values (
    p_venda_id,
    'funil'::public.historico_tipo_enum,
    'movimentacao_pipeline',
    v_venda.funil::text || ' / ' || v_venda.etapa_id,
    v_target_funil_id || ' / ' || v_target_etapa_id,
    'Movimentação manual confirmada no Pipeline. Perfil: ' || v_roles || E'\nOrigem: ' ||
      coalesce(v_old_funil_nome, v_venda.funil::text) || ' → ' || coalesce(v_old_etapa_nome, v_venda.etapa_id) ||
      E'\nDestino: ' || v_target_funil_nome || ' → ' || v_target_etapa_nome,
    v_user_id,
    coalesce(v_user_nome, 'Usuário')
  );

  return query
  select v_target_funil_id, v_target_etapa_id, v_target_funil_nome, v_target_etapa_nome;
end;
$function$;

revoke all on function public.pipeline_move_venda(uuid,text) from public, anon;
grant execute on function public.pipeline_move_venda(uuid,text) to authenticated;
