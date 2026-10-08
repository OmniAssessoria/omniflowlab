-- Endurece a auditoria do Status Comercial: nome, id e perfil do autor vêm do contexto autenticado.
create or replace function public.prepare_status_comercial_historico()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  catalog_nome text;
  actor_nome text;
begin
  select nome
    into catalog_nome
  from public.status_comercial_catalogo
  where id = new.status_id
    and ativo = true;

  if catalog_nome is null then
    raise exception 'Status Comercial inválido ou inativo';
  end if;

  select coalesce(p.nome_completo, p.email)
    into actor_nome
  from public.profiles p
  where p.id = auth.uid();

  new.status_nome_snapshot := catalog_nome;
  new.user_id := auth.uid();
  new.user_nome := coalesce(actor_nome, auth.jwt() ->> 'email', 'Sistema');
  new.created_at := now();

  if has_role(auth.uid(), 'admin'::app_role) then
    new.user_role := 'admin';
  elsif has_role(auth.uid(), 'bko'::app_role) then
    new.user_role := 'bko';
  else
    new.user_role := null;
  end if;

  return new;
end;
$$;
