-- Cedente por linha + operadora por linha
-- Mantém Cedentes cadastrados no pedido (venda_cedentes) e move o vínculo operacional
-- para venda_linha_doadores: uma linha -> um Cedente; um Cedente -> várias linhas.

alter table public.venda_linhas
  add column if not exists operadora text;

update public.venda_linhas vl
set operadora = v.operadora::text
from public.vendas v
where v.id = vl.venda_id
  and (vl.operadora is null or btrim(vl.operadora) = '');

alter table public.venda_linhas
  alter column operadora set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'venda_linhas_operadora_check'
  ) then
    alter table public.venda_linhas
      add constraint venda_linhas_operadora_check
      check (operadora in ('CLARO','VIVO'));
  end if;
end $$;

-- Não descartar silenciosamente eventuais registros legados de doador direto na linha
-- em ambientes onde esta migration ainda não foi aplicada.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='venda_linha_doadores'
      and column_name='nome_completo'
  ) and exists (
    select 1 from public.venda_linha_doadores limit 1
  ) then
    raise exception
      'Existem doadores legados em venda_linha_doadores. Migre-os para cedentes/venda_cedentes antes de aplicar esta migration.';
  end if;
end $$;

alter table public.venda_linha_doadores
  drop constraint if exists venda_linha_doadores_email_check,
  drop constraint if exists venda_linha_doadores_nome_completo_check,
  drop constraint if exists venda_linha_doadores_telefone_check,
  drop constraint if exists venda_linha_doadores_operadora_not_blank;

alter table public.venda_linha_doadores
  drop column if exists nome_completo,
  drop column if exists email,
  drop column if exists telefone,
  drop column if exists operadora;

alter table public.venda_linha_doadores
  add column if not exists cedente_id uuid;

alter table public.venda_linha_doadores
  alter column cedente_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'venda_linha_doadores_cedente_id_fkey'
  ) then
    alter table public.venda_linha_doadores
      add constraint venda_linha_doadores_cedente_id_fkey
      foreign key (cedente_id)
      references public.cedentes(id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'venda_linha_doadores_linha_id_key'
  ) then
    alter table public.venda_linha_doadores
      add constraint venda_linha_doadores_linha_id_key
      unique (linha_id);
  end if;
end $$;

create index if not exists venda_linha_doadores_cedente_idx
  on public.venda_linha_doadores(cedente_id);

-- Fonte de verdade das opções que podem usar Cedente.
update public.tipos_pedido_catalogo
set permite_doador = case
  when lower(btrim(nome)) in (
    lower('Migração Pre'),
    lower('Migração Plano'),
    lower('Transferência de Titularidade PF/PJ Pós'),
    lower('Transferência de Titularidade PF/PJ Pré'),
    lower('Transferência de Titularidade PJ/PJ'),
    lower('Portabilidade Cruzada PF/PJ'),
    lower('Portabilidade PJ/PJ')
  ) then true
  else false
end;

-- O Cedente escolhido na linha precisa pertencer aos Cedentes disponíveis do pedido.
create or replace function public.validar_cedente_da_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_venda_id uuid;
begin
  select venda_id
    into v_venda_id
  from public.venda_linhas
  where id = new.linha_id;

  if v_venda_id is null then
    raise exception 'Linha não encontrada para vínculo de Cedente';
  end if;

  if not exists (
    select 1
    from public.venda_cedentes vc
    where vc.venda_id = v_venda_id
      and vc.cedente_id = new.cedente_id
  ) then
    raise exception 'Cedente não pertence aos Cedentes disponíveis deste pedido';
  end if;

  return new;
end;
$function$;

drop trigger if exists validar_cedente_da_linha_before_write
  on public.venda_linha_doadores;

create trigger validar_cedente_da_linha_before_write
before insert or update of linha_id, cedente_id
on public.venda_linha_doadores
for each row execute function public.validar_cedente_da_linha();

-- Não permite retirar um Cedente do pedido enquanto alguma linha ainda o utiliza.
create or replace function public.proteger_cedente_em_uso_na_venda()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if exists (
    select 1
    from public.venda_linha_doadores vld
    join public.venda_linhas vl on vl.id = vld.linha_id
    where vl.venda_id = old.venda_id
      and vld.cedente_id = old.cedente_id
  ) then
    raise exception 'Cedente está vinculado a uma ou mais linhas deste pedido';
  end if;

  return old;
end;
$function$;

drop trigger if exists proteger_cedente_em_uso_before_delete
  on public.venda_cedentes;

create trigger proteger_cedente_em_uso_before_delete
before delete on public.venda_cedentes
for each row execute function public.proteger_cedente_em_uso_na_venda();

-- O Tipo de Pedido configurado na própria linha decide se ela pode ter Cedente.
create or replace function public.guard_venda_linha_doador_rule()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_operadora text;
  v_tipo_produto text;
  v_permite_doador boolean := false;
begin
  select vl.operadora, vl.tipo_produto
    into v_operadora, v_tipo_produto
  from public.venda_linhas vl
  where vl.id = new.linha_id;

  if v_operadora is null then
    raise exception 'Linha da venda não encontrada.';
  end if;

  select coalesce(t.permite_doador, false)
    into v_permite_doador
  from public.tipos_pedido_catalogo t
  where t.operadora = v_operadora
    and t.ativo = true
    and lower(btrim(t.nome)) = lower(btrim(coalesce(v_tipo_produto, '')))
  limit 1;

  if not coalesce(v_permite_doador, false) then
    raise exception 'Este Tipo de Pedido da linha não utiliza Cedente.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_venda_linha_doador_rule
  on public.venda_linha_doadores;

