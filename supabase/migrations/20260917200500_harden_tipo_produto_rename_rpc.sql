revoke all on function public.rename_tipo_produto_catalogo(uuid, text) from public;
revoke all on function public.rename_tipo_produto_catalogo(uuid, text) from anon;
grant execute on function public.rename_tipo_produto_catalogo(uuid, text) to authenticated;
