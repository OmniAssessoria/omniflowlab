-- A biometria CLARO deve acompanhar status final independentemente
-- de o status ter vindo do robô (status_pedido) ou de atualização manual (status_comercial_nome).

create or replace function public.auto_concluir_biometria_claro_status()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_status_pedido text;
  v_status_comercial text;
  v_pedido_final boolean := false;
  v_comercial_final boolean := false;
begin
  if new.operadora::text <> 'CLARO' then
    return new;
  end if;

  v_status_pedido := regexp_replace(
    translate(
      upper(btrim(coalesce(new.status_pedido, ''))),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'AAAAAEEEEIIIIOOOOOUUUUC'
    ),
    '[^A-Z0-9]+',
    ' ',
    'g'
  );
  v_status_pedido := regexp_replace(btrim(v_status_pedido), '\s+', ' ', 'g');

  v_status_comercial := regexp_replace(
    translate(
      upper(btrim(coalesce(new.status_comercial_nome, ''))),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'AAAAAEEEEIIIIOOOOOUUUUC'
    ),
    '[^A-Z0-9]+',
    ' ',
    'g'
  );
  v_status_comercial := regexp_replace(btrim(v_status_comercial), '\s+', ' ', 'g');

  v_pedido_final := v_status_pedido in ('ATIVADO 100', 'CONCLUIDO');
  v_comercial_final := v_status_comercial in ('ATIVADO 100', 'CONCLUIDO');

  if tg_op = 'INSERT' then
    if v_pedido_final or v_comercial_final then
      new.status_biometria := 'concluido';
    end if;
    return new;
  end if;

  if (
    (new.status_pedido is distinct from old.status_pedido and v_pedido_final)
    or
    (new.status_comercial_nome is distinct from old.status_comercial_nome and v_comercial_final)
  ) then
    new.status_biometria := 'concluido';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_auto_concluir_biometria_claro_update on public.vendas;

create trigger trg_auto_concluir_biometria_claro_update
before update of status_pedido, status_comercial_nome on public.vendas
for each row
execute function public.auto_concluir_biometria_claro_status();