create trigger trg_guard_venda_linha_doador_rule
before insert or update of linha_id
on public.venda_linha_doadores
for each row execute function public.guard_venda_linha_doador_rule();

-- Ao mudar Operadora/Tipo da linha para uma combinação sem Cedente, remove somente
-- o vínculo daquela linha. O Cedente continua cadastrado no pedido/empresa.
create or replace function public.cleanup_venda_linha_extras_after_type_change()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_permite_doador boolean := false;
  v_doador record;
  v_user_nome text;
begin
  if coalesce(current_setting('app.tipo_produto_catalog_rename', true), '0') = '1' then
    return new;
  end if;

  if new.venda_id is not distinct from old.venda_id
     and new.tipo_produto is not distinct from old.tipo_produto
     and new.operadora is not distinct from old.operadora then
    return new;
  end if;

  select coalesce(t.permite_doador, false)
    into v_permite_doador
  from public.tipos_pedido_catalogo t
  where t.operadora = new.operadora
    and t.ativo = true
    and lower(btrim(t.nome)) = lower(btrim(coalesce(new.tipo_produto, '')))
  limit 1;

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
      'Cedente removido automaticamente porque a linha mudou para o Tipo de Pedido “'
        || coalesce(new.tipo_produto, 'Não informado')
        || '” / Operadora “'
        || coalesce(new.operadora, 'Não informada')
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
after update of venda_id, tipo_produto, operadora
on public.venda_linhas
for each row execute function public.cleanup_venda_linha_extras_after_type_change();

-- Bônus também passa a respeitar a Operadora da linha.
create or replace function public.guard_venda_linha_bonus()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_operadora text;
  v_permite_bonus boolean := false;
  v_bonus_valido boolean := false;
  v_contexto_alterado boolean := false;
  v_bonus_ja_existia boolean := false;
  v_catalog_rename boolean := false;
begin
  v_catalog_rename := (
    tg_op = 'UPDATE'
    and coalesce(current_setting('app.tipo_produto_catalog_rename', true), '0') = '1'
    and new.venda_id is not distinct from old.venda_id
    and new.tipo_produto is distinct from old.tipo_produto
  );

  if v_catalog_rename then
    return new;
  end if;

  v_operadora := new.operadora;

  if v_operadora is null then
    raise exception 'Operadora da linha não informada.';
  end if;

  select coalesce(t.permite_bonus, false)
    into v_permite_bonus
  from public.tipos_pedido_catalogo t
  where t.operadora = v_operadora
    and t.ativo = true
    and lower(btrim(t.nome)) = lower(btrim(coalesce(new.tipo_produto, '')))
  limit 1;

  v_permite_bonus := coalesce(v_permite_bonus, false);
  v_contexto_alterado := (
    tg_op = 'INSERT'
    or (
      tg_op = 'UPDATE'
      and (
        new.venda_id is distinct from old.venda_id
        or new.tipo_produto is distinct from old.tipo_produto
        or new.operadora is distinct from old.operadora
      )
    )
  );
  v_bonus_ja_existia := (
    tg_op = 'UPDATE'
    and old.possui_bonus is true
    and new.venda_id is not distinct from old.venda_id
    and new.tipo_produto is not distinct from old.tipo_produto
    and new.operadora is not distinct from old.operadora
  );

  if upper(btrim(v_operadora)) <> 'VIVO' then
    if new.possui_bonus is true and not v_contexto_alterado then
      raise exception 'Bônus é exclusivo da VIVO.';
    end if;
    new.possui_bonus := null;
    new.bonus_gb := null;
    return new;
  end if;

  if v_contexto_alterado and not v_permite_bonus then
    new.possui_bonus := null;
    new.bonus_gb := null;
    return new;
  end if;

  if coalesce(new.possui_bonus, false) = false then
    new.bonus_gb := null;
    return new;
  end if;

  if not v_permite_bonus and not v_bonus_ja_existia then
    raise exception 'Este Tipo de Pedido não permite adicionar bônus.';
  end if;

  if tg_op = 'UPDATE'
     and old.possui_bonus is true
     and new.possui_bonus is true
     and new.bonus_gb is not distinct from old.bonus_gb then
    return new;
  end if;

  select exists (
    select 1
    from public.bonus_vivo_catalogo
    where gb = new.bonus_gb
      and ativo = true
  )
  into v_bonus_valido;

  if new.bonus_gb is null or not v_bonus_valido then
    raise exception 'Selecione uma opção ativa do catálogo de bônus VIVO.';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_guard_venda_linha_bonus on public.venda_linhas;

create trigger trg_guard_venda_linha_bonus
before insert or update of possui_bonus, bonus_gb, venda_id, tipo_produto, operadora
on public.venda_linhas
for each row execute function public.guard_venda_linha_bonus();

-- Troca global de operadora do pedido também replica para as linhas.
create or replace function public.sincronizar_operadora_venda_nas_linhas()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.operadora is distinct from old.operadora then
    update public.venda_linhas
    set operadora = new.operadora::text,
        updated_at = now()
    where venda_id = new.id;
  end if;

  return new;
end;
$function$;

drop trigger if exists sincronizar_operadora_venda_nas_linhas_after_update
  on public.vendas;

create trigger sincronizar_operadora_venda_nas_linhas_after_update
after update of operadora
on public.vendas
for each row execute function public.sincronizar_operadora_venda_nas_linhas();

drop trigger if exists sincronizar_cedente_regra_da_linha_after_update
  on public.venda_linhas;
drop function if exists public.sincronizar_cedente_regra_da_linha();
