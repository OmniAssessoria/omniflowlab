-- Edição isolada da observação comercial da venda.
-- Libera ADM/BKO/Gestor e apenas o Consultor responsável.
-- Não concede permissão para status, conclusão, datas ou demais campos da venda.

create or replace function public.atualizar_observacao_venda(
  p_venda_id uuid,
  p_observacao text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_observacao_nova text;
  v_user_nome text;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado';
  end if;

  select *
    into v_venda
  from public.vendas
  where id = p_venda_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_venda.deleted_at is not null or coalesce(v_venda.is_deleted, false) then
    raise exception 'Pedido excluído não pode ser alterado.';
  end if;

  if not (
    public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'bko'::public.app_role)
    or public.has_role(v_user_id, 'gestor'::public.app_role)
    or (
      public.has_role(v_user_id, 'consultor'::public.app_role)
      and v_venda.consultor_id = v_user_id
    )
  ) then
    raise exception '403: sem permissão para editar a observação desta venda.';
  end if;

  v_observacao_nova := nullif(btrim(coalesce(p_observacao, '')), '');

  if v_venda.observacao is not distinct from v_observacao_nova then
    return jsonb_build_object(
      'success', true,
      'changed', false,
      'venda_id', p_venda_id,
      'observacao', v_observacao_nova
    );
  end if;

  select coalesce(p.nome_completo, p.email, 'Usuário')
    into v_user_nome
  from public.profiles p
  where p.id = v_user_id;

  update public.vendas
  set observacao = v_observacao_nova
  where id = p_venda_id;

  insert into public.venda_historico (
    venda_id,
    tipo,
    campo,
    valor_anterior,
    valor_novo,
    descricao,
    user_id,
    user_nome
  )
  values (
    p_venda_id,
    'observacao'::public.historico_tipo_enum,
    'observacao',
    v_venda.observacao,
    v_observacao_nova,
    'Observação da venda atualizada',
    v_user_id,
    coalesce(v_user_nome, 'Usuário')
  );

  return jsonb_build_object(
    'success', true,
    'changed', true,
    'venda_id', p_venda_id,
    'observacao', v_observacao_nova
  );
end;
$function$;

grant execute on function public.atualizar_observacao_venda(uuid, text) to authenticated;
