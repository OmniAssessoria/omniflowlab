-- Define os papéis comerciais dos representantes.
-- Cada cliente tem exatamente um Negociante e um Assinante.
-- A mesma pessoa pode exercer os dois papéis.

alter table public.cliente_representantes
  add column if not exists negociante boolean not null default false,
  add column if not exists assinante boolean not null default false;

update public.cliente_representantes
set
  negociante = principal,
  assinante = principal
where principal
  and (not negociante or not assinante);

create unique index if not exists idx_cliente_representantes_negociante_unico
  on public.cliente_representantes(cliente_id)
  where negociante;

create unique index if not exists idx_cliente_representantes_assinante_unico
  on public.cliente_representantes(cliente_id)
  where assinante;

create or replace function public.sincronizar_representante_principal_cliente()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_nome text;
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if nullif(btrim(coalesce(new.contato, '')), '') is null
     and nullif(btrim(coalesce(new.telefone, '')), '') is null
     and nullif(btrim(coalesce(new.email, '')), '') is null then
    return new;
  end if;

  v_nome := coalesce(nullif(btrim(new.contato), ''), 'Representante principal');

  update public.cliente_representantes r
  set
    nome = v_nome,
    ddd = nullif(btrim(new.ddd), ''),
    telefone = nullif(btrim(new.telefone), ''),
    email = nullif(btrim(new.email), ''),
    updated_at = now()
  where r.cliente_id = new.id
    and r.principal
    and (
      r.nome is distinct from v_nome
      or r.ddd is distinct from nullif(btrim(new.ddd), '')
      or r.telefone is distinct from nullif(btrim(new.telefone), '')
      or r.email is distinct from nullif(btrim(new.email), '')
    );

  if not found then
    insert into public.cliente_representantes (
      cliente_id, nome, ddd, telefone, email,
      principal, negociante, assinante, ordem, created_by
    )
    select
      new.id,
      v_nome,
      nullif(btrim(new.ddd), ''),
      nullif(btrim(new.telefone), ''),
      nullif(btrim(new.email), ''),
      true,
      true,
      true,
      0,
      coalesce(auth.uid(), new.created_by)
    where not exists (
      select 1
      from public.cliente_representantes r
      where r.cliente_id = new.id and r.principal
    );
  end if;

  return new;
end;
$function$;

create or replace function public.sincronizar_cliente_por_representante()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_next public.cliente_representantes%rowtype;
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    select *
    into v_next
    from public.cliente_representantes
    where cliente_id = old.cliente_id
    order by ordem, created_at, id
    limit 1;

    if found then
      if old.principal then
        update public.cliente_representantes
        set principal = true
        where id = v_next.id;

        update public.clientes
        set
          contato = v_next.nome,
          ddd = v_next.ddd,
          telefone = v_next.telefone,
          email = v_next.email
        where id = old.cliente_id;
      end if;

      if old.negociante then
        update public.cliente_representantes
        set negociante = true
        where id = v_next.id;
      end if;

      if old.assinante then
        update public.cliente_representantes
        set assinante = true
        where id = v_next.id;
      end if;
    end if;

    return old;
  end if;

  if new.principal then
    update public.clientes
    set
      contato = new.nome,
      ddd = new.ddd,
      telefone = new.telefone,
      email = new.email
    where id = new.cliente_id
      and (
        contato is distinct from new.nome
        or ddd is distinct from new.ddd
        or telefone is distinct from new.telefone
        or email is distinct from new.email
      );
  end if;

  return new;
end;
$function$;

create or replace function public.cliente_definir_papel_representante(
  p_cliente_id uuid,
  p_representante_id uuid,
  p_papel text
)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if p_papel not in ('negociante', 'assinante') then
    raise exception 'Papel de representante inválido.';
  end if;

  if not exists (
    select 1
    from public.cliente_representantes r
    where r.id = p_representante_id
      and r.cliente_id = p_cliente_id
  ) then
    raise exception 'Representante não encontrado para este cliente.';
  end if;

  if p_papel = 'negociante' then
    update public.cliente_representantes
    set negociante = false
    where cliente_id = p_cliente_id
      and negociante;

    update public.cliente_representantes
    set negociante = true
    where id = p_representante_id
      and cliente_id = p_cliente_id;
  else
    update public.cliente_representantes
    set assinante = false
    where cliente_id = p_cliente_id
      and assinante;

    update public.cliente_representantes
    set assinante = true
    where id = p_representante_id
      and cliente_id = p_cliente_id;
  end if;
end;
$function$;

revoke all on function public.cliente_definir_papel_representante(uuid, uuid, text) from public, anon;
grant execute on function public.cliente_definir_papel_representante(uuid, uuid, text) to authenticated;

create or replace function public.validar_papeis_representantes_cliente()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_cliente_id uuid := coalesce(new.cliente_id, old.cliente_id);
  v_total integer;
  v_negociantes integer;
  v_assinantes integer;
begin
  select
    count(*)::int,
    count(*) filter (where negociante)::int,
    count(*) filter (where assinante)::int
  into v_total, v_negociantes, v_assinantes
  from public.cliente_representantes
  where cliente_id = v_cliente_id;

  if v_total > 0 and v_negociantes <> 1 then
    raise exception 'Cada empresa deve ter exatamente um representante Negociante.';
  end if;

  if v_total > 0 and v_assinantes <> 1 then
    raise exception 'Cada empresa deve ter exatamente um representante Assinante.';
  end if;

  return coalesce(new, old);
end;
$function$;

drop trigger if exists trg_validar_papeis_representantes_cliente on public.cliente_representantes;
create constraint trigger trg_validar_papeis_representantes_cliente
after insert or update or delete on public.cliente_representantes
deferrable initially deferred
for each row
execute function public.validar_papeis_representantes_cliente();

revoke all on function public.validar_papeis_representantes_cliente() from public, anon, authenticated;
