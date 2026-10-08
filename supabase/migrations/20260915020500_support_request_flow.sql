-- Solicitações de suporte independentes do funil comercial.
-- O pedido em public.vendas nunca é movido por estas funções.

create sequence if not exists public.suporte_solicitacao_num_seq;
create sequence if not exists public.suporte_ticket_num_seq;

create table if not exists public.suporte_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default (
    'SOL-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.suporte_solicitacao_num_seq')::text, 6, '0')
  ),
  venda_id uuid not null references public.vendas(id) on delete restrict,
  criado_por uuid not null,
  criado_por_nome text,
  motivo text not null check (char_length(btrim(motivo)) > 0),
  status text not null default 'aguardando_criacao'
    check (status in ('aguardando_criacao', 'em_atendimento', 'concluido')),
  ticket_id uuid unique references public.tickets(id) on delete set null,
  card_criado_por uuid,
  card_criado_em timestamptz,
  concluido_por uuid,
  concluido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tickets
  add column if not exists solicitacao_id uuid references public.suporte_solicitacoes(id) on delete set null,
  add column if not exists etapa_suporte_id text;

create unique index if not exists tickets_solicitacao_id_uidx
  on public.tickets(solicitacao_id)
  where solicitacao_id is not null;

alter table public.tickets
  drop constraint if exists tickets_etapa_suporte_id_check;

alter table public.tickets
  add constraint tickets_etapa_suporte_id_check
  check (
    etapa_suporte_id is null or etapa_suporte_id in (
      's-espera', 's-urgente', 's-prevendas', 's-devolutiva', 's-tratar',
      's-retorno-cliente', 's-conferencia', 's-retorno-omni', 's-retorno-interno',
      's-anatel', 's-pendencia-comercial', 's-concluido'
    )
  );

