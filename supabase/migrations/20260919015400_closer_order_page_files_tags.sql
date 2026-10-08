-- Operação Closer: página individual do pedido, arquivos e tags.
-- Estrutura criada sem importar vendas/clientes das planilhas.

create table if not exists public.closer_tags_catalogo (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text not null default '#64748B',
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint closer_tags_catalogo_cor_chk check (cor ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.closer_pedido_tags (
  pedido_id uuid not null references public.closer_pedidos(id) on delete cascade,
  tag_id uuid not null references public.closer_tags_catalogo(id) on delete restrict,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (pedido_id, tag_id)
);

create table if not exists public.closer_pedido_documentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.closer_pedidos(id) on delete cascade,
  arquivo_nome_original text not null,
  storage_path text not null unique,
  mime_type text not null,
  tamanho_bytes bigint not null,
  enviado_por uuid not null default auth.uid(),
  enviado_por_nome text,
  enviado_por_role text,
  created_at timestamptz not null default now(),
  constraint closer_pedido_documentos_tamanho_chk check (tamanho_bytes > 0 and tamanho_bytes <= 10485760)
);

create index if not exists closer_pedido_tags_pedido_idx
  on public.closer_pedido_tags(pedido_id);
create index if not exists closer_pedido_tags_tag_idx
  on public.closer_pedido_tags(tag_id);
create index if not exists closer_pedido_documentos_pedido_idx
  on public.closer_pedido_documentos(pedido_id, created_at desc);
create index if not exists closer_tags_catalogo_ativo_ordem_idx
  on public.closer_tags_catalogo(ativo, ordem, nome);

alter table public.closer_tags_catalogo enable row level security;
alter table public.closer_pedido_tags enable row level security;
alter table public.closer_pedido_documentos enable row level security;

grant select, insert, update on public.closer_tags_catalogo to authenticated;
grant select, insert, delete on public.closer_pedido_tags to authenticated;
grant select, insert, delete on public.closer_pedido_documentos to authenticated;

drop policy if exists closer_tags_catalogo_select on public.closer_tags_catalogo;
create policy closer_tags_catalogo_select
on public.closer_tags_catalogo
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'closer'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
);

drop policy if exists closer_tags_catalogo_insert on public.closer_tags_catalogo;
create policy closer_tags_catalogo_insert
on public.closer_tags_catalogo
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and (
    public.has_role((select auth.uid()), 'bko'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
    or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  )
);

drop policy if exists closer_tags_catalogo_update on public.closer_tags_catalogo;
create policy closer_tags_catalogo_update
on public.closer_tags_catalogo
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
)
with check (
  public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
);

drop policy if exists closer_pedido_tags_select on public.closer_pedido_tags;
create policy closer_pedido_tags_select
on public.closer_pedido_tags
for select
to authenticated
using (
  exists (
    select 1 from public.closer_pedidos p
    where p.id = closer_pedido_tags.pedido_id
  )
);

drop policy if exists closer_pedido_tags_insert on public.closer_pedido_tags;
create policy closer_pedido_tags_insert
on public.closer_pedido_tags
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.closer_pedidos p
    where p.id = closer_pedido_tags.pedido_id
  )
  and (
    public.has_role((select auth.uid()), 'bko'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
    or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  )
);

drop policy if exists closer_pedido_tags_delete on public.closer_pedido_tags;
create policy closer_pedido_tags_delete
on public.closer_pedido_tags
for delete
to authenticated
using (
  exists (
    select 1 from public.closer_pedidos p
    where p.id = closer_pedido_tags.pedido_id
  )
  and (
    public.has_role((select auth.uid()), 'bko'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
    or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  )
);

drop policy if exists closer_pedido_documentos_select on public.closer_pedido_documentos;
create policy closer_pedido_documentos_select
on public.closer_pedido_documentos
for select
to authenticated
using (
  exists (
    select 1 from public.closer_pedidos p
    where p.id = closer_pedido_documentos.pedido_id
  )
);

drop policy if exists closer_pedido_documentos_insert on public.closer_pedido_documentos;
create policy closer_pedido_documentos_insert
on public.closer_pedido_documentos
for insert
to authenticated
with check (
  enviado_por = (select auth.uid())
  and exists (
    select 1 from public.closer_pedidos p
    where p.id = closer_pedido_documentos.pedido_id
  )
  and (
    public.has_role((select auth.uid()), 'closer'::public.app_role)
    or public.has_role((select auth.uid()), 'bko'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
    or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  )
);

drop policy if exists closer_pedido_documentos_delete on public.closer_pedido_documentos;
create policy closer_pedido_documentos_delete
on public.closer_pedido_documentos
for delete
to authenticated
using (
  exists (
    select 1 from public.closer_pedidos p
    where p.id = closer_pedido_documentos.pedido_id
  )
  and (
    enviado_por = (select auth.uid())
    or public.has_role((select auth.uid()), 'bko'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
    or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  )
);

drop trigger if exists trg_closer_tags_catalogo_touch on public.closer_tags_catalogo;
create trigger trg_closer_tags_catalogo_touch
before update on public.closer_tags_catalogo
for each row execute function public.closer_touch_updated_at();

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'closer-documentos',
  'closer-documentos',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg'
  ]::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

drop policy if exists closer_documentos_storage_select on storage.objects;
create policy closer_documentos_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'closer-documentos'
  and exists (
    select 1 from public.closer_pedidos p
    where p.id = split_part(name, '/', 1)::uuid
  )
);

drop policy if exists closer_documentos_storage_insert on storage.objects;
create policy closer_documentos_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'closer-documentos'
  and exists (
    select 1 from public.closer_pedidos p
    where p.id = split_part(name, '/', 1)::uuid
  )
  and (
    public.has_role((select auth.uid()), 'closer'::public.app_role)
    or public.has_role((select auth.uid()), 'bko'::public.app_role)
    or public.has_role((select auth.uid()), 'admin'::public.app_role)
    or public.has_role((select auth.uid()), 'gestor'::public.app_role)
  )
);

