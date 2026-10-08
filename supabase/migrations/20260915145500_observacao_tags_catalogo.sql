-- Catálogo visual de tags para observações de pedidos.
-- Observações guardam snapshot da tag para preservar o histórico mesmo após edição/exclusão do catálogo.

create table if not exists public.observacao_tags_catalogo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  cor text not null default 'yellow',
  icone text not null default 'message-square',
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint observacao_tags_cor_check check (cor in ('red', 'blue', 'yellow', 'emerald', 'violet', 'orange', 'cyan', 'slate')),
  constraint observacao_tags_icone_check check (icone in ('message-square', 'x-circle', 'headphones', 'house', 'alert-triangle', 'info', 'map-pin', 'tag'))
);

create unique index if not exists observacao_tags_catalogo_nome_unique_ci
  on public.observacao_tags_catalogo (lower(nome));

alter table public.observacao_tags_catalogo enable row level security;

revoke all on table public.observacao_tags_catalogo from anon, authenticated;
grant select, insert, update, delete on table public.observacao_tags_catalogo to authenticated;

drop policy if exists authenticated_read on public.observacao_tags_catalogo;
create policy authenticated_read
  on public.observacao_tags_catalogo
  for select
  to authenticated
  using ((select auth.uid()) is not null);

drop policy if exists admin_bko_write_insert on public.observacao_tags_catalogo;
create policy admin_bko_write_insert
  on public.observacao_tags_catalogo
  for insert
  to authenticated
  with check (
    has_role((select auth.uid()), 'admin'::app_role)
    or has_role((select auth.uid()), 'bko'::app_role)
  );

drop policy if exists admin_bko_write_update on public.observacao_tags_catalogo;
create policy admin_bko_write_update
  on public.observacao_tags_catalogo
  for update
  to authenticated
  using (
    has_role((select auth.uid()), 'admin'::app_role)
    or has_role((select auth.uid()), 'bko'::app_role)
  )
  with check (
    has_role((select auth.uid()), 'admin'::app_role)
    or has_role((select auth.uid()), 'bko'::app_role)
  );

drop policy if exists admin_bko_write_delete on public.observacao_tags_catalogo;
create policy admin_bko_write_delete
  on public.observacao_tags_catalogo
  for delete
  to authenticated
  using (
    has_role((select auth.uid()), 'admin'::app_role)
    or has_role((select auth.uid()), 'bko'::app_role)
  );

insert into public.observacao_tags_catalogo (nome, slug, cor, icone, ordem)
values
  ('Cancelamento', 'cancelamento', 'red', 'x-circle', 10),
  ('Suporte', 'suporte', 'blue', 'headphones', 20),
  ('Observação', 'observacao', 'yellow', 'message-square', 30),
  ('Endereço', 'endereco', 'emerald', 'house', 40)
on conflict (slug) do nothing;

alter table public.venda_observacoes
  add column if not exists tag_id uuid references public.observacao_tags_catalogo(id) on delete set null,
  add column if not exists tag_nome_snapshot text,
  add column if not exists tag_cor_snapshot text,
  add column if not exists tag_icone_snapshot text,
  add column if not exists tag_slug_snapshot text;

-- Observações antigas viram "Observação" sem perder texto, autor ou datas.
update public.venda_observacoes as o
set
  tag_id = coalesce(o.tag_id, t.id),
  tag_nome_snapshot = coalesce(o.tag_nome_snapshot, t.nome),
  tag_cor_snapshot = coalesce(o.tag_cor_snapshot, t.cor),
  tag_icone_snapshot = coalesce(o.tag_icone_snapshot, t.icone),
  tag_slug_snapshot = coalesce(o.tag_slug_snapshot, t.slug)
from public.observacao_tags_catalogo as t
where t.slug = 'observacao'
  and (
    o.tag_id is null
    or o.tag_nome_snapshot is null
    or o.tag_cor_snapshot is null
    or o.tag_icone_snapshot is null
    or o.tag_slug_snapshot is null
  );

create index if not exists venda_observacoes_tag_id_idx
  on public.venda_observacoes(tag_id);
