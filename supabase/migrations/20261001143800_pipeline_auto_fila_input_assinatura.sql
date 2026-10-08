create or replace function public.pipeline_auto_fila_input_assinatura()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_status_pedido text;
  v_status_comercial text;
  v_entrou_fila_input boolean := false;
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

  v_entrou_fila_input :=
    (
      new.status_pedido is distinct from old.status_pedido
      and v_status_pedido in ('FILA INPUT', 'FB FILA INPUT', 'MV FILA INPUT')
    )
    or
    (
      new.status_comercial_nome is distinct from old.status_comercial_nome
      and v_status_comercial in ('FILA INPUT', 'FB FILA INPUT', 'MV FILA INPUT')
    );

  if not v_entrou_fila_input then
    return new;
  end if;

  if not exists (
    select 1
    from public.pipeline_funis f
    join public.pipeline_etapas e on e.funil_id = f.id
    where f.id = 'assinatura'
      and f.ativo
      and f.participa_fluxo_comercial
      and e.id = 'a-assinado'
      and e.ativo
  ) then
    raise exception 'Automação FILA INPUT: destino Assinatura → Contrato Assinado está indisponível.';
  end if;

  new.funil := 'assinatura'::public.funil_enum;
  new.etapa_id := 'a-assinado';
  new.dias_na_etapa := 0;

  return new;
end;
$function$;

drop trigger if exists trg_pipeline_auto_fila_input_assinatura on public.vendas;

create trigger trg_pipeline_auto_fila_input_assinatura
before update of status_pedido, status_comercial_nome
on public.vendas
for each row
execute function public.pipeline_auto_fila_input_assinatura();
