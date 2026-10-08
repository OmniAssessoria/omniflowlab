-- OMNI PipeLab: finalização da Operação Closer e unicidade de dados críticos.

create unique index if not exists closer_clientes_cnpj_global_uidx
on public.closer_clientes ((regexp_replace(cnpj, '\D', '', 'g')))
where nullif(regexp_replace(cnpj, '\D', '', 'g'), '') is not null;

create unique index if not exists profiles_email_normalized_uidx
on public.profiles ((lower(btrim(email))))
where nullif(btrim(email), '') is not null;

create or replace function public.sync_closer_pedido_finalizacao()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_final boolean;
begin
  v_final :=
    (new.produto = 'ONVOX' and new.etapa = 'CONCLUÍDO')
    or
    (new.produto = 'TAKE_FLOW' and new.etapa = 'ONBOARDING 3');

  if v_final then
    new.concluido_em := coalesce(new.concluido_em, now());
  else
    new.concluido_em := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_closer_pedidos_sync_finalizacao on public.closer_pedidos;

create trigger trg_closer_pedidos_sync_finalizacao
before insert or update of produto, etapa, concluido_em
on public.closer_pedidos
for each row
execute function public.sync_closer_pedido_finalizacao();

update public.closer_pedidos
set concluido_em = coalesce(concluido_em, updated_at, now())
where concluido_em is null
  and (
    (produto = 'ONVOX' and etapa = 'CONCLUÍDO')
    or
    (produto = 'TAKE_FLOW' and etapa = 'ONBOARDING 3')
  );
