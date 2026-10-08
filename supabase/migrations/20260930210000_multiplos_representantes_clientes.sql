-- Múltiplos representantes por empresa no Pipeline CLARO/VIVO.
-- Mantém os campos legados de clientes (contato/ddd/telefone/email) sincronizados
-- com o representante principal para preservar compatibilidade com telas e automações existentes.

create table if not exists public.cliente_representantes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nome text not null,
  ddd text null,
  telefone text null,
  email text null,
  principal boolean not null default false,
  ordem integer not null default 0,
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cliente_representantes_cliente
  on public.cliente_representantes(cliente_id, ordem, created_at);

create unique index if not exists idx_cliente_representantes_principal_unico
  on public.cliente_representantes(cliente_id)
  where principal;

alter table public.cliente_representantes enable row level security;

grant select, insert, update, delete on table public.cliente_representantes to authenticated;

drop policy if exists "Representantes visíveis para quem vê o cliente" on public.cliente_representantes;
create policy "Representantes visíveis para quem vê o cliente"
on public.cliente_representantes
for select
to authenticated
using (
  exists (
    select 1
    from public.clientes c
    where c.id = cliente_representantes.cliente_id
  )
);

drop policy if exists "Representantes inseridos por quem acessa o cliente" on public.cliente_representantes;
create policy "Representantes inseridos por quem acessa o cliente"
on public.cliente_representantes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.clientes c
    where c.id = cliente_representantes.cliente_id
  )
);

drop policy if exists "Representantes alterados por quem acessa o cliente" on public.cliente_representantes;
create policy "Representantes alterados por quem acessa o cliente"
on public.cliente_representantes
for update
to authenticated
using (
  exists (
    select 1
    from public.clientes c
    where c.id = cliente_representantes.cliente_id
  )
)
with check (
  exists (
    select 1
    from public.clientes c
    where c.id = cliente_representantes.cliente_id
  )
);

drop policy if exists "Representantes removidos por quem acessa o cliente" on public.cliente_representantes;
create policy "Representantes removidos por quem acessa o cliente"
on public.cliente_representantes
for delete
to authenticated
using (
  exists (
    select 1
    from public.clientes c
    where c.id = cliente_representantes.cliente_id
  )
);

drop trigger if exists trg_cliente_representantes_updated_at on public.cliente_representantes;
create trigger trg_cliente_representantes_updated_at
before update on public.cliente_representantes
for each row execute function public.touch_updated_at();

-- Converte o representante atual para o novo modelo.
insert into public.cliente_representantes (
  cliente_id,
  nome,
  ddd,
  telefone,
  email,
  principal,
  ordem,
  created_by
)
select
  c.id,
  coalesce(nullif(btrim(c.contato), ''), 'Representante principal'),
  nullif(btrim(c.ddd), ''),
  nullif(btrim(c.telefone), ''),
  nullif(btrim(c.email), ''),
  true,
  0,
  c.created_by
from public.clientes c
where (
  nullif(btrim(coalesce(c.contato, '')), '') is not null
  or nullif(btrim(coalesce(c.telefone, '')), '') is not null
  or nullif(btrim(coalesce(c.email, '')), '') is not null
)
and not exists (
  select 1
  from public.cliente_representantes r
  where r.cliente_id = c.id
);

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
      cliente_id, nome, ddd, telefone, email, principal, ordem, created_by
    )
    select
      new.id,
      v_nome,
      nullif(btrim(new.ddd), ''),
      nullif(btrim(new.telefone), ''),
      nullif(btrim(new.email), ''),
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

drop trigger if exists trg_sincronizar_representante_principal_cliente on public.clientes;
create trigger trg_sincronizar_representante_principal_cliente
after insert or update of contato, ddd, telefone, email on public.clientes
for each row
execute function public.sincronizar_representante_principal_cliente();

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
    if old.principal then
      select *
      into v_next
      from public.cliente_representantes
      where cliente_id = old.cliente_id
      order by ordem, created_at, id
      limit 1;

      if found then
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

drop trigger if exists trg_sincronizar_cliente_por_representante on public.cliente_representantes;
create trigger trg_sincronizar_cliente_por_representante
after insert or update of nome, ddd, telefone, email, principal or delete
on public.cliente_representantes
for each row
execute function public.sincronizar_cliente_por_representante();

revoke all on function public.sincronizar_representante_principal_cliente() from public, anon, authenticated;
revoke all on function public.sincronizar_cliente_por_representante() from public, anon, authenticated;
