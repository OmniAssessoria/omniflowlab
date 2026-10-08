alter table public.venda_consultor_notas
  add column if not exists imagens text[] not null default '{}'::text[];

alter table public.venda_consultor_notas
  drop constraint if exists venda_consultor_notas_conteudo_check;

alter table public.venda_consultor_notas
  add constraint venda_consultor_notas_conteudo_check
  check (
    length(btrim(conteudo)) <= 10000
    and (
      length(btrim(conteudo)) >= 1
      or coalesce(cardinality(imagens), 0) > 0
    )
  );

drop policy if exists "Notas consultor visíveis por perfis autorizados" on public.venda_consultor_notas;
drop policy if exists "Notas consultor inseridas apenas na assinatura aberta" on public.venda_consultor_notas;

create policy "Assinatura notas visíveis para gestor e consultor"
on public.venda_consultor_notas
for select
to authenticated
using (
  exists (
    select 1
    from public.vendas v
    where v.id = venda_consultor_notas.venda_id
      and (
        public.has_role((select auth.uid()), 'gestor'::app_role)
        or (
          public.has_role((select auth.uid()), 'consultor'::app_role)
          and v.consultor_id = (select auth.uid())
        )
      )
  )
);

create policy "Assinatura notas inseridas por gestor e consultor"
on public.venda_consultor_notas
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1
    from public.vendas v
    where v.id = venda_consultor_notas.venda_id
      and v.funil::text = 'assinatura'
      and v.concluido_em is null
      and (
        public.has_role((select auth.uid()), 'gestor'::app_role)
        or (
          public.has_role((select auth.uid()), 'consultor'::app_role)
          and v.consultor_id = (select auth.uid())
        )
      )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assinatura-notas',
  'assinatura-notas',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Assinatura notas imagens leitura gestor consultor" on storage.objects;
drop policy if exists "Assinatura notas imagens upload gestor consultor" on storage.objects;
drop policy if exists "Assinatura notas imagens exclusao autor" on storage.objects;

create policy "Assinatura notas imagens leitura gestor consultor"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'assinatura-notas'
  and exists (
    select 1
    from public.vendas v
    where v.id::text = (storage.foldername(name))[1]
      and (
        public.has_role((select auth.uid()), 'gestor'::app_role)
        or (
          public.has_role((select auth.uid()), 'consultor'::app_role)
          and v.consultor_id = (select auth.uid())
        )
      )
  )
);

create policy "Assinatura notas imagens upload gestor consultor"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'assinatura-notas'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and exists (
    select 1
    from public.vendas v
    where v.id::text = (storage.foldername(name))[1]
      and v.funil::text = 'assinatura'
      and v.concluido_em is null
      and (
        public.has_role((select auth.uid()), 'gestor'::app_role)
        or (
          public.has_role((select auth.uid()), 'consultor'::app_role)
          and v.consultor_id = (select auth.uid())
        )
      )
  )
);

create policy "Assinatura notas imagens exclusao autor"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'assinatura-notas'
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'venda_consultor_notas'
  ) then
    alter publication supabase_realtime add table public.venda_consultor_notas;
  end if;
end
$$;
