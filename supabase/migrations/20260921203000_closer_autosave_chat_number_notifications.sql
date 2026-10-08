-- Operação Closer: numeração contínua, conversa Closer/BKO, contexto de notificações
-- e data de entrega no nível do pedido.

-- 1) Numeração legível e contínua: usa o menor número positivo disponível.
alter table public.closer_pedidos alter column numero drop identity if exists;
drop sequence if exists public.closer_pedidos_numero_seq;

-- Compacta a numeração atual sem colisões com o índice único.
update public.closer_pedidos
set numero = -abs(numero)
where numero > 0;

with ranked as (
  select id, row_number() over (order by created_at, id)::bigint as novo_numero
  from public.closer_pedidos
)
update public.closer_pedidos p
set numero = r.novo_numero
from ranked r
where r.id = p.id;

create or replace function public.closer_atribuir_numero()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_numero bigint;
begin
  if new.numero is not null and new.numero > 0 then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('closer_pedidos_numero', 0));

  select gs
    into v_numero
  from generate_series(
    1::bigint,
    coalesce((select max(numero) from public.closer_pedidos where numero > 0), 0) + 1
  ) as gs
  where not exists (
    select 1 from public.closer_pedidos p where p.numero = gs
  )
  order by gs
  limit 1;

  new.numero := coalesce(v_numero, 1);
  return new;
end;
$$;

drop trigger if exists trg_closer_pedidos_numero on public.closer_pedidos;
create trigger trg_closer_pedidos_numero
before insert on public.closer_pedidos
for each row execute function public.closer_atribuir_numero();

-- 2) Data de entrega também no cabeçalho operacional de ONVOX e Take Flow.
alter table public.closer_pedidos
  add column if not exists data_entrega date;

-- 3) Contexto explícito para separar notificações do BKO em dois sinos.
alter table public.notificacoes
  add column if not exists canal text,
  add column if not exists marca text,
  add column if not exists closer_pedido_id uuid references public.closer_pedidos(id) on delete cascade;

create index if not exists notificacoes_user_canal_lida_idx
  on public.notificacoes(user_id, canal, lida, created_at desc);

create or replace function public.preencher_contexto_notificacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_marca text;
begin
  if new.canal is null or trim(new.canal) = '' then
    new.canal := case
      when new.tipo like 'closer_%' or new.closer_pedido_id is not null then 'closer'
      else 'operadoras'
    end;
  end if;

  if new.marca is null or trim(new.marca) = '' then
    if new.closer_pedido_id is not null then
      select p.produto into v_marca
      from public.closer_pedidos p
      where p.id = new.closer_pedido_id;
    elsif new.venda_id is not null then
      select v.operadora::text into v_marca
      from public.vendas v
      where v.id = new.venda_id;
    elsif new.ticket_id is not null then
      select t.operadora::text into v_marca
      from public.tickets t
      where t.id = new.ticket_id;
    elsif new.solicitacao_id is not null then
      select coalesce(t.operadora::text, v.operadora::text)
        into v_marca
      from public.suporte_solicitacoes s
      left join public.tickets t on t.id = s.ticket_id
      left join public.vendas v on v.id = s.venda_id
      where s.id = new.solicitacao_id;
    end if;

    new.marca := v_marca;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notificacoes_contexto on public.notificacoes;
create trigger trg_notificacoes_contexto
before insert or update of venda_id, ticket_id, solicitacao_id, closer_pedido_id, canal, marca
on public.notificacoes
for each row execute function public.preencher_contexto_notificacao();

update public.notificacoes n
set canal = coalesce(n.canal, 'operadoras'),
    marca = coalesce(
      n.marca,
      (select v.operadora::text from public.vendas v where v.id = n.venda_id),
      (select t.operadora::text from public.tickets t where t.id = n.ticket_id),
      (
        select coalesce(t.operadora::text, v.operadora::text)
        from public.suporte_solicitacoes s
        left join public.tickets t on t.id = s.ticket_id
        left join public.vendas v on v.id = s.venda_id
        where s.id = n.solicitacao_id
      )
    )
where n.canal is null or n.marca is null;

