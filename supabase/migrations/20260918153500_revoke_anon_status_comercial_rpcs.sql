revoke execute on function public.criar_status_comercial(text,text[],integer) from anon;
revoke execute on function public.atualizar_status_comercial(uuid,text,text,integer,boolean) from anon;
revoke execute on function public.excluir_status_comercial(uuid,text) from anon;

grant execute on function public.criar_status_comercial(text,text[],integer) to authenticated;
grant execute on function public.atualizar_status_comercial(uuid,text,text,integer,boolean) to authenticated;
grant execute on function public.excluir_status_comercial(uuid,text) to authenticated;
