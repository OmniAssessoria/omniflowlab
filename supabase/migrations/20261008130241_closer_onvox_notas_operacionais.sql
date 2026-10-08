create table public.closer_pedido_notas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.closer_pedidos(id) on delete cascade,
  tipo text not null check (tipo in ('PENDENCIA','ERRO','OBSERVACAO')),
  conteudo text null,
  imagem_storage_path text null,
  imagem_nome_original text null,
  imagem_mime_type text null,
  imagem_tamanho_bytes bigint null check (imagem_tamanho_bytes is null or imagem_tamanho_bytes >= 0),
  created_by uuid not null references auth.users(id),
  autor_nome text null,
  autor_role text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint closer_pedido_notas_conteudo_ou_imagem check (
    nullif(btrim(coalesce(conteudo, '')), '') is not null
    or imagem_storage_path is not null
  )
);

create index closer_pedido_notas_pedido_created_idx
  on public.closer_pedido_notas (pedido_id, created_at desc);

create index closer_pedido_notas_created_by_idx
  on public.closer_pedido_notas (created_by);

alter table public.closer_pedido_notas enable row level security;

grant select, insert, update, delete on public.closer_pedido_notas to authenticated;

create policy closer_pedido_notas_select
on public.closer_pedido_notas
for select
to authenticated
using (
  exists (
    select 1
    from public.closer_pedidos p
    where p.id = closer_pedido_notas.pedido_id
      and p.produto = 'ONVOX'
      and (
        p.closer_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
      )
  )
);

create policy closer_pedido_notas_insert
on public.closer_pedido_notas
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.closer_pedidos p
    where p.id = closer_pedido_notas.pedido_id
      and p.produto = 'ONVOX'
      and (
        (
          p.closer_id = (select auth.uid())
          and (
            public.has_role((select auth.uid()), 'closer'::public.app_role)
            or public.has_role((select auth.uid()), 'consultor'::public.app_role)
          )
        )
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'admin'::public.app_role)
      )
  )
);

create policy closer_pedido_notas_update
on public.closer_pedido_notas
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.closer_pedidos p
      where p.id = closer_pedido_notas.pedido_id
        and p.produto = 'ONVOX'
        and p.closer_id = (select auth.uid())
        and (
          public.has_role((select auth.uid()), 'closer'::public.app_role)
          or public.has_role((select auth.uid()), 'consultor'::public.app_role)
        )
    )
  )
)
with check (
  public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.closer_pedidos p
      where p.id = closer_pedido_notas.pedido_id
        and p.produto = 'ONVOX'
        and p.closer_id = (select auth.uid())
        and (
          public.has_role((select auth.uid()), 'closer'::public.app_role)
          or public.has_role((select auth.uid()), 'consultor'::public.app_role)
        )
    )
  )
);

create policy closer_pedido_notas_delete
on public.closer_pedido_notas
for delete
to authenticated
using (
  public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.closer_pedidos p
      where p.id = closer_pedido_notas.pedido_id
        and p.produto = 'ONVOX'
        and p.closer_id = (select auth.uid())
        and (
          public.has_role((select auth.uid()), 'closer'::public.app_role)
          or public.has_role((select auth.uid()), 'consultor'::public.app_role)
        )
    )
  )
);

create or replace function public.closer_pedido_notas_guard_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.pedido_id is distinct from old.pedido_id then
    raise exception 'pedido_id não pode ser alterado';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by não pode ser alterado';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'created_at não pode ser alterado';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger closer_pedido_notas_guard_update_trigger
before update on public.closer_pedido_notas
for each row execute function public.closer_pedido_notas_guard_update();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'closer_pedido_notas'
  ) then
    alter publication supabase_realtime add table public.closer_pedido_notas;
  end if;
end
$$;

drop policy if exists closer_documentos_storage_delete on storage.objects;
create policy closer_documentos_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'closer-documentos'
  and (
    exists (
      select 1
      from public.closer_pedido_documentos d
      where d.storage_path = objects.name
        and (
          d.enviado_por = (select auth.uid())
          or public.has_role((select auth.uid()), 'bko'::public.app_role)
          or public.has_role((select auth.uid()), 'admin'::public.app_role)
          or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        )
    )
    or exists (
      select 1
      from public.closer_pedido_mensagens m
      where m.imagem_storage_path = objects.name
        and (
          m.user_id = (select auth.uid())
          or public.has_role((select auth.uid()), 'bko'::public.app_role)
          or public.has_role((select auth.uid()), 'admin'::public.app_role)
          or public.has_role((select auth.uid()), 'gestor'::public.app_role)
        )
    )
    or exists (
      select 1
      from public.closer_pedido_notas n
      where n.imagem_storage_path = objects.name
        and (
          n.created_by = (select auth.uid())
          or public.has_role((select auth.uid()), 'bko'::public.app_role)
          or public.has_role((select auth.uid()), 'admin'::public.app_role)
        )
    )
    or (
      (storage.foldername(objects.name))[2] in ('chat', 'notas')
      and exists (
        select 1
        from public.closer_pedidos p
        where p.id = (split_part(objects.name, '/', 1))::uuid
          and (
            p.closer_id = (select auth.uid())
            or public.has_role((select auth.uid()), 'bko'::public.app_role)
            or public.has_role((select auth.uid()), 'admin'::public.app_role)
            or public.has_role((select auth.uid()), 'gestor'::public.app_role)
          )
      )
    )
  )
);