-- 4) Conversa vinculada ao pedido.
create table if not exists public.closer_pedido_mensagens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.closer_pedidos(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  user_nome text,
  user_role text,
  mensagem text not null,
  created_at timestamptz not null default now(),
  constraint closer_pedido_mensagens_texto_chk check (length(trim(mensagem)) between 1 and 4000)
);

create index if not exists closer_pedido_mensagens_pedido_idx
  on public.closer_pedido_mensagens(pedido_id, created_at);

alter table public.closer_pedido_mensagens enable row level security;
grant select, insert on public.closer_pedido_mensagens to authenticated;

drop policy if exists closer_pedido_mensagens_select on public.closer_pedido_mensagens;
create policy closer_pedido_mensagens_select
on public.closer_pedido_mensagens
for select
to authenticated
using (
  exists (
    select 1
    from public.closer_pedidos p
    where p.id = closer_pedido_mensagens.pedido_id
      and (
        p.closer_id = (select auth.uid())
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
        or public.has_role((select auth.uid()), 'admin'::public.app_role)
        or public.has_role((select auth.uid()), 'gestor'::public.app_role)
      )
  )
);

drop policy if exists closer_pedido_mensagens_insert on public.closer_pedido_mensagens;
create policy closer_pedido_mensagens_insert
on public.closer_pedido_mensagens
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.closer_pedidos p
    where p.id = closer_pedido_mensagens.pedido_id
      and (
        (
          public.has_role((select auth.uid()), 'closer'::public.app_role)
          and p.closer_id = (select auth.uid())
        )
        or public.has_role((select auth.uid()), 'bko'::public.app_role)
      )
  )
);

create or replace function public.closer_preparar_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  new.user_id := auth.uid();
  new.mensagem := trim(new.mensagem);

  select coalesce(p.nome_completo, p.email, 'Usuário')
    into new.user_nome
  from public.profiles p
  where p.id = auth.uid();

  select ur.role::text
    into v_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and ur.role::text in ('bko','closer')
  order by case ur.role::text when 'bko' then 1 else 2 end
  limit 1;

  new.user_role := v_role;
  return new;
end;
$$;

drop trigger if exists trg_closer_mensagem_prepare on public.closer_pedido_mensagens;
create trigger trg_closer_mensagem_prepare
before insert on public.closer_pedido_mensagens
for each row execute function public.closer_preparar_mensagem();

create or replace function public.closer_notificar_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.closer_pedidos%rowtype;
  v_destino uuid;
begin
  select * into v_pedido
  from public.closer_pedidos
  where id = new.pedido_id;

  if new.user_role = 'closer' then
    insert into public.notificacoes (
      user_id, tipo, titulo, descricao, link, criticidade,
      canal, marca, closer_pedido_id
    )
    select distinct
      ur.user_id,
      'closer_mensagem',
      'Nova mensagem do Closer',
      format(
        'Pedido #%s · %s: %s',
        lpad(v_pedido.numero::text, 4, '0'),
        case v_pedido.produto when 'TAKE_FLOW' then 'Take Flow' else 'ONVOX' end,
        left(new.mensagem, 180)
      ),
      '/operacao-closer/' || v_pedido.id::text,
      'info',
      'closer',
      v_pedido.produto,
      v_pedido.id
    from public.user_roles ur
    where ur.role::text = 'bko'
      and ur.user_id <> new.user_id;
  elsif new.user_role = 'bko' then
    v_destino := v_pedido.closer_id;
    if v_destino is not null and v_destino <> new.user_id then
      insert into public.notificacoes (
        user_id, tipo, titulo, descricao, link, criticidade,
        canal, marca, closer_pedido_id
      )
      values (
        v_destino,
        'closer_mensagem',
        'Nova mensagem do BKO',
        format(
          'Pedido #%s · %s: %s',
          lpad(v_pedido.numero::text, 4, '0'),
          case v_pedido.produto when 'TAKE_FLOW' then 'Take Flow' else 'ONVOX' end,
          left(new.mensagem, 180)
        ),
        '/operacao-closer/' || v_pedido.id::text,
        'info',
        'closer',
        v_pedido.produto,
        v_pedido.id
      );
    end if;
  end if;

  update public.closer_pedidos
  set updated_at = now()
  where id = new.pedido_id;

  return new;
