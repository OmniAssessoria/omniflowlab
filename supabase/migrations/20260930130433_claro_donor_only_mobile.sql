
-- CLARO: Operadora Doadora e Cedente pertencem somente às combinações com Produto Móvel.
-- A regra por Tipo de Pedido continua sendo lida de tipos_pedido_catalogo.

create or replace function public.normalizar_operadora_doadora_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_permite_doador boolean := false;
  v_produto text := regexp_replace(
    translate(
      lower(btrim(coalesce(new.produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '\s+',' ','g'
  );
begin
  select coalesce(t.permite_doador,false)
    into v_permite_doador
  from public.tipos_pedido_catalogo t
  where t.operadora = new.operadora
    and t.ativo = true
    and lower(btrim(t.nome)) = lower(btrim(coalesce(new.tipo_produto,'')))
  limit 1;

  if upper(btrim(coalesce(new.operadora,'')))='CLARO'
     and v_produto <> 'movel' then
    v_permite_doador := false;
  end if;

  if not coalesce(v_permite_doador,false) then
    new.operadora_doadora := null;
  end if;

  return new;
end;
$function$;

drop trigger if exists normalizar_operadora_doadora_linha_before_write
  on public.venda_linhas;

create trigger normalizar_operadora_doadora_linha_before_write
before insert or update of operadora, tipo_produto, produto, operadora_doadora
on public.venda_linhas
for each row execute function public.normalizar_operadora_doadora_linha();

create or replace function public.validar_cedente_da_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_venda_id uuid;
  v_tipo_pedido text;
  v_operadora text;
  v_produto text;
  v_documento text;
begin
  select venda_id,
         tipo_produto,
         upper(btrim(coalesce(operadora,''))),
         regexp_replace(
           translate(
             lower(btrim(coalesce(produto,''))),
             'áàâãäéèêëíìîïóòôõöúùûüç',
             'aaaaaeeeeiiiiooooouuuuc'
           ),
           '\s+',' ','g'
         )
    into v_venda_id, v_tipo_pedido, v_operadora, v_produto
  from public.venda_linhas
  where id = new.linha_id;

  if v_venda_id is null then
    raise exception 'Linha não encontrada para vínculo de Cedente';
  end if;

  if v_operadora='CLARO' and v_produto <> 'movel' then
    raise exception 'Cedente CLARO é permitido somente em linhas de Produto Móvel';
  end if;

  if not exists (
    select 1
    from public.venda_cedentes vc
    where vc.venda_id = v_venda_id
      and vc.cedente_id = new.cedente_id
  ) then
    raise exception 'Cedente não pertence aos Cedentes disponíveis deste pedido';
  end if;

  select regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g')
    into v_documento
  from public.cedentes c
  where c.id = new.cedente_id;

  if upper(
       translate(
         btrim(coalesce(v_tipo_pedido,'')),
         'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
         'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
       )
     ) in ('MIGRACAO PRE','MIGRACAO POS','PORTABILIDADE PF/PJ')
     and length(v_documento) <> 11 then
    raise exception 'Este Tipo de Pedido exige Cedente Pessoa Física com CPF de 11 dígitos';
  end if;

  return new;
end;
$function$;

create or replace function public.cleanup_venda_linha_extras_after_type_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_permite_doador boolean := false;
  v_produto text := regexp_replace(
    translate(
      lower(btrim(coalesce(new.produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '\s+',' ','g'
  );
  v_doador record;
  v_user_nome text;
begin
  if coalesce(current_setting('app.tipo_produto_catalog_rename', true), '0') = '1' then
    return new;
  end if;

  if new.venda_id is not distinct from old.venda_id
     and new.tipo_produto is not distinct from old.tipo_produto
     and new.operadora is not distinct from old.operadora
     and new.produto is not distinct from old.produto then
    return new;
  end if;

  select coalesce(t.permite_doador, false)
    into v_permite_doador
  from public.tipos_pedido_catalogo t
  where t.operadora = new.operadora
    and t.ativo = true
    and lower(btrim(t.nome)) = lower(btrim(coalesce(new.tipo_produto, '')))
  limit 1;

  if upper(btrim(coalesce(new.operadora,'')))='CLARO'
     and v_produto <> 'movel' then
    v_permite_doador := false;
  end if;

  select vld.cedente_id,
         c.cnpj_cpf,
         c.razao_social,
         c.nome,
         c.email
    into v_doador
  from public.venda_linha_doadores vld
  join public.cedentes c on c.id = vld.cedente_id
  where vld.linha_id = new.id
  limit 1;

  if found and not coalesce(v_permite_doador, false) then
    select nome_completo
      into v_user_nome
    from public.profiles
    where id = auth.uid();

    insert into public.venda_historico(
      venda_id, tipo, campo, valor_anterior, valor_novo,
      descricao, user_id, user_nome
    ) values (
      new.venda_id,
      'campo'::public.historico_tipo_enum,
      'cedente_linha',
      concat_ws(
        ' | ',
        coalesce(nullif(v_doador.razao_social,''), nullif(v_doador.nome,''), 'Cedente'),
        v_doador.cnpj_cpf,
        v_doador.email
      ),
      null,
      'Cedente removido automaticamente porque a linha mudou para “'
        || coalesce(new.tipo_produto, 'Não informado')
        || '” + “'
        || coalesce(new.produto, 'Não informado')
        || '”, combinação que não utiliza Cedente.',
      auth.uid(),
      v_user_nome
    );

    delete from public.venda_linha_doadores
    where linha_id = new.id;
  end if;

  if old.possui_bonus is true
     and new.possui_bonus is not true
     and old.bonus_gb is not null then
    if v_user_nome is null then
      select nome_completo
        into v_user_nome
      from public.profiles
      where id = auth.uid();
    end if;

    insert into public.venda_historico(
      venda_id, tipo, campo, valor_anterior, valor_novo,
      descricao, user_id, user_nome
    ) values (
      new.venda_id,
      'campo'::public.historico_tipo_enum,
      'bonus_linha',
      old.bonus_gb::text || ' GB',
      null,
      'Bônus removido automaticamente porque a linha mudou para o Tipo de Pedido “'
        || coalesce(new.tipo_produto, 'Não informado')
        || '” / Operadora “'
        || coalesce(new.operadora, 'Não informada')
        || '”.',
      auth.uid(),
      v_user_nome
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_cleanup_venda_linha_extras_after_type_change
  on public.venda_linhas;

create trigger trg_cleanup_venda_linha_extras_after_type_change
after update of venda_id, tipo_produto, operadora, produto
on public.venda_linhas
for each row execute function public.cleanup_venda_linha_extras_after_type_change();

revoke execute on function public.normalizar_operadora_doadora_linha() from public;
revoke execute on function public.normalizar_operadora_doadora_linha() from anon;
revoke execute on function public.normalizar_operadora_doadora_linha() from authenticated;

revoke execute on function public.validar_cedente_da_linha() from public;
revoke execute on function public.validar_cedente_da_linha() from anon;
revoke execute on function public.validar_cedente_da_linha() from authenticated;

revoke execute on function public.cleanup_venda_linha_extras_after_type_change() from public;
revoke execute on function public.cleanup_venda_linha_extras_after_type_change() from anon;
revoke execute on function public.cleanup_venda_linha_extras_after_type_change() from authenticated;
