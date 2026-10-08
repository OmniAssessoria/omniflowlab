-- Impede novos documentos duplicados sem tocar nas duplicidades históricas.
-- Em UPDATE, só valida quando o documento realmente mudou após normalização.

create or replace function public.validar_documento_unico_cliente()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_novo text := upper(regexp_replace(coalesce(new.cnpj_cpf, ''), '[^0-9A-Za-z]', '', 'g'));
  v_antigo text := case
    when tg_op = 'UPDATE'
      then upper(regexp_replace(coalesce(old.cnpj_cpf, ''), '[^0-9A-Za-z]', '', 'g'))
    else null
  end;
begin
  if v_novo = '' then
    return new;
  end if;

  if tg_op = 'UPDATE' and v_novo = v_antigo then
    return new;
  end if;

  if exists (
    select 1
    from public.clientes c
    where c.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and c.deleted_at is null
      and coalesce(c.is_deleted, false) = false
      and upper(regexp_replace(coalesce(c.cnpj_cpf, ''), '[^0-9A-Za-z]', '', 'g')) = v_novo
  ) then
    raise exception 'Já existe uma empresa ativa cadastrada com este CNPJ/CPF.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_validar_documento_unico_cliente on public.clientes;

create trigger trg_validar_documento_unico_cliente
before insert or update of cnpj_cpf
on public.clientes
for each row
execute function public.validar_documento_unico_cliente();