drop policy if exists closer_documentos_storage_delete on storage.objects;
create policy closer_documentos_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'closer-documentos'
  and exists (
    select 1 from public.closer_pedido_documentos d
    where d.storage_path = name
      and (
        d.enviado_por = (select auth.uid())
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
      )
  )
);

create or replace function public.closer_historico_documento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_nome text;
  v_pedido uuid;
  v_nome_arquivo text;
begin
  v_pedido := coalesce(new.pedido_id, old.pedido_id);
  v_nome_arquivo := coalesce(new.arquivo_nome_original, old.arquivo_nome_original);

  select ur.role::text into v_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
  order by case ur.role::text
    when 'admin' then 1 when 'gestor' then 2 when 'bko' then 3 when 'closer' then 4 else 9
  end
  limit 1;

  v_nome := public.omni_usuario_nome(auth.uid());

  insert into public.closer_pedido_historico (
    pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata
  )
  values (
    v_pedido,
    auth.uid(),
    case when tg_op = 'INSERT' then 'arquivo_adicionado' else 'arquivo_removido' end,
    'arquivo',
    case when tg_op = 'DELETE' then v_nome_arquivo else null end,
    case when tg_op = 'INSERT' then v_nome_arquivo else null end,
    jsonb_build_object('user_nome', v_nome, 'user_role', v_role)
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.closer_historico_documento() from public, anon, authenticated;

drop trigger if exists trg_closer_documentos_historico on public.closer_pedido_documentos;
create trigger trg_closer_documentos_historico
after insert or delete on public.closer_pedido_documentos
for each row execute function public.closer_historico_documento();

create or replace function public.closer_historico_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_nome text;
  v_pedido uuid;
  v_tag_id uuid;
  v_tag_nome text;
begin
  v_pedido := coalesce(new.pedido_id, old.pedido_id);
  v_tag_id := coalesce(new.tag_id, old.tag_id);

  select t.nome into v_tag_nome
  from public.closer_tags_catalogo t
  where t.id = v_tag_id;

  select ur.role::text into v_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
  order by case ur.role::text
    when 'admin' then 1 when 'gestor' then 2 when 'bko' then 3 when 'closer' then 4 else 9
  end
  limit 1;

  v_nome := public.omni_usuario_nome(auth.uid());

  insert into public.closer_pedido_historico (
    pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata
  )
  values (
    v_pedido,
    auth.uid(),
    case when tg_op = 'INSERT' then 'tag_adicionada' else 'tag_removida' end,
    'tag',
    case when tg_op = 'DELETE' then v_tag_nome else null end,
    case when tg_op = 'INSERT' then v_tag_nome else null end,
    jsonb_build_object('user_nome', v_nome, 'user_role', v_role)
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.closer_historico_tag() from public, anon, authenticated;

drop trigger if exists trg_closer_pedido_tags_historico on public.closer_pedido_tags;
create trigger trg_closer_pedido_tags_historico
after insert or delete on public.closer_pedido_tags
for each row execute function public.closer_historico_tag();

insert into public.closer_tags_catalogo (nome, cor, ordem, created_by)
values
  ('Urgente', '#F43F5E', 10, null),
  ('Pendente Cliente', '#F97316', 20, null),
  ('Aguardando Contrato', '#FACC15', 30, null),
  ('Aguardando BKO', '#8B5CF6', 40, null),
  ('Implantação', '#3B82F6', 50, null),
  ('Ativação', '#22C55E', 60, null),
  ('Portabilidade', '#14B8A6', 70, null),
  ('Treinamento', '#6366F1', 80, null),
  ('Sem Retorno', '#EC4899', 90, null),
  ('Documentação', '#A855F7', 100, null),
  ('Cobrança', '#EA580C', 110, null),
  ('Suporte', '#06B6D4', 120, null),
  ('Prioridade Alta', '#BE123C', 130, null),
  ('Prioridade Média', '#EAB308', 140, null),
  ('Prioridade Baixa', '#34D399', 150, null),
  ('Follow-up', '#DB2777', 160, null),
  ('Agendado', '#4F46E5', 170, null),
  ('Bloqueio Técnico', '#64748B', 180, null),
  ('Em Validação', '#7C3AED', 190, null),
  ('Concluído', '#16A34A', 200, null)
on conflict (nome) do update set
  cor = excluded.cor,
  ordem = excluded.ordem,
  ativo = true;