end;
$$;

drop trigger if exists trg_closer_mensagem_notify on public.closer_pedido_mensagens;
create trigger trg_closer_mensagem_notify
after insert on public.closer_pedido_mensagens
for each row execute function public.closer_notificar_mensagem();

create or replace function public.closer_notificar_novo_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notificacoes (
    user_id, tipo, titulo, descricao, link, criticidade,
    canal, marca, closer_pedido_id
  )
  select distinct
    ur.user_id,
    'closer_novo_pedido',
    case new.produto
      when 'TAKE_FLOW' then 'Novo pedido Take Flow'
      else 'Novo pedido ONVOX'
    end,
    format(
      'Pedido #%s criado por %s.',
      lpad(new.numero::text, 4, '0'),
      coalesce(new.closer_nome, 'Closer')
    ),
    '/operacao-closer/' || new.id::text,
    'info',
    'closer',
    new.produto,
    new.id
  from public.user_roles ur
  where ur.role::text = 'bko'
    and ur.user_id <> new.closer_id;

  return new;
end;
$$;

drop trigger if exists trg_closer_pedido_notify_bko on public.closer_pedidos;
create trigger trg_closer_pedido_notify_bko
after insert on public.closer_pedidos
for each row execute function public.closer_notificar_novo_pedido();

-- 5) Guardas: número editável por Admin/BKO/Closer; etapa segue exclusiva do BKO.
create or replace function public.closer_guard_pedido_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  v_is_gestor boolean := public.has_role(auth.uid(), 'gestor'::public.app_role);
  v_is_bko boolean := public.has_role(auth.uid(), 'bko'::public.app_role);
  v_is_closer boolean := public.has_role(auth.uid(), 'closer'::public.app_role);
  v_stage_category text;
  v_stage_valid boolean;
begin
  if new.numero is distinct from old.numero then
    if not (v_is_admin or v_is_bko or v_is_closer) then
      raise exception 'Somente Admin, BKO ou Closer podem editar o número do pedido.';
    end if;
    if new.numero is null or new.numero <= 0 then
      raise exception 'O número do pedido deve ser maior que zero.';
    end if;
  end if;

  if new.etapa is distinct from old.etapa then
    if not v_is_bko then
      raise exception 'A etapa operacional do pedido é exclusiva do BKO.';
    end if;

    v_stage_category := case new.produto
      when 'ONVOX' then 'onvox_stage'
      when 'TAKE_FLOW' then 'takeflow_stage'
      else null
    end;

    select exists (
      select 1
      from public.closer_opcoes_catalogo c
      where c.categoria = v_stage_category
        and c.valor = new.etapa
        and c.ativo
    ) into v_stage_valid;

    if not coalesce(v_stage_valid, false) then
      raise exception 'Etapa operacional inválida ou desativada para este produto.';
    end if;
  end if;

  if v_is_closer and not (v_is_admin or v_is_gestor or v_is_bko) then
    if new.cliente_id is distinct from old.cliente_id
       or new.closer_id is distinct from old.closer_id
       or new.closer_nome is distinct from old.closer_nome
       or new.produto is distinct from old.produto
       or new.bko_id is distinct from old.bko_id
       or new.bko_nome is distinct from old.bko_nome
       or new.etapa is distinct from old.etapa
       or new.data_recebimento is distinct from old.data_recebimento
       or new.data_envio is distinct from old.data_envio
       or new.data_assinatura is distinct from old.data_assinatura
       or new.data_implantacao is distinct from old.data_implantacao
       or new.data_ativacao is distinct from old.data_ativacao
       or new.data_entrega is distinct from old.data_entrega
       or new.erro is distinct from old.erro
       or new.observacao_bko is distinct from old.observacao_bko
       or new.concluido_em is distinct from old.concluido_em
       or new.cancelado_em is distinct from old.cancelado_em then
      raise exception 'Campos operacionais são exclusivos da operação responsável.';
    end if;
  end if;

  if v_is_bko and not (v_is_admin or v_is_gestor) then
    if new.cliente_id is distinct from old.cliente_id
       or new.closer_id is distinct from old.closer_id
       or new.closer_nome is distinct from old.closer_nome
       or new.produto is distinct from old.produto
       or new.observacao is distinct from old.observacao
       or new.receita_total is distinct from old.receita_total
       or new.take_conexoes is distinct from old.take_conexoes
       or new.take_usuarios is distinct from old.take_usuarios
       or new.take_valor_implantacao is distinct from old.take_valor_implantacao then
      raise exception 'O BKO pode alterar apenas o acompanhamento operacional do pedido.';
    end if;
  end if;

  return new;