create table if not exists public.suporte_mensagens (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.suporte_solicitacoes(id) on delete cascade,
  autor_id uuid not null,
  autor_nome text,
  autor_role text not null check (autor_role in ('consultor', 'bko')),
  mensagem text not null check (char_length(btrim(mensagem)) > 0),
  anexos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.suporte_leituras (
  solicitacao_id uuid not null references public.suporte_solicitacoes(id) on delete cascade,
  user_id uuid not null,
  last_read_at timestamptz not null default now(),
  primary key (solicitacao_id, user_id)
);

create table if not exists public.suporte_eventos (
  id uuid primary key default gen_random_uuid(),
  solicitacao_id uuid not null references public.suporte_solicitacoes(id) on delete cascade,
  ticket_id uuid references public.tickets(id) on delete set null,
  tipo text not null,
  descricao text not null,
  user_id uuid,
  user_nome text,
  user_role text,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.notificacoes
  add column if not exists solicitacao_id uuid references public.suporte_solicitacoes(id) on delete set null;

create index if not exists suporte_solicitacoes_venda_id_idx on public.suporte_solicitacoes(venda_id);
create index if not exists suporte_solicitacoes_status_idx on public.suporte_solicitacoes(status, created_at desc);
create index if not exists suporte_mensagens_solicitacao_idx on public.suporte_mensagens(solicitacao_id, created_at);
create index if not exists suporte_eventos_solicitacao_idx on public.suporte_eventos(solicitacao_id, created_at desc);
create index if not exists notificacoes_solicitacao_idx on public.notificacoes(solicitacao_id) where solicitacao_id is not null;

-- Atualização automática de updated_at.
drop trigger if exists suporte_solicitacoes_touch_updated_at on public.suporte_solicitacoes;
create trigger suporte_solicitacoes_touch_updated_at
before update on public.suporte_solicitacoes
for each row execute function public.touch_updated_at();

-- RLS: solicitação é visível ao consultor dono/solicitante, a todos os BKOs e para leitura gerencial.
alter table public.suporte_solicitacoes enable row level security;
alter table public.suporte_mensagens enable row level security;
alter table public.suporte_leituras enable row level security;
alter table public.suporte_eventos enable row level security;

create policy "suporte solicitacoes leitura"
on public.suporte_solicitacoes for select to authenticated
using (
  public.has_role(auth.uid(), 'bko'::public.app_role)
  or public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
  or criado_por = auth.uid()
  or exists (
    select 1 from public.vendas v
    where v.id = suporte_solicitacoes.venda_id and v.consultor_id = auth.uid()
  )
);

create policy "suporte mensagens leitura"
on public.suporte_mensagens for select to authenticated
using (
  exists (
    select 1
    from public.suporte_solicitacoes s
    join public.vendas v on v.id = s.venda_id
    where s.id = suporte_mensagens.solicitacao_id
      and (
        public.has_role(auth.uid(), 'bko'::public.app_role)
        or public.has_role(auth.uid(), 'admin'::public.app_role)
        or public.has_role(auth.uid(), 'gestor'::public.app_role)
        or s.criado_por = auth.uid()
        or v.consultor_id = auth.uid()
      )
  )
);

create policy "suporte mensagens insercao"
on public.suporte_mensagens for insert to authenticated
with check (
  autor_id = auth.uid()
  and (
    (autor_role = 'bko' and public.has_role(auth.uid(), 'bko'::public.app_role))
    or (
      autor_role = 'consultor'
      and exists (
        select 1
        from public.suporte_solicitacoes s
        join public.vendas v on v.id = s.venda_id
        where s.id = suporte_mensagens.solicitacao_id
          and (s.criado_por = auth.uid() or v.consultor_id = auth.uid())
      )
    )
  )
);

create policy "suporte leituras proprias leitura"
on public.suporte_leituras for select to authenticated
using (user_id = auth.uid());

create policy "suporte leituras proprias insercao"
on public.suporte_leituras for insert to authenticated
with check (user_id = auth.uid());

create policy "suporte leituras proprias atualizacao"
on public.suporte_leituras for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "suporte eventos leitura"
on public.suporte_eventos for select to authenticated
using (
  exists (
    select 1
    from public.suporte_solicitacoes s
    join public.vendas v on v.id = s.venda_id
    where s.id = suporte_eventos.solicitacao_id
      and (
        public.has_role(auth.uid(), 'bko'::public.app_role)
        or public.has_role(auth.uid(), 'admin'::public.app_role)
        or public.has_role(auth.uid(), 'gestor'::public.app_role)
        or s.criado_por = auth.uid()
        or v.consultor_id = auth.uid()
      )
  )
);

-- Cards do fluxo novo só podem ser alterados por BKO; tickets legados mantêm a regra anterior.
drop policy if exists "atualizacao tickets por perfil" on public.tickets;
create policy "atualizacao tickets por perfil"
on public.tickets for update to authenticated
using (
  (
    solicitacao_id is not null
    and public.has_role(auth.uid(), 'bko'::public.app_role)
  )
  or (
    solicitacao_id is null
    and (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      or public.has_role(auth.uid(), 'gestor'::public.app_role)
      or public.has_role(auth.uid(), 'bko'::public.app_role)
      or public.has_role(auth.uid(), 'suporte'::public.app_role)
      or atribuido_a = auth.uid()
    )
  )
)
with check (
  (
    solicitacao_id is not null
    and public.has_role(auth.uid(), 'bko'::public.app_role)
  )
  or (
    solicitacao_id is null
    and (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      or public.has_role(auth.uid(), 'gestor'::public.app_role)
      or public.has_role(auth.uid(), 'bko'::public.app_role)
      or public.has_role(auth.uid(), 'suporte'::public.app_role)
      or atribuido_a = auth.uid()
    )
  )
);

-- Helpers de auditoria/notificação.
create or replace function public.suporte_nome_usuario(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(p.nome_completo, p.email, 'Usuário')
  from public.profiles p
  where p.id = p_user_id
  limit 1;
$$;

create or replace function public.suporte_registrar_evento(
  p_solicitacao_id uuid,
  p_ticket_id uuid,
  p_tipo text,
  p_descricao text,
  p_user_id uuid,
  p_user_role text,
  p_dados jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.suporte_eventos (
    solicitacao_id, ticket_id, tipo, descricao, user_id, user_nome, user_role, dados
  ) values (
    p_solicitacao_id,
    p_ticket_id,
    p_tipo,
    p_descricao,
    p_user_id,
    public.suporte_nome_usuario(p_user_id),
    p_user_role,
    coalesce(p_dados, '{}'::jsonb)
  );
end;
$$;

-- Criação da solicitação: propositalmente NÃO atualiza public.vendas.
create or replace function public.criar_solicitacao_suporte(p_venda_id uuid, p_motivo text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_solicitacao_id uuid;
  v_nome text;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado';
  end if;

  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Motivo/descrição é obrigatório.';
  end if;

  select * into v_venda
  from public.vendas
  where id = p_venda_id and deleted_at is null and coalesce(is_deleted, false) = false;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if not (
    public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'gestor'::public.app_role)
    or (
      public.has_role(v_user_id, 'consultor'::public.app_role)
      and v_venda.consultor_id = v_user_id
    )
  ) then
    raise exception '403: sem permissão para solicitar suporte deste pedido.';
  end if;

  v_nome := public.suporte_nome_usuario(v_user_id);

  insert into public.suporte_solicitacoes (
    venda_id, criado_por, criado_por_nome, motivo
  ) values (
    p_venda_id, v_user_id, v_nome, btrim(p_motivo)
  )
  returning id into v_solicitacao_id;

  perform public.suporte_registrar_evento(
    v_solicitacao_id, null, 'solicitacao_criada',
    'Solicitação de suporte criada.', v_user_id,
    case when public.has_role(v_user_id, 'consultor'::public.app_role) then 'consultor' else 'gestao' end,
    jsonb_build_object('venda_id', p_venda_id)
  );

  return v_solicitacao_id;
end;
$$;

create or replace function public.criar_card_suporte(p_solicitacao_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_req public.suporte_solicitacoes%rowtype;
  v_venda public.vendas%rowtype;
  v_ticket_id uuid;
  v_ticket_numero text;
begin
  if v_user_id is null or not public.has_role(v_user_id, 'bko'::public.app_role) then
    raise exception '403: somente BKO pode criar card de atendimento.';
  end if;

  select * into v_req
  from public.suporte_solicitacoes
  where id = p_solicitacao_id
  for update;

  if not found then raise exception 'Solicitação não encontrada.'; end if;
  if v_req.ticket_id is not null then return v_req.ticket_id; end if;
  if v_req.status = 'concluido' then
    raise exception 'Reabra a solicitação antes de criar o card.';
  end if;

  select * into v_venda from public.vendas where id = v_req.venda_id;
  if not found then raise exception 'Pedido vinculado não encontrado.'; end if;

  v_ticket_numero := 'TK-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.suporte_ticket_num_seq')::text, 6, '0');

  insert into public.tickets (
    numero, venda_id, solicitacao_id, etapa_suporte_id,
    titulo, descricao, categoria, prioridade, status,
    operadora, cliente_razao_social, cliente_cnpj,
    criado_por, atribuido_a
  ) values (
    v_ticket_numero, v_req.venda_id, v_req.id, 's-espera',
    'Suporte - ' || coalesce(v_venda.cliente_razao_social, v_venda.numero, 'Pedido'),
    v_req.motivo, 'Suporte', coalesce(v_venda.prioridade::text, 'media'), 'aberto',
    v_venda.operadora::text, coalesce(v_venda.cliente_razao_social, 'Cliente não informado'), v_venda.cliente_cnpj,
    v_req.criado_por, null
  )
  returning id into v_ticket_id;

  update public.suporte_solicitacoes
  set ticket_id = v_ticket_id,
      status = 'em_atendimento',
      card_criado_por = v_user_id,
      card_criado_em = now(),
      concluido_por = null,
      concluido_em = null
  where id = v_req.id;

  perform public.suporte_registrar_evento(
    v_req.id, v_ticket_id, 'card_criado',
    'Card de atendimento criado em Suportes em Espera.',
    v_user_id, 'bko', jsonb_build_object('etapa_id', 's-espera', 'ticket_numero', v_ticket_numero)
  );

  return v_ticket_id;
end;
$$;

create or replace function public.mover_card_suporte(p_solicitacao_id uuid, p_etapa_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_req public.suporte_solicitacoes%rowtype;
  v_etapa_nome text;
begin
  if v_user_id is null or not public.has_role(v_user_id, 'bko'::public.app_role) then
    raise exception '403: somente BKO pode movimentar cards de suporte.';
  end if;

  if p_etapa_id not in (
    's-espera', 's-urgente', 's-prevendas', 's-devolutiva', 's-tratar',
    's-retorno-cliente', 's-conferencia', 's-retorno-omni', 's-retorno-interno',
    's-anatel', 's-pendencia-comercial', 's-concluido'
  ) then
    raise exception 'Etapa de suporte inválida.';
  end if;

  select * into v_req from public.suporte_solicitacoes where id = p_solicitacao_id for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  if v_req.ticket_id is null then raise exception 'A solicitação ainda não possui card de atendimento.'; end if;

  update public.tickets
  set etapa_suporte_id = p_etapa_id,
      status = case when p_etapa_id = 's-concluido' then 'resolvido' else 'em_atendimento' end,
      resolvido_em = case when p_etapa_id = 's-concluido' then now() else null end,
      updated_at = now()
  where id = v_req.ticket_id;

  update public.suporte_solicitacoes
  set status = case when p_etapa_id = 's-concluido' then 'concluido' else 'em_atendimento' end,
      concluido_por = case when p_etapa_id = 's-concluido' then v_user_id else null end,
      concluido_em = case when p_etapa_id = 's-concluido' then now() else null end
  where id = v_req.id;

  v_etapa_nome := case p_etapa_id
    when 's-espera' then 'Suportes em Espera'
    when 's-urgente' then 'Urgente'
    when 's-prevendas' then 'Pré Vendas'
    when 's-devolutiva' then 'Devolutiva do Consultor'
    when 's-tratar' then 'A Tratar'
    when 's-retorno-cliente' then 'Aguardando Retorno Cliente'
    when 's-conferencia' then 'Conferência Agendada'
    when 's-retorno-omni' then 'Aguardando Retorno OMNI/DATAVOXX'
    when 's-retorno-interno' then 'Aguardando Retorno Interno'
    when 's-anatel' then 'Aguardando Prazo Anatel/Operadora'
    when 's-pendencia-comercial' then 'Pendência Comercial'
    when 's-concluido' then 'Concluído'
  end;

  perform public.suporte_registrar_evento(
    v_req.id, v_req.ticket_id,
    case when p_etapa_id = 's-concluido' then 'concluido' else 'etapa_alterada' end,
    case when p_etapa_id = 's-concluido'
      then 'Atendimento concluído.'
      else 'Card movido para ' || v_etapa_nome || '.'
    end,
    v_user_id, 'bko', jsonb_build_object('etapa_id', p_etapa_id, 'etapa_nome', v_etapa_nome)
  );
end;
$$;

create or replace function public.resolver_solicitacao_suporte(p_solicitacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_req public.suporte_solicitacoes%rowtype;
begin
  if v_user_id is null or not public.has_role(v_user_id, 'bko'::public.app_role) then
    raise exception '403: somente BKO pode concluir solicitações de suporte.';
  end if;

  select * into v_req from public.suporte_solicitacoes where id = p_solicitacao_id for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;

  if v_req.ticket_id is not null then
    update public.tickets
    set etapa_suporte_id = 's-concluido', status = 'resolvido', resolvido_em = now(), updated_at = now()
    where id = v_req.ticket_id;
  end if;

  update public.suporte_solicitacoes
  set status = 'concluido', concluido_por = v_user_id, concluido_em = now()
  where id = v_req.id;

  perform public.suporte_registrar_evento(
    v_req.id, v_req.ticket_id, 'concluido',
    case when v_req.ticket_id is null then 'Solicitação resolvida na triagem.' else 'Atendimento concluído.' end,
    v_user_id, 'bko', jsonb_build_object('resolvido_na_triagem', v_req.ticket_id is null)
  );
end;
$$;

create or replace function public.reabrir_solicitacao_suporte(p_solicitacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_req public.suporte_solicitacoes%rowtype;
begin
  if v_user_id is null or not public.has_role(v_user_id, 'bko'::public.app_role) then
    raise exception '403: somente BKO pode reabrir solicitações de suporte.';
  end if;

  select * into v_req from public.suporte_solicitacoes where id = p_solicitacao_id for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;

  if v_req.ticket_id is not null then
    update public.tickets
    set etapa_suporte_id = 's-espera', status = 'aberto', resolvido_em = null, updated_at = now()
    where id = v_req.ticket_id;

    update public.suporte_solicitacoes
    set status = 'em_atendimento', concluido_por = null, concluido_em = null
    where id = v_req.id;
  else
    update public.suporte_solicitacoes
    set status = 'aguardando_criacao', concluido_por = null, concluido_em = null
    where id = v_req.id;
  end if;

  perform public.suporte_registrar_evento(
    v_req.id, v_req.ticket_id, 'reaberto',
    case when v_req.ticket_id is null
      then 'Solicitação reaberta e aguardando criação do atendimento.'
      else 'Atendimento reaberto em Suportes em Espera.'
    end,
    v_user_id, 'bko', jsonb_build_object('etapa_id', case when v_req.ticket_id is null then null else 's-espera' end)
  );
end;
$$;

-- Notifica todos os BKOs quando nasce uma solicitação.
create or replace function public.notify_suporte_solicitacao_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notificacoes (
    user_id, tipo, titulo, descricao, venda_id, ticket_id, solicitacao_id, link, criticidade
  )
  select distinct
    ur.user_id,
    'suporte_solicitacao',
    'Nova solicitação de suporte',
    coalesce(new.criado_por_nome, 'Consultor') || ': ' || left(new.motivo, 180),
    new.venda_id,
    new.ticket_id,
    new.id,
    '/suporte/' || new.id::text,
    'media'
  from public.user_roles ur
  where ur.role = 'bko'::public.app_role;
  return new;
end;
$$;

drop trigger if exists suporte_solicitacao_notify_insert on public.suporte_solicitacoes;
create trigger suporte_solicitacao_notify_insert
after insert on public.suporte_solicitacoes
for each row execute function public.notify_suporte_solicitacao_created();

-- Mensagens consultor -> todos os BKOs; BKO -> consultor/solicitante.
create or replace function public.notify_suporte_mensagem_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.suporte_solicitacoes%rowtype;
begin
  select * into v_req from public.suporte_solicitacoes where id = new.solicitacao_id;

  if new.autor_role = 'bko' then
    if v_req.criado_por is not null and v_req.criado_por <> new.autor_id then
      insert into public.notificacoes (
        user_id, tipo, titulo, descricao, venda_id, ticket_id, solicitacao_id, link, criticidade
      ) values (
        v_req.criado_por,
        'suporte_mensagem',
        'Nova resposta do suporte',
        coalesce(new.autor_nome, 'BKO') || ': ' || left(new.mensagem, 180),
        v_req.venda_id,
        v_req.ticket_id,
        v_req.id,
        '/suporte/' || v_req.id::text,
        'info'
      );
    end if;
  else
    insert into public.notificacoes (
      user_id, tipo, titulo, descricao, venda_id, ticket_id, solicitacao_id, link, criticidade
    )
    select distinct
      ur.user_id,
      'suporte_mensagem',
      'Nova mensagem de suporte',
      coalesce(new.autor_nome, 'Consultor') || ': ' || left(new.mensagem, 180),
      v_req.venda_id,
      v_req.ticket_id,
      v_req.id,
      '/suporte/' || v_req.id::text,
      'info'
    from public.user_roles ur
    where ur.role = 'bko'::public.app_role
      and ur.user_id <> new.autor_id;
  end if;

  return new;
end;
$$;

drop trigger if exists suporte_mensagem_notify_insert on public.suporte_mensagens;
create trigger suporte_mensagem_notify_insert
after insert on public.suporte_mensagens
for each row execute function public.notify_suporte_mensagem_created();

grant execute on function public.criar_solicitacao_suporte(uuid, text) to authenticated;
grant execute on function public.criar_card_suporte(uuid) to authenticated;
grant execute on function public.mover_card_suporte(uuid, text) to authenticated;
grant execute on function public.resolver_solicitacao_suporte(uuid) to authenticated;
grant execute on function public.reabrir_solicitacao_suporte(uuid) to authenticated;

-- Realtime para chat, solicitações, eventos e sininho.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'suporte_solicitacoes'
  ) then
    alter publication supabase_realtime add table public.suporte_solicitacoes;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'suporte_mensagens'
  ) then
    alter publication supabase_realtime add table public.suporte_mensagens;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'suporte_eventos'
  ) then
    alter publication supabase_realtime add table public.suporte_eventos;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end $$;
