create table if not exists public.venda_consultor_notas (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  conteudo text not null check (length(btrim(conteudo)) between 1 and 10000),
  created_by uuid not null references auth.users(id) on delete restrict,
  autor_nome text not null,
  created_at timestamptz not null default now()
);

create index if not exists venda_consultor_notas_venda_created_idx
  on public.venda_consultor_notas (venda_id, created_at desc);

alter table public.venda_consultor_notas enable row level security;

revoke all on table public.venda_consultor_notas from anon;
revoke all on table public.venda_consultor_notas from authenticated;
grant select, insert on table public.venda_consultor_notas to authenticated;
grant select, insert, update, delete on table public.venda_consultor_notas to service_role;

drop policy if exists "Notas consultor visíveis por perfis autorizados" on public.venda_consultor_notas;
create policy "Notas consultor visíveis por perfis autorizados"
on public.venda_consultor_notas
for select
to authenticated
using (
  exists (
    select 1
    from public.vendas v
    where v.id = venda_consultor_notas.venda_id
      and (
        public.has_role((select auth.uid()), 'admin'::app_role)
        or public.has_role((select auth.uid()), 'gestor'::app_role)
        or (
          public.has_role((select auth.uid()), 'consultor'::app_role)
          and v.consultor_id = (select auth.uid())
        )
      )
  )
);

drop policy if exists "Notas consultor inseridas apenas na assinatura aberta" on public.venda_consultor_notas;
create policy "Notas consultor inseridas apenas na assinatura aberta"
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
        public.has_role((select auth.uid()), 'admin'::app_role)
        or public.has_role((select auth.uid()), 'gestor'::app_role)
        or (
          public.has_role((select auth.uid()), 'consultor'::app_role)
          and v.consultor_id = (select auth.uid())
        )
      )
  )
);
