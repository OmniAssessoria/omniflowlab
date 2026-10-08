alter table public.closer_pedidos
  add column if not exists take_api_tipo text;

alter table public.closer_pedidos
  drop constraint if exists closer_pedidos_take_api_tipo_check;

alter table public.closer_pedidos
  add constraint closer_pedidos_take_api_tipo_check
  check (
    take_api_tipo is null
    or take_api_tipo in ('API OFICIAL', 'API NÃO OFICIAL')
  );

create table if not exists public.closer_take_conexoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.closer_pedidos(id) on delete cascade,
  ddd text not null check (ddd ~ '^[0-9]+$'),
  numero text not null check (numero ~ '^[0-9]+$'),
  ordem integer not null default 0 check (ordem >= 0),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (pedido_id, ordem)
);

create index if not exists closer_take_conexoes_pedido_idx
  on public.closer_take_conexoes(pedido_id);

alter table public.closer_take_conexoes enable row level security;

drop policy if exists closer_take_conexoes_select on public.closer_take_conexoes;
create policy closer_take_conexoes_select
on public.closer_take_conexoes
for select
to authenticated
using (
  exists (
    select 1
    from public.closer_pedidos p
    where p.id = closer_take_conexoes.pedido_id
      and (
        p.closer_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
      )
  )
);

drop policy if exists closer_take_conexoes_insert on public.closer_take_conexoes;
create policy closer_take_conexoes_insert
on public.closer_take_conexoes
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.closer_pedidos p
    where p.id = closer_take_conexoes.pedido_id
      and p.produto = 'TAKE_FLOW'
      and (
        p.closer_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
      )
  )
);

drop policy if exists closer_take_conexoes_update on public.closer_take_conexoes;
create policy closer_take_conexoes_update
on public.closer_take_conexoes
for update
to authenticated
using (
  exists (
    select 1
    from public.closer_pedidos p
    where p.id = closer_take_conexoes.pedido_id
      and (
        p.closer_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
      )
  )
)
with check (
  exists (
    select 1
    from public.closer_pedidos p
    where p.id = closer_take_conexoes.pedido_id
      and p.produto = 'TAKE_FLOW'
      and (
        p.closer_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
      )
  )
);

drop policy if exists closer_take_conexoes_delete on public.closer_take_conexoes;
create policy closer_take_conexoes_delete
on public.closer_take_conexoes
for delete
to authenticated
using (
  exists (
    select 1
    from public.closer_pedidos p
    where p.id = closer_take_conexoes.pedido_id
      and (
        p.closer_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
      )
  )
);

grant select, insert, update, delete on public.closer_take_conexoes to authenticated;
