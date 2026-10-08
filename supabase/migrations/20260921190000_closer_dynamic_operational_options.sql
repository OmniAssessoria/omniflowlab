-- Operação Closer: catálogos dinâmicos ONVOX/Take Flow e permissões operacionais.
-- Admin e BKO gerenciam opções; somente BKO movimenta etapa e status de portabilidade.

create table if not exists public.closer_opcoes_catalogo (
  id uuid primary key default gen_random_uuid(),
  categoria text not null,
  valor text not null,
  nome text not null,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint closer_opcoes_catalogo_categoria_chk check (
    categoria in (
      'onvox_order_type',
      'onvox_product',
      'onvox_stage',
      'onvox_portability_status',
      'takeflow_stage'
    )
  ),
  constraint closer_opcoes_catalogo_nome_chk check (length(trim(nome)) > 0),
  constraint closer_opcoes_catalogo_valor_chk check (length(trim(valor)) > 0)
);

create unique index if not exists closer_opcoes_catalogo_categoria_valor_uq
  on public.closer_opcoes_catalogo (categoria, lower(valor));

create index if not exists closer_opcoes_catalogo_lista_idx
  on public.closer_opcoes_catalogo (categoria, ativo, ordem, nome);

alter table public.closer_opcoes_catalogo enable row level security;

grant select, insert, update, delete on public.closer_opcoes_catalogo to authenticated;

drop policy if exists closer_opcoes_catalogo_select on public.closer_opcoes_catalogo;
create policy closer_opcoes_catalogo_select
on public.closer_opcoes_catalogo
for select
to authenticated
using (true);

drop policy if exists closer_opcoes_catalogo_insert on public.closer_opcoes_catalogo;
create policy closer_opcoes_catalogo_insert
on public.closer_opcoes_catalogo
for insert
to authenticated
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
);

drop policy if exists closer_opcoes_catalogo_update on public.closer_opcoes_catalogo;
create policy closer_opcoes_catalogo_update
on public.closer_opcoes_catalogo
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
)
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
);

drop policy if exists closer_opcoes_catalogo_delete on public.closer_opcoes_catalogo;
create policy closer_opcoes_catalogo_delete
on public.closer_opcoes_catalogo
for delete
to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or public.has_role((select auth.uid()), 'bko'::public.app_role)
);

drop trigger if exists trg_closer_opcoes_catalogo_touch on public.closer_opcoes_catalogo;
create trigger trg_closer_opcoes_catalogo_touch
before update on public.closer_opcoes_catalogo
for each row execute function public.closer_touch_updated_at();

insert into public.closer_opcoes_catalogo (categoria, valor, nome, ativo, ordem, created_by)
values
  ('onvox_order_type', 'NOVO', 'Novo', true, 10, null),
  ('onvox_order_type', 'PORTABILIDADE', 'Portabilidade', true, 20, null),
  ('onvox_order_type', 'TT', 'TT', true, 30, null),
  ('onvox_order_type', 'PORTABILIDADE PF', 'Portabilidade PF', true, 40, null),

  ('onvox_product', 'DID', 'DID', true, 10, null),
  ('onvox_product', '0800', '0800', true, 20, null),
  ('onvox_product', 'RAMAIS', 'Ramais', true, 30, null),
  ('onvox_product', '4.004', '4.004', true, 40, null),
  ('onvox_product', 'APARELHO', 'Aparelho', true, 50, null),

  ('onvox_stage', 'CONTRATO', 'Contrato', true, 10, null),
  ('onvox_stage', 'EQUIPAMENTO', 'Equipamento', true, 20, null),
  ('onvox_stage', 'ONBOARDING 1', 'Onboarding 1', true, 30, null),
  ('onvox_stage', 'CONFIGURAÇÃO DO SISTEMA', 'Configuração do sistema', true, 40, null),
  ('onvox_stage', 'TELEFONIA', 'Telefonia', true, 50, null),
  ('onvox_stage', 'ONBOARDING 2', 'Onboarding 2', true, 60, null),
  ('onvox_stage', 'ATIVAÇÃO', 'Ativação', true, 70, null),
  ('onvox_stage', 'FATURAMENTO', 'Faturamento', true, 80, null),
  ('onvox_stage', 'ONBOARDING 3', 'Onboarding 3', true, 90, null),
  ('onvox_stage', 'PERÍODO DE TESTE', 'Período de teste', true, 100, null),
  ('onvox_stage', 'CANCELADO', 'Cancelado', true, 110, null),
  ('onvox_stage', 'PENDÊNCIA COMERCIAL', 'Pendência comercial', true, 120, null),

  ('onvox_portability_status', 'CONCLUÍDO', 'Concluído', true, 10, null),
  ('onvox_portability_status', 'AGUARDANDO', 'Aguardando', true, 20, null),
  ('onvox_portability_status', 'CANCELADA', 'Cancelada', true, 30, null),

  ('takeflow_stage', 'CONTRATO', 'Contrato', true, 10, null),
  ('takeflow_stage', 'EQUIPAMENTO', 'Equipamento', true, 20, null),
  ('takeflow_stage', 'ONBOARDING 1', 'Onboarding 1', true, 30, null),
  ('takeflow_stage', 'CONFIGURAÇÃO DO SISTEMA', 'Configuração do sistema', true, 40, null),
  ('takeflow_stage', 'TELEFONIA', 'Telefonia', true, 50, null),
  ('takeflow_stage', 'ONBOARDING 2', 'Onboarding 2', true, 60, null),
  ('takeflow_stage', 'ATIVAÇÃO', 'Ativação', true, 70, null),
  ('takeflow_stage', 'FATURAMENTO', 'Faturamento', true, 80, null),
  ('takeflow_stage', 'ONBOARDING 3', 'Onboarding 3', true, 90, null),
  ('takeflow_stage', 'PERÍODO DE TESTE', 'Período de teste', true, 100, null),
  ('takeflow_stage', 'CANCELADO', 'Cancelado', true, 110, null),
  ('takeflow_stage', 'TREINAMENTO IA', 'Treinamento IA', true, 120, null),
  ('takeflow_stage', 'PENDÊNCIA COMERCIAL', 'Pendência comercial', true, 130, null)
