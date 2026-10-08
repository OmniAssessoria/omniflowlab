create table if not exists public.venda_observacoes (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  texto text not null check (length(btrim(texto)) > 0),
  created_by uuid not null,
  autor_nome text not null,
  autor_perfil text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_venda_observacoes_venda_created_at
  on public.venda_observacoes (venda_id, created_at desc);

alter table public.venda_observacoes enable row level security;

create or replace function public.omni_venda_observacao_prepare()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nome text;
  v_perfil text;
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();

    select p.nome_completo
      into v_nome
      from public.profiles p
     where p.id = auth.uid()
     limit 1;

    select ur.role::text
      into v_perfil
      from public.user_roles ur
     where ur.user_id = auth.uid()
     order by ur.role::text
     limit 1;

    new.autor_nome := coalesce(nullif(btrim(v_nome), ''), 'Usuário');
    new.autor_perfil := coalesce(nullif(btrim(v_perfil), ''), 'usuário');
    new.created_at := coalesce(new.created_at, now());
  else
    new.created_by := old.created_by;
    new.autor_nome := old.autor_nome;
    new.autor_perfil := old.autor_perfil;
    new.created_at := old.created_at;
  end if;

  new.texto := btrim(new.texto);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.omni_venda_observacao_prepare() from public, anon;
grant execute on function public.omni_venda_observacao_prepare() to authenticated;

drop trigger if exists trg_venda_observacao_prepare on public.venda_observacoes;
create trigger trg_venda_observacao_prepare
before insert or update on public.venda_observacoes
for each row execute function public.omni_venda_observacao_prepare();

drop policy if exists "Observações visíveis para quem vê a venda" on public.venda_observacoes;
create policy "Observações visíveis para quem vê a venda"
on public.venda_observacoes
for select
to authenticated
using (
  exists (
    select 1 from public.vendas v
    where v.id = venda_observacoes.venda_id
  )
);

drop policy if exists "Usuário com acesso cria observação" on public.venda_observacoes;
create policy "Usuário com acesso cria observação"
on public.venda_observacoes
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.vendas v
    where v.id = venda_observacoes.venda_id
  )
);

drop policy if exists "Autor edita própria observação" on public.venda_observacoes;
create policy "Autor edita própria observação"
on public.venda_observacoes
for update
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1 from public.vendas v
    where v.id = venda_observacoes.venda_id
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.vendas v
    where v.id = venda_observacoes.venda_id
  )
);

drop policy if exists "Autor exclui própria observação" on public.venda_observacoes;
create policy "Autor exclui própria observação"
on public.venda_observacoes
for delete
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1 from public.vendas v
    where v.id = venda_observacoes.venda_id
  )
);
