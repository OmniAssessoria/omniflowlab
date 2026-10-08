-- Quando o status da venda ENTRA em "MV - AGUARDANDO ACEITE",
-- move automaticamente para Assinatura -> Aguardando Assinatura.
-- Vale para CLARO e VIVO e para alterações em status_pedido ou status_comercial_nome.

create or replace function public.pipeline_auto_mv_aguardando_aceite()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_status_pedido text;
  v_status_comercial text;
  v_entrou_no_status boolean := false;
begin
  if new.deleted_at is not null
     or coalesce(new.is_deleted, false)
     or new.concluido_em is not null then
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

  v_entrou_no_status :=
    (
      new.status_pedido is distinct from old.status_pedido
      and v_status_pedido = 'MV AGUARDANDO ACEITE'
    )
    or
    (
      new.status_comercial_nome is distinct from old.status_comercial_nome
      and v_status_comercial = 'MV AGUARDANDO ACEITE'
    );

  if not v_entrou_no_status then
    return new;
  end if;

  if not exists (
    select 1
    from public.pipeline_funis f
    join public.pipeline_etapas e on e.funil_id = f.id
    where f.id = 'assinatura'
      and f.ativo
      and f.participa_fluxo_comercial
      and e.id = 'a-aguardando'
      and e.ativo
  ) then
    raise exception 'Automação: destino Assinatura → Aguardando Assinatura está indisponível.';
  end if;

  new.funil := 'assinatura'::public.funil_enum;
  new.etapa_id := 'a-aguardando';
  new.dias_na_etapa := 0;

  return new;
end;
$function$;

drop trigger if exists trg_pipeline_auto_mv_aguardando_aceite on public.vendas;

create trigger trg_pipeline_auto_mv_aguardando_aceite
before update of status_pedido, status_comercial_nome on public.vendas
for each row
execute function public.pipeline_auto_mv_aguardando_aceite();
