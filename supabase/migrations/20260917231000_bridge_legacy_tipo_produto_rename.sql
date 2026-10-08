-- Mantém compatibilidade com clientes antigos: a RPC legada de renomeação
-- passa pelo mesmo caminho seguro das regras dinâmicas.
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
  v_permite_bonus boolean;
  v_permite_doador boolean;
begin
  select permite_bonus, permite_doador
    into v_permite_bonus, v_permite_doador
  from public.tipos_pedido_catalogo
  where id = p_item_id;

  if not found then
    raise exception 'Tipo de Produto não encontrado.';
  end if;

  return public.update_tipo_produto_catalogo_regras(
    p_item_id,
    p_novo_nome,
    v_permite_bonus,
    v_permite_doador
  );
end;
$$;

revoke all on function public.rename_tipo_produto_catalogo(uuid, text) from public;
revoke all on function public.rename_tipo_produto_catalogo(uuid, text) from anon;
grant execute on function public.rename_tipo_produto_catalogo(uuid, text) to authenticated;
