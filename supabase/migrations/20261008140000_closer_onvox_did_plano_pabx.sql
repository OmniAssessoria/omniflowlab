alter table public.closer_pedido_itens
  add column if not exists ddd text null,
  add column if not exists numero text null;

alter table public.closer_pedidos
  add column if not exists onvox_plano_pabx text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'closer_pedido_itens_ddd_digits_chk'
      and conrelid = 'public.closer_pedido_itens'::regclass
  ) then
    alter table public.closer_pedido_itens
      add constraint closer_pedido_itens_ddd_digits_chk
      check (ddd is null or ddd ~ '^[0-9]+$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'closer_pedido_itens_numero_digits_chk'
      and conrelid = 'public.closer_pedido_itens'::regclass
  ) then
    alter table public.closer_pedido_itens
      add constraint closer_pedido_itens_numero_digits_chk
      check (numero is null or numero ~ '^[0-9]+$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'closer_pedidos_onvox_plano_pabx_chk'
      and conrelid = 'public.closer_pedidos'::regclass
  ) then
    alter table public.closer_pedidos
      add constraint closer_pedidos_onvox_plano_pabx_chk
      check (
        onvox_plano_pabx is null
        or onvox_plano_pabx in ('Enterprise', 'Ultimate')
      );
  end if;
end
$$;
