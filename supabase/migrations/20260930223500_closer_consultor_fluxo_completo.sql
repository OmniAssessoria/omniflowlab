-- Completa o fluxo de criação ONVOX / Take para Gestor, ADM, BKO, Closer e Consultor.
-- Corrige numeração global sob RLS e trata Consultor como responsável comercial no módulo Closer.

create or replace function public.closer_responsavel_criacao_valido(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    where p.id = p_user_id
      and ur.role::text in ('closer', 'consultor')
      and coalesce(p.ativo, true)
  );
$function$;

revoke all on function public.closer_responsavel_criacao_valido(uuid) from public, anon;
grant execute on function public.closer_responsavel_criacao_valido(uuid) to authenticated;

create or replace function public.closer_atribuir_numero()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
$function$;

revoke all on function public.closer_atribuir_numero() from public, anon, authenticated;

drop policy if exists "closer_pedidos_insert" on public.closer_pedidos;
create policy "closer_pedidos_insert"
on public.closer_pedidos
for insert
to authenticated
with check (
  (
    (
      public.has_role((select auth.uid()), 'closer'::public.app_role)
      or public.has_role((select auth.uid()), 'consultor'::public.app_role)
    )
    and closer_id = (select auth.uid())
    and created_by = (select auth.uid())
    and bko_id is null
    and bko_nome is null
    and etapa = 'CONTRATO'
    and data_recebimento is null
    and data_envio is null
    and data_assinatura is null
    and data_implantacao is null
    and data_ativacao is null
    and erro is null
    and observacao_bko is null
    and concluido_em is null
    and cancelado_em is null
  )
  or
  (
    (
      public.has_role((select auth.uid()), 'bko'::public.app_role)
      or public.has_role((select auth.uid()), 'admin'::public.app_role)
      or public.has_role((select auth.uid()), 'gestor'::public.app_role)
    )
    and created_by = (select auth.uid())
    and etapa = 'CONTRATO'
    and bko_id is null
    and bko_nome is null
    and data_recebimento is null
    and data_envio is null
    and data_assinatura is null
    and data_implantacao is null
    and data_ativacao is null
    and erro is null
    and observacao_bko is null
    and concluido_em is null
    and cancelado_em is null
    and public.closer_responsavel_criacao_valido(closer_id)
  )
);

drop policy if exists "closer_clientes_insert" on public.closer_clientes;
create policy "closer_clientes_insert"
on public.closer_clientes
for insert
to authenticated
with check (
  (
    (
      public.has_role((select auth.uid()), 'closer'::public.app_role)
      or public.has_role((select auth.uid()), 'consultor'::public.app_role)
    )
    and closer_id = (select auth.uid())
    and created_by = (select auth.uid())
  )
  or
  (
    (
      public.has_role((select auth.uid()), 'bko'::public.app_role)
      or public.has_role((select auth.uid()), 'admin'::public.app_role)
      or public.has_role((select auth.uid()), 'gestor'::public.app_role)
    )
    and created_by = (select auth.uid())
    and public.closer_responsavel_criacao_valido(closer_id)
  )
);

create or replace function public.closer_editar_informacoes_pedido(
  p_pedido_id uuid,
  p_razao_social text,
  p_cnpj text,
  p_contato text,
  p_telefone text,
  p_email text,
  p_origem_lead text,
  p_produto text,
  p_observacao text
)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_pedido public.closer_pedidos%rowtype;
  v_stage_category text;
  v_stage text;
  v_stage_valid boolean;
  v_uid uuid := auth.uid();
  v_allowed boolean;
  v_responsavel_comercial boolean;
begin
  v_responsavel_comercial :=
    public.has_role(v_uid, 'closer'::public.app_role)
    or public.has_role(v_uid, 'consultor'::public.app_role);

  v_allowed :=
    public.has_role(v_uid, 'admin'::public.app_role)
    or public.has_role(v_uid, 'bko'::public.app_role)
    or v_responsavel_comercial;

  if not v_allowed then
    raise exception 'Perfil sem permissão para editar as informações do pedido.';
  end if;

  select * into v_pedido
  from public.closer_pedidos
  where id = p_pedido_id;

  if not found then
    raise exception 'Pedido não encontrado ou sem acesso.';
  end if;

  if v_responsavel_comercial
     and not public.has_role(v_uid, 'admin'::public.app_role)
     and not public.has_role(v_uid, 'bko'::public.app_role)
     and v_pedido.closer_id <> v_uid then
    raise exception 'O responsável comercial só pode editar os próprios pedidos.';
  end if;

  if p_produto not in ('ONVOX', 'TAKE_FLOW') then
    raise exception 'Produto inválido.';
  end if;

  if nullif(btrim(p_razao_social), '') is null
     or nullif(btrim(p_cnpj), '') is null
     or nullif(btrim(p_contato), '') is null
     or nullif(btrim(p_telefone), '') is null
     or nullif(btrim(p_email), '') is null
     or nullif(btrim(p_origem_lead), '') is null then
    raise exception 'Preencha todos os dados obrigatórios do cliente.';
  end if;

  update public.closer_clientes
     set razao_social = btrim(p_razao_social),
         cnpj = btrim(p_cnpj),
         contato = btrim(p_contato),
         telefone = btrim(p_telefone),
         email = lower(btrim(p_email)),
         origem_lead = btrim(p_origem_lead)
   where id = v_pedido.cliente_id;

  v_stage := v_pedido.etapa;

  if p_produto is distinct from v_pedido.produto then
    v_stage_category := case p_produto
      when 'ONVOX' then 'onvox_stage'
      when 'TAKE_FLOW' then 'takeflow_stage'
    end;

    select exists (
      select 1
      from public.closer_opcoes_catalogo c
      where c.categoria = v_stage_category
        and c.valor = v_stage
        and c.ativo
    ) into v_stage_valid;

    if not coalesce(v_stage_valid, false) then
      v_stage := 'CONTRATO';
    end if;
  end if;

  update public.closer_pedidos
     set produto = p_produto,
         etapa = v_stage,
         observacao = nullif(btrim(p_observacao), ''),
         updated_by = v_uid
   where id = p_pedido_id;
end;
$function$;

create or replace function public.closer_preparar_mensagem()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    and ur.role::text in ('bko','closer','consultor')
  order by case ur.role::text
    when 'bko' then 1
    when 'closer' then 2
    when 'consultor' then 3
    else 9
  end
  limit 1;

  new.user_role := v_role;
  return new;
end;
$function$;

create or replace function public.closer_notificar_mensagem()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_pedido public.closer_pedidos%rowtype;
  v_destino uuid;
begin
  select * into v_pedido
  from public.closer_pedidos
  where id = new.pedido_id;

  if new.user_role in ('closer', 'consultor') then
    insert into public.notificacoes (
      user_id, tipo, titulo, descricao, link, criticidade,
      canal, marca, closer_pedido_id
    )
    select distinct
      ur.user_id,
      'closer_mensagem',
      case when new.user_role = 'consultor'
        then 'Nova mensagem do Consultor'
        else 'Nova mensagem do Closer'
      end,
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
$function$;
