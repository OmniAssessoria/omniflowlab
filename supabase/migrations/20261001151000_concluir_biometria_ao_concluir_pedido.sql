create or replace function public.pipeline_concluir_biometria_com_pedido()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.operadora::text <> 'CLARO' then
    return new;
  end if;

  if new.concluido_em is not null
     and (
       tg_op = 'INSERT'
       or old.concluido_em is null
     ) then
    new.status_biometria := 'concluido';
  end if;

  return new;
end;
$function$;

drop trigger if exists zz_pipeline_concluir_biometria_com_pedido on public.vendas;

create trigger zz_pipeline_concluir_biometria_com_pedido
before insert or update
on public.vendas
for each row
execute function public.pipeline_concluir_biometria_com_pedido();

update public.vendas
set status_biometria = 'concluido'
where operadora = 'CLARO'::public.operadora_enum
  and concluido_em is not null
  and status_biometria is distinct from 'concluido';
