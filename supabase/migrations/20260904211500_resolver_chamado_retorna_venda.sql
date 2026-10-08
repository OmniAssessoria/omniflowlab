-- Quando uma venda entra no funil Suporte, registra automaticamente o funil/etapa de origem.
-- Quando o BKO marca o chamado como resolvido, a venda volta para o ponto exato de origem.

create table if not exists public.venda_suporte_retorno (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references public.vendas(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,
  origem_funil text not null,
  origem_etapa_id text not null,
  suporte_etapa_id text,
  status text not null default 'aberto' check (status in ('aberto', 'resolvido', 'cancelado')),
  aberto_em timestamptz not null default now(),
  resolvido_em timestamptz,
  created_by uuid,
  resolved_by uuid
);

create index if not exists idx_venda_suporte_retorno_venda_aberto
  on public.venda_suporte_retorno (venda_id, aberto_em desc)
  where status = 'aberto';

create index if not exists idx_venda_suporte_retorno_ticket
  on public.venda_suporte_retorno (ticket_id)
  where ticket_id is not null;

alter table public.venda_suporte_retorno enable row level security;

drop policy if exists "Admins gestores bko leem retorno suporte" on public.venda_suporte_retorno;
create policy "Admins gestores bko leem retorno suporte"
  on public.venda_suporte_retorno
  for select
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role in ('admin', 'gestor', 'bko')
    )
  );

create or replace function public.omni_usuario_nome(p_user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select p.nome_completo from public.profiles p where p.id = p_user_id),
    'Sistema'
  );
$$;

create or replace function public.omni_usuario_eh_bko(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = 'bko'
  );
$$;

create or replace function public.omni_registrar_retorno_suporte_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_nome text;
begin
  if new.funil = 'suporte'
     and old.funil is distinct from 'suporte'
     and old.funil is not null
     and old.etapa_id is not null then

    insert into public.venda_suporte_retorno (
      venda_id,
      origem_funil,
      origem_etapa_id,
      suporte_etapa_id,
      created_by
    ) values (
      old.id,
      old.funil,
      old.etapa_id,
      new.etapa_id,
      v_user_id
    );

    v_user_nome := public.omni_usuario_nome(v_user_id);

    insert into public.venda_historico (
      venda_id,
      tipo,
      descricao,
      user_id,
      user_nome
    ) values (
      old.id,
      'funil',
      'SUPORTE_RETORNO:' || jsonb_build_object(
        'origem_funil', old.funil,
        'origem_etapa_id', old.etapa_id,
        'suporte_etapa_id', new.etapa_id,
        'registrado_em', now()
      )::text,
      v_user_id,
      v_user_nome
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_omni_registrar_retorno_suporte_venda on public.vendas;
create trigger trg_omni_registrar_retorno_suporte_venda
  before update of funil, etapa_id on public.vendas
  for each row
  execute function public.omni_registrar_retorno_suporte_venda();

create or replace function public.omni_vincular_ticket_retorno_suporte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.venda_id is not null then
    update public.venda_suporte_retorno
       set ticket_id = new.id
     where id = (
       select vsr.id
       from public.venda_suporte_retorno vsr
       where vsr.venda_id = new.venda_id
         and vsr.status = 'aberto'
         and vsr.ticket_id is null
       order by vsr.aberto_em desc
       limit 1
     );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_omni_vincular_ticket_retorno_suporte on public.tickets;
create trigger trg_omni_vincular_ticket_retorno_suporte
  after insert on public.tickets
  for each row
  execute function public.omni_vincular_ticket_retorno_suporte();

create or replace function public.omni_bloquear_resolucao_chamado_nao_bko()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if new.status = 'resolvido'
     and old.status is distinct from 'resolvido'
     and v_user_id is not null
     and not public.omni_usuario_eh_bko(v_user_id) then
    raise exception 'Somente BKO pode marcar chamado como resolvido.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_omni_bloquear_resolucao_chamado_nao_bko on public.tickets;
create trigger trg_omni_bloquear_resolucao_chamado_nao_bko
  before update of status on public.tickets
  for each row
  execute function public.omni_bloquear_resolucao_chamado_nao_bko();

create or replace function public.omni_restaurar_venda_apos_chamado_resolvido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retorno public.venda_suporte_retorno%rowtype;
  v_user_id uuid := auth.uid();
  v_user_nome text;
begin
  if new.status <> 'resolvido'
     or old.status is not distinct from new.status
     or new.venda_id is null then
    return new;
  end if;

  select *
    into v_retorno
    from public.venda_suporte_retorno vsr
   where vsr.venda_id = new.venda_id
     and vsr.status = 'aberto'
     and (vsr.ticket_id = new.id or vsr.ticket_id is null)
   order by (vsr.ticket_id = new.id) desc, vsr.aberto_em desc
   limit 1;

  v_user_nome := public.omni_usuario_nome(v_user_id);

  if found then
    update public.vendas
       set funil = v_retorno.origem_funil,
           etapa_id = v_retorno.origem_etapa_id,
           dias_na_etapa = 0,
           updated_at = now()
     where id = new.venda_id
       and funil = 'suporte';

    update public.venda_suporte_retorno
       set status = 'resolvido',
           resolvido_em = now(),
           resolved_by = v_user_id,
           ticket_id = coalesce(ticket_id, new.id)
     where id = v_retorno.id;

    insert into public.venda_historico (
      venda_id,
      tipo,
      descricao,
      user_id,
      user_nome
    ) values (
      new.venda_id,
      'funil',
      'Chamado ' || coalesce(new.numero, '') || ' resolvido por BKO. Venda retornada automaticamente do funil Suporte para ' || v_retorno.origem_funil || ' / ' || v_retorno.origem_etapa_id || '.',
      v_user_id,
      v_user_nome
    );
  else
    insert into public.venda_historico (
      venda_id,
      tipo,
      descricao,
      user_id,
      user_nome
    ) values (
      new.venda_id,
      'observacao',
      'Chamado ' || coalesce(new.numero, '') || ' resolvido, mas não havia ponto de retorno salvo para recolocar a venda no funil anterior.',
      v_user_id,
      v_user_nome
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_omni_restaurar_venda_apos_chamado_resolvido on public.tickets;
create trigger trg_omni_restaurar_venda_apos_chamado_resolvido
  after update of status on public.tickets
  for each row
  execute function public.omni_restaurar_venda_apos_chamado_resolvido();
