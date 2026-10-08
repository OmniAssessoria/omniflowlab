create unique index if not exists uq_tipos_pedido_catalogo_operadora_nome_ativo
  on public.tipos_pedido_catalogo (operadora, lower(btrim(nome)))
  where ativo = true;

create or replace function public.rename_tipo_produto_catalogo(
  p_item_id uuid,
  p_novo_nome text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_operadora text;
  v_nome_anterior text;
  v_novo_nome text := btrim(coalesce(p_novo_nome, ''));
  v_linhas_atualizadas integer := 0;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'bko'::public.app_role)
  ) then
    raise exception '403: somente Admin ou BKO podem renomear Tipo de Produto.';
  end if;

  if length(v_novo_nome) < 1 or length(v_novo_nome) > 160 then
    raise exception 'Informe um nome de Tipo de Produto com até 160 caracteres.';
  end if;

  select operadora, nome
    into v_operadora, v_nome_anterior
  from public.tipos_pedido_catalogo
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Tipo de Produto não encontrado.';
  end if;

  if lower(btrim(v_nome_anterior)) = lower(v_novo_nome) then
    update public.tipos_pedido_catalogo
    set nome = v_novo_nome
    where id = p_item_id;

    return jsonb_build_object(
      'operadora', v_operadora,
      'nome_anterior', v_nome_anterior,
      'nome_novo', v_novo_nome,
      'linhas_atualizadas', 0
    );
  end if;

  if exists (
    select 1
    from public.tipos_pedido_catalogo
    where operadora = v_operadora
      and ativo = true
      and id <> p_item_id
      and lower(btrim(nome)) = lower(v_novo_nome)
  ) then
    raise exception 'Já existe um Tipo de Produto ativo com esse nome para %.', v_operadora;
  end if;

  update public.tipos_pedido_catalogo
  set nome = v_novo_nome
  where id = p_item_id;

  update public.venda_linhas vl
  set tipo_produto = v_novo_nome
  from public.vendas v
  where v.id = vl.venda_id
    and v.operadora::text = v_operadora
    and vl.tipo_produto = v_nome_anterior;

  get diagnostics v_linhas_atualizadas = row_count;

  return jsonb_build_object(
    'operadora', v_operadora,
    'nome_anterior', v_nome_anterior,
    'nome_novo', v_novo_nome,
    'linhas_atualizadas', v_linhas_atualizadas
  );
end;
$$;

revoke all on function public.rename_tipo_produto_catalogo(uuid, text) from public;
grant execute on function public.rename_tipo_produto_catalogo(uuid, text) to authenticated;
