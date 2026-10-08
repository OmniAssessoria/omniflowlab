-- Passaporte opcional por linha VIVO.
-- Válido somente para Produto Móvel/Fixa com:
-- Migração Plano, Migração Pré ou Migração Pós.
-- O valor referencia diretamente produtos_catalogo e aceita somente
-- VIVO TRAVEL AMÉRICAS, VIVO TRAVEL EUROPA ou VIVO TRAVEL MUNDO.

alter table public.venda_linhas
  add column if not exists passaporte_produto_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='venda_linhas_passaporte_produto_id_fkey'
  ) then
    alter table public.venda_linhas
      add constraint venda_linhas_passaporte_produto_id_fkey
      foreign key (passaporte_produto_id)
      references public.produtos_catalogo(id)
      on delete set null;
  end if;
end $$;

create index if not exists venda_linhas_passaporte_produto_id_idx
  on public.venda_linhas(passaporte_produto_id);

comment on column public.venda_linhas.passaporte_produto_id is
  'Passaporte opcional da linha VIVO, vinculado a um produto VIVO TRAVEL do catálogo.';

create or replace function public.validar_passaporte_venda_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_produto text;
  v_pedido text;
  v_passaporte_nome text;
  v_passaporte_operadora text;
  v_passaporte_ativo boolean;
  v_elegivel boolean;
begin
  v_produto := regexp_replace(
    translate(
      lower(btrim(coalesce(new.produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '\s+',
    ' ',
    'g'
  );

  v_pedido := regexp_replace(
    translate(
      lower(btrim(coalesce(new.tipo_produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '\s+',
    ' ',
    'g'
  );

  v_elegivel :=
    upper(btrim(coalesce(new.operadora,'')))='VIVO'
    and v_produto in ('movel','fixa')
    and v_pedido in ('migracao plano','migracao pre','migracao pos');

  if not v_elegivel then
    new.passaporte_produto_id := null;
    return new;
  end if;

  if new.passaporte_produto_id is null then
    return new;
  end if;

  select nome,operadora,ativo
    into v_passaporte_nome,v_passaporte_operadora,v_passaporte_ativo
  from public.produtos_catalogo
  where id=new.passaporte_produto_id;

  if not found
     or v_passaporte_operadora<>'VIVO'
     or not coalesce(v_passaporte_ativo,false)
     or v_passaporte_nome not in (
       'VIVO TRAVEL AMÉRICAS',
       'VIVO TRAVEL EUROPA',
       'VIVO TRAVEL MUNDO'
     ) then
    raise exception 'Passaporte inválido para esta linha VIVO';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_validar_passaporte_venda_linha on public.venda_linhas;
create trigger trg_validar_passaporte_venda_linha
before insert or update of operadora,produto,tipo_produto,passaporte_produto_id
on public.venda_linhas
for each row execute function public.validar_passaporte_venda_linha();

revoke execute on function public.validar_passaporte_venda_linha() from public;
revoke execute on function public.validar_passaporte_venda_linha() from anon;
revoke execute on function public.validar_passaporte_venda_linha() from authenticated;