end;
$$;

-- 6) Histórico inclui número e data de entrega.
create or replace function public.closer_registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_nome text;
  v_role text;
  v_meta jsonb;
begin
  select coalesce(nome_completo, email, 'Sistema')
    into v_nome
    from public.profiles
   where id = uid;

  select role::text
    into v_role
    from public.user_roles
   where user_id = uid
   order by case role
     when 'admin' then 1
     when 'gestor' then 2
     when 'bko' then 3
     when 'closer' then 4
     else 9 end
   limit 1;

  v_meta := jsonb_build_object(
    'user_nome', coalesce(v_nome, 'Sistema'),
    'user_role', coalesce(v_role, 'sistema')
  );

  if tg_op = 'INSERT' then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, valor_novo, metadata)
    values (new.id, uid, 'criacao', new.etapa, v_meta);
    return new;
  end if;

  if new.numero is distinct from old.numero then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata)
    values (new.id, uid, 'campo', 'numero', old.numero::text, new.numero::text, v_meta);
  end if;

  if new.etapa is distinct from old.etapa then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata)
    values (new.id, uid, 'etapa', 'etapa', old.etapa, new.etapa, v_meta);
  end if;

  if new.bko_id is distinct from old.bko_id then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata)
    values (new.id, uid, 'bko', 'bko_id', old.bko_id::text, new.bko_id::text, v_meta);
  end if;

  if new.data_recebimento is distinct from old.data_recebimento then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata)
    values (new.id, uid, 'campo', 'data_recebimento', old.data_recebimento::text, new.data_recebimento::text, v_meta);
  end if;

  if new.data_envio is distinct from old.data_envio then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata)
    values (new.id, uid, 'campo', 'data_envio', old.data_envio::text, new.data_envio::text, v_meta);
  end if;

  if new.data_assinatura is distinct from old.data_assinatura then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata)
    values (new.id, uid, 'campo', 'data_assinatura', old.data_assinatura::text, new.data_assinatura::text, v_meta);
  end if;

  if new.data_implantacao is distinct from old.data_implantacao then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata)
    values (new.id, uid, 'campo', 'data_implantacao', old.data_implantacao::text, new.data_implantacao::text, v_meta);
  end if;

  if new.data_ativacao is distinct from old.data_ativacao then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata)
    values (new.id, uid, 'campo', 'data_ativacao', old.data_ativacao::text, new.data_ativacao::text, v_meta);
  end if;

  if new.data_entrega is distinct from old.data_entrega then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata)
    values (new.id, uid, 'campo', 'data_entrega', old.data_entrega::text, new.data_entrega::text, v_meta);
  end if;

  if new.erro is distinct from old.erro then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata)
    values (new.id, uid, 'pendencia', 'erro', old.erro, new.erro, v_meta);
  end if;

  if new.observacao is distinct from old.observacao then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata)
    values (new.id, uid, 'observacao', 'observacao_closer', old.observacao, new.observacao, v_meta);
  end if;

  if new.observacao_bko is distinct from old.observacao_bko then
    insert into public.closer_pedido_historico(pedido_id, user_id, tipo, campo, valor_anterior, valor_novo, metadata)
    values (new.id, uid, 'observacao', 'observacao_bko', old.observacao_bko, new.observacao_bko, v_meta);
  end if;

  return new;
end;
$$;
