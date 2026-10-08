-- Operação Closer: permitir criação de pedidos por BKO e Admin.
-- O pedido continua obrigatoriamente vinculado a um Closer responsável.

-- BKO/Admin precisam conseguir listar os Closers ativos sem ampliar a leitura
-- geral das tabelas profiles/user_roles.
create or replace function public.closer_listar_responsaveis_criacao()
returns table (
  id uuid,
  nome text,
  email text
)
language sql
security definer
set search_path = public
stable
as $$
  select distinct
    p.id,
    coalesce(nullif(btrim(p.nome_completo), ''), p.email, 'Closer') as nome,
    p.email
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  where ur.role::text = 'closer'
    and coalesce(p.ativo, true)
    and (
      public.has_role(auth.uid(), 'bko'::public.app_role)
      or public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  order by 2;
$$;

revoke all on function public.closer_listar_responsaveis_criacao() from public, anon;
grant execute on function public.closer_listar_responsaveis_criacao() to authenticated;

-- Um Closer também deve conseguir ler o cadastro de um cliente quando existir
-- um pedido desse cliente atribuído a ele, mesmo que o registro-base do cliente
-- tenha sido criado originalmente por outro usuário.
drop policy if exists closer_clientes_select on public.closer_clientes;
create policy closer_clientes_select
on public.closer_clientes
for select
to authenticated
using (
  closer_id = (select auth.uid())
  or exists (
    select 1
    from public.closer_pedidos p
    where p.cliente_id = closer_clientes.id
      and p.closer_id = (select auth.uid())
  )
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
);

-- BKO pode criar o cadastro-base do cliente em nome do Closer escolhido.
drop policy if exists closer_clientes_insert on public.closer_clientes;
create policy closer_clientes_insert
on public.closer_clientes
for insert
to authenticated
with check (
  (
    public.has_role((select auth.uid()), 'closer'::public.app_role)
    and closer_id = (select auth.uid())
    and created_by = (select auth.uid())
  )
  or (
    public.has_role((select auth.uid()), 'bko'::public.app_role)
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = closer_clientes.closer_id
        and ur.role::text = 'closer'
    )
  )
  or public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'gestor'::public.app_role)
);

-- Pedido: mantém o fluxo do Closer e adiciona BKO, sempre iniciando em CONTRATO.
drop policy if exists closer_pedidos_insert on public.closer_pedidos;
create policy closer_pedidos_insert
on public.closer_pedidos
for insert
to authenticated
with check (
  (
    public.has_role((select auth.uid()), 'closer'::public.app_role)
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
  or (
    public.has_role((select auth.uid()), 'bko'::public.app_role)
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
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = closer_pedidos.closer_id
        and ur.role::text = 'closer'
    )
  )
  or (
    (
      public.has_role((select auth.uid()), 'admin'::public.app_role)
      or public.has_role((select auth.uid()), 'gestor'::public.app_role)
    )
    and etapa = 'CONTRATO'
  )
);

-- Itens ONVOX: BKO também pode inserir os itens comerciais na criação,
-- sem preencher campos operacionais que continuam pertencendo ao acompanhamento.
drop policy if exists closer_pedido_itens_insert on public.closer_pedido_itens;
create policy closer_pedido_itens_insert
on public.closer_pedido_itens
for insert
to authenticated
with check (
  (
    public.has_role((select auth.uid()), 'closer'::public.app_role)
    and created_by = (select auth.uid())
    and data_portabilidade is null
    and status_portabilidade is null
    and data_entrega is null
    and exists (
      select 1
      from public.closer_pedidos p
      where p.id = closer_pedido_itens.pedido_id
        and p.closer_id = (select auth.uid())
        and p.produto = 'ONVOX'
    )
  )
  or (
    public.has_role((select auth.uid()), 'bko'::public.app_role)
    and created_by = (select auth.uid())
    and data_portabilidade is null
    and status_portabilidade is null
    and data_entrega is null
    and exists (
      select 1
      from public.closer_pedidos p
      where p.id = closer_pedido_itens.pedido_id
        and p.produto = 'ONVOX'
    )
  )
  or (
    (
      public.has_role((select auth.uid()), 'admin'::public.app_role)
      or public.has_role((select auth.uid()), 'gestor'::public.app_role)
    )
    and status_portabilidade is null
  )
);

-- Não avisa o próprio criador quando o pedido foi aberto por BKO/Admin.
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
      coalesce(public.omni_usuario_nome(new.created_by), new.closer_nome, 'Usuário')
    ),
    '/operacao-closer/' || new.id::text,
    'info',
    'closer',
    new.produto,
    new.id
  from public.user_roles ur
  where ur.role::text = 'bko'
    and ur.user_id <> coalesce(new.created_by, new.closer_id);

  return new;
end;
$$;

revoke all on function public.closer_notificar_novo_pedido() from public, anon, authenticated;