on conflict (categoria, lower(valor)) do update set
  nome = excluded.nome,
  ativo = excluded.ativo,
  ordem = excluded.ordem;

-- NOVO deixa de ser etapa operacional; novos pedidos entram em Contrato.
alter table public.closer_pedidos
  alter column etapa set default 'CONTRATO';

update public.closer_pedidos
set etapa = 'CONTRATO'
where etapa = 'NOVO';

update public.closer_pedidos
set etapa = case etapa
  when 'ONBOARD 1' then 'ONBOARDING 1'
  when 'ONBOARD 2' then 'ONBOARDING 2'
  when 'ONBOARD 3' then 'ONBOARDING 3'
  else etapa
end
where produto = 'TAKE_FLOW'
  and etapa in ('ONBOARD 1', 'ONBOARD 2', 'ONBOARD 3');

-- O Closer continua criando o pedido; a etapa inicial passa a ser CONTRATO.
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
    (public.has_role((select auth.uid()), 'admin'::public.app_role)
      or public.has_role((select auth.uid()), 'gestor'::public.app_role))
    and etapa = 'CONTRATO'
  )
);

-- Nenhum perfil, exceto BKO, pode alterar a etapa operacional.
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

-- Status de portabilidade também é exclusivo do BKO e precisa existir no catálogo ativo.
create or replace function public.closer_guard_item_update()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::public.app_role);
  v_is_gestor boolean := public.has_role(auth.uid(), 'gestor'::public.app_role);
  v_is_bko boolean := public.has_role(auth.uid(), 'bko'::public.app_role);
  v_is_closer boolean := public.has_role(auth.uid(), 'closer'::public.app_role);
  v_status_valid boolean;
begin
  if new.status_portabilidade is distinct from old.status_portabilidade then
    if not v_is_bko then
      raise exception 'O status de portabilidade é exclusivo do BKO.';
    end if;

    if nullif(trim(coalesce(new.status_portabilidade, '')), '') is not null then
      select exists (
        select 1
        from public.closer_opcoes_catalogo c
        where c.categoria = 'onvox_portability_status'
          and c.valor = new.status_portabilidade
          and c.ativo
      ) into v_status_valid;

      if not coalesce(v_status_valid, false) then
        raise exception 'Status de portabilidade inválido ou desativado.';
      end if;
    end if;
  end if;

  if v_is_closer and not (v_is_admin or v_is_gestor or v_is_bko) then
    if new.pedido_id is distinct from old.pedido_id
       or new.data_portabilidade is distinct from old.data_portabilidade
       or new.status_portabilidade is distinct from old.status_portabilidade
       or new.data_entrega is distinct from old.data_entrega then
      raise exception 'Datas e status operacionais dos itens ONVOX são exclusivos da operação responsável.';
    end if;
  end if;

  if v_is_bko and not (v_is_admin or v_is_gestor) then
    if new.pedido_id is distinct from old.pedido_id
       or new.tipo_pedido is distinct from old.tipo_pedido
       or new.produto_item is distinct from old.produto_item
       or new.quantidade is distinct from old.quantidade
       or new.receita is distinct from old.receita
       or new.operadora_doadora is distinct from old.operadora_doadora
       or new.equipamento is distinct from old.equipamento
       or new.modelo is distinct from old.modelo
       or new.quantidade_equipamentos is distinct from old.quantidade_equipamentos then
      raise exception 'O BKO pode alterar apenas os dados operacionais do item ONVOX.';
    end if;
  end if;

  return new;
end;
$$;

-- Admin/Gestor podem continuar criando itens comerciais, mas não pré-preencher status BKO.
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
      select 1 from public.closer_pedidos p
      where p.id = closer_pedido_itens.pedido_id
        and p.closer_id = (select auth.uid())
        and p.produto = 'ONVOX'
    )
  )
  or (
    (public.has_role((select auth.uid()), 'admin'::public.app_role)
      or public.has_role((select auth.uid()), 'gestor'::public.app_role))
    and status_portabilidade is null
  )
);
