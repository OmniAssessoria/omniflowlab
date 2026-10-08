create or replace function public.proteger_imagens_observacao_bko()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(cardinality(new.imagens), 0) > 0
       and not public.has_role(auth.uid(), 'bko'::public.app_role) then
      raise exception '403: somente BKO pode inserir imagens em observações.';
    end if;
    return new;
  end if;

  if new.imagens is distinct from old.imagens
     and not public.has_role(auth.uid(), 'bko'::public.app_role) then
    raise exception '403: somente BKO pode alterar imagens em observações.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_proteger_imagens_observacao_bko on public.venda_observacoes;

create trigger trg_proteger_imagens_observacao_bko
before insert or update of imagens on public.venda_observacoes
for each row
execute function public.proteger_imagens_observacao_bko();
