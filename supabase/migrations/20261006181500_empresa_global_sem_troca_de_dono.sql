-- Com empresa global por CNPJ/CPF, o consultor_id legado do cadastro não deve
-- trocar a cada edição. A propriedade operacional continua nas vendas.

create or replace function public.enforce_cliente_ownership()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  if public.has_role(auth.uid(), 'consultor'::public.app_role) then
    if tg_op = 'INSERT' then
      new.consultor_id := auth.uid();
      new.created_by := auth.uid();
    else
      new.consultor_id := old.consultor_id;
      new.created_by := old.created_by;
    end if;
  elsif tg_op = 'INSERT' then
    new.created_by := auth.uid();
  else
    new.created_by := old.created_by;
  end if;

  return new;
end;
$function$;
