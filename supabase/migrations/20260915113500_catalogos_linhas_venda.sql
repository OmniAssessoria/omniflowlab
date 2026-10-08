-- Catálogos comerciais por linha de venda.
-- Produto, tipo de produto e plano permanecem como texto em venda_linhas para
-- preservar a fotografia histórica mesmo após renomear/excluir itens do catálogo.

alter table public.venda_linhas
  add column if not exists tipo_produto text;

-- Migra o tipo antigo do cabeçalho para as linhas existentes sem sobrescrever
-- qualquer valor de linha que já tenha sido definido.
update public.venda_linhas vl
set tipo_produto = v.tipo_pedido
from public.vendas v
where v.id = vl.venda_id
  and vl.tipo_produto is null
  and nullif(trim(v.tipo_pedido), '') is not null;

create table if not exists public.planos_catalogo (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  operadora text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_planos_catalogo_operadora_nome
  on public.planos_catalogo (operadora, lower(nome));

-- Aproveita os planos já usados como ponto de partida do novo catálogo.
insert into public.planos_catalogo (nome, operadora, ativo)
select distinct trim(vl.plano), v.operadora::text, true
from public.venda_linhas vl
join public.vendas v on v.id = vl.venda_id
where nullif(trim(vl.plano), '') is not null
  and lower(trim(vl.plano)) <> lower('Não informado')
on conflict do nothing;

alter table public.planos_catalogo enable row level security;

-- Catálogos não são públicos. Usuários autenticados leem; somente Admin/BKO escrevem.
revoke all on table public.planos_catalogo from anon, authenticated;
grant select, insert, update, delete on table public.planos_catalogo to authenticated;

revoke all on table public.produtos_catalogo from anon, authenticated;
grant select, insert, update, delete on table public.produtos_catalogo to authenticated;

revoke all on table public.tipos_pedido_catalogo from anon, authenticated;
grant select, insert, update, delete on table public.tipos_pedido_catalogo to authenticated;

-- Remove a política legada que concedia escrita a Admin/Gestor.
drop policy if exists admin_gestor_write on public.produtos_catalogo;
drop policy if exists admin_bko_write_insert on public.produtos_catalogo;
drop policy if exists admin_bko_write_update on public.produtos_catalogo;
drop policy if exists admin_bko_write_delete on public.produtos_catalogo;

create policy admin_bko_write_insert
on public.produtos_catalogo for insert
to authenticated
with check (
  has_role((select auth.uid()), 'admin'::app_role)
  or has_role((select auth.uid()), 'bko'::app_role)
);

create policy admin_bko_write_update
on public.produtos_catalogo for update
to authenticated
using (
  has_role((select auth.uid()), 'admin'::app_role)
  or has_role((select auth.uid()), 'bko'::app_role)
)
with check (
  has_role((select auth.uid()), 'admin'::app_role)
  or has_role((select auth.uid()), 'bko'::app_role)
);

create policy admin_bko_write_delete
on public.produtos_catalogo for delete
to authenticated
using (
  has_role((select auth.uid()), 'admin'::app_role)
  or has_role((select auth.uid()), 'bko'::app_role)
);

drop policy if exists admin_gestor_write on public.tipos_pedido_catalogo;
drop policy if exists admin_bko_write_insert on public.tipos_pedido_catalogo;
drop policy if exists admin_bko_write_update on public.tipos_pedido_catalogo;
drop policy if exists admin_bko_write_delete on public.tipos_pedido_catalogo;

create policy admin_bko_write_insert
on public.tipos_pedido_catalogo for insert
to authenticated
with check (
  has_role((select auth.uid()), 'admin'::app_role)
  or has_role((select auth.uid()), 'bko'::app_role)
);

create policy admin_bko_write_update
on public.tipos_pedido_catalogo for update
to authenticated
using (
  has_role((select auth.uid()), 'admin'::app_role)
  or has_role((select auth.uid()), 'bko'::app_role)
)
with check (
  has_role((select auth.uid()), 'admin'::app_role)
  or has_role((select auth.uid()), 'bko'::app_role)
);

create policy admin_bko_write_delete
on public.tipos_pedido_catalogo for delete
to authenticated
using (
  has_role((select auth.uid()), 'admin'::app_role)
  or has_role((select auth.uid()), 'bko'::app_role)
);

drop policy if exists authenticated_read on public.planos_catalogo;
drop policy if exists admin_bko_write_insert on public.planos_catalogo;
drop policy if exists admin_bko_write_update on public.planos_catalogo;
drop policy if exists admin_bko_write_delete on public.planos_catalogo;

create policy authenticated_read
on public.planos_catalogo for select
to authenticated
using ((select auth.uid()) is not null);

create policy admin_bko_write_insert
on public.planos_catalogo for insert
to authenticated
with check (
  has_role((select auth.uid()), 'admin'::app_role)
  or has_role((select auth.uid()), 'bko'::app_role)
);

create policy admin_bko_write_update
on public.planos_catalogo for update
to authenticated
using (
  has_role((select auth.uid()), 'admin'::app_role)
  or has_role((select auth.uid()), 'bko'::app_role)
)
with check (
  has_role((select auth.uid()), 'admin'::app_role)
  or has_role((select auth.uid()), 'bko'::app_role)
);

create policy admin_bko_write_delete
on public.planos_catalogo for delete
to authenticated
using (
  has_role((select auth.uid()), 'admin'::app_role)
  or has_role((select auth.uid()), 'bko'::app_role)
);
