-- Garante no banco que nenhum novo cadastro ativo reutilize o mesmo CNPJ/CPF.
-- Duplicidades históricas existentes não são alteradas retroativamente.

create or replace function public.impedir_documento_empresa_duplicado()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_documento text;
begin
  if new.deleted_at is not null or coalesce(new.is_deleted, false) then
    return new;
  end if;

  v_documento := regexp_replace(coalesce(new.cnpj_cpf, ''), '[^0-9A-Za-z]', '', 'g');
  if v_documento = '' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('cliente-documento:' || v_documento));

  if exists (
    select 1
    from public.clientes c
    where c.id <> new.id
      and c.deleted_at is null
      and coalesce(c.is_deleted, false) = false
      and regexp_replace(coalesce(c.cnpj_cpf, ''), '[^0-9A-Za-z]', '', 'g') = v_documento
  ) then
    raise exception 'Este CNPJ/CPF já está cadastrado em outra empresa.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_impedir_documento_empresa_duplicado on public.clientes;

create trigger trg_impedir_documento_empresa_duplicado
before insert or update of cnpj_cpf, deleted_at, is_deleted
on public.clientes
for each row
execute function public.impedir_documento_empresa_duplicado();
