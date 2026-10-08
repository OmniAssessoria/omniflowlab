-- Ajustes pontuais:
-- 1) NOVO + Móvel (CLARO/VIVO): número não é utilizado.
-- 2) VIVO Migração Pré/Pós + Móvel: sem Operadora Doadora e sem Siga-Me.
-- 3) CLARO status ATIVADO 100% / CONCLUÍDO: biometria concluída automaticamente.

create or replace function public.aplicar_regras_especificas_venda_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_operadora text := upper(btrim(coalesce(new.operadora, '')));
  v_produto text;
  v_pedido text;
begin
  v_produto := regexp_replace(
    translate(
      lower(btrim(coalesce(new.produto, ''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '[–—_-]+',
    ' ',
    'g'
  );
  v_produto := regexp_replace(btrim(v_produto), '\s+', ' ', 'g');

  v_pedido := regexp_replace(
    translate(
      lower(btrim(coalesce(new.tipo_produto, ''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '[–—_-]+',
    ' ',
    'g'
  );
  v_pedido := regexp_replace(btrim(v_pedido), '\s+', ' ', 'g');

  if v_operadora in ('CLARO', 'VIVO')
     and v_produto = 'movel'
     and v_pedido = 'novo' then
    new.numero := null;
  end if;

  if v_operadora = 'VIVO'
     and v_produto = 'movel'
     and v_pedido in ('migracao pre', 'migracao pos') then
    new.operadora_doadora := null;
    new.siga_me_produto_id := null;
    new.siga_me_descricao := null;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_zz_regras_especificas_venda_linha on public.venda_linhas;

create trigger trg_zz_regras_especificas_venda_linha
before insert or update on public.venda_linhas
for each row
execute function public.aplicar_regras_especificas_venda_linha();

-- Limpa dados antigos que passaram a ser inválidos pelas combinações acima.
update public.venda_linhas
set numero = null
where upper(btrim(coalesce(operadora, ''))) in ('CLARO', 'VIVO')
  and regexp_replace(
        btrim(
          regexp_replace(
            translate(lower(btrim(coalesce(produto, ''))),
              'áàâãäéèêëíìîïóòôõöúùûüç',
              'aaaaaeeeeiiiiooooouuuuc'),
            '[–—_-]+', ' ', 'g'
          )
        ),
        '\s+', ' ', 'g'
      ) = 'movel'
  and regexp_replace(
        btrim(
          regexp_replace(
            translate(lower(btrim(coalesce(tipo_produto, ''))),
              'áàâãäéèêëíìîïóòôõöúùûüç',
              'aaaaaeeeeiiiiooooouuuuc'),
            '[–—_-]+', ' ', 'g'
          )
        ),
        '\s+', ' ', 'g'
      ) = 'novo'
  and numero is not null;

update public.venda_linhas
set operadora_doadora = null,
    siga_me_produto_id = null,
    siga_me_descricao = null
where upper(btrim(coalesce(operadora, ''))) = 'VIVO'
  and regexp_replace(
        btrim(
          regexp_replace(
            translate(lower(btrim(coalesce(produto, ''))),
              'áàâãäéèêëíìîïóòôõöúùûüç',
              'aaaaaeeeeiiiiooooouuuuc'),
            '[–—_-]+', ' ', 'g'
          )
        ),
        '\s+', ' ', 'g'
      ) = 'movel'
  and regexp_replace(
        btrim(
          regexp_replace(
            translate(lower(btrim(coalesce(tipo_produto, ''))),
              'áàâãäéèêëíìîïóòôõöúùûüç',
              'aaaaaeeeeiiiiooooouuuuc'),
            '[–—_-]+', ' ', 'g'
          )
        ),
        '\s+', ' ', 'g'
      ) in ('migracao pre', 'migracao pos')
  and (
    operadora_doadora is not null
    or siga_me_produto_id is not null
    or siga_me_descricao is not null
  );

create or replace function public.auto_concluir_biometria_claro_status()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_status text;
begin
  if new.operadora::text <> 'CLARO' then
    return new;
  end if;

  v_status := regexp_replace(
    translate(
      upper(btrim(coalesce(new.status_pedido, ''))),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'AAAAAEEEEIIIIOOOOOUUUUC'
    ),
    '[^A-Z0-9]+',
    ' ',
    'g'
  );
  v_status := regexp_replace(btrim(v_status), '\s+', ' ', 'g');

  if v_status in ('ATIVADO 100', 'CONCLUIDO') then
    new.status_biometria := 'concluido';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_auto_concluir_biometria_claro_insert on public.vendas;
drop trigger if exists trg_auto_concluir_biometria_claro_update on public.vendas;

create trigger trg_auto_concluir_biometria_claro_insert
before insert on public.vendas
for each row
execute function public.auto_concluir_biometria_claro_status();

create trigger trg_auto_concluir_biometria_claro_update
before update of status_pedido on public.vendas
for each row
when (new.status_pedido is distinct from old.status_pedido)
execute function public.auto_concluir_biometria_claro_status();

-- Sincroniza pedidos CLARO que já estão nesses status.
update public.vendas
set status_biometria = 'concluido'
where operadora = 'CLARO'::public.operadora_enum
  and deleted_at is null
  and not coalesce(is_deleted, false)
  and regexp_replace(
        btrim(
          regexp_replace(
            translate(upper(btrim(coalesce(status_pedido, ''))),
              'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
              'AAAAAEEEEIIIIOOOOOUUUUC'),
            '[^A-Z0-9]+', ' ', 'g'
          )
        ),
        '\s+', ' ', 'g'
      ) in ('ATIVADO 100', 'CONCLUIDO')
  and status_biometria is distinct from 'concluido';
