-- Evolução Operacional 2026-09-16
-- Pedido concluído não reabre; pós-conclusão somente BKO/Admin; Consultor restrito no Processos BKO.

drop function if exists public.pipeline_reabrir_venda(uuid);

drop policy if exists "Admin/Gestor gerenciam vendas" on public.vendas;
drop policy if exists "Consultor edita as próprias vendas" on public.vendas;
drop policy if exists "Admin gerencia vendas" on public.vendas;
drop policy if exists "BKO edita vendas" on public.vendas;
drop policy if exists "Gestor edita vendas abertas" on public.vendas;
drop policy if exists "Consultor edita próprias vendas abertas" on public.vendas;

create policy "Admin gerencia vendas"
on public.vendas for all to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));

create policy "BKO edita vendas"
on public.vendas for update to authenticated
using (public.has_role((select auth.uid()), 'bko'::public.app_role))
with check (public.has_role((select auth.uid()), 'bko'::public.app_role));

create policy "Gestor edita vendas abertas"
on public.vendas for update to authenticated
using (public.has_role((select auth.uid()), 'gestor'::public.app_role) and concluido_em is null)
with check (public.has_role((select auth.uid()), 'gestor'::public.app_role) and concluido_em is null);

create policy "Consultor edita próprias vendas abertas"
on public.vendas for update to authenticated
using (
  public.has_role((select auth.uid()), 'consultor'::public.app_role)
  and consultor_id = (select auth.uid())
  and concluido_em is null
)
with check (
  public.has_role((select auth.uid()), 'consultor'::public.app_role)
  and consultor_id = (select auth.uid())
  and concluido_em is null
);

create or replace function public.guard_vendas_operational_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_admin_bko boolean;
begin
  if v_uid is null then
    return new;
  end if;

  v_is_admin_bko := public.has_role(v_uid,'admin'::public.app_role)
    or public.has_role(v_uid,'bko'::public.app_role);

  if old.concluido_em is not null and not v_is_admin_bko then
    raise exception '403: pedido concluído é somente leitura para Consultor e Gestor.';
  end if;

  if (
    new.data_recebimento is distinct from old.data_recebimento or
    new.data_preenchimento is distinct from old.data_preenchimento or
    new.data_aceite is distinct from old.data_aceite or
    new.data_input is distinct from old.data_input or
    new.data_ativacao is distinct from old.data_ativacao or
    new.data_portabilidade is distinct from old.data_portabilidade or
    new.data_entrega is distinct from old.data_entrega
  ) and not v_is_admin_bko then
    raise exception '403: Datas do Sistema só podem ser alteradas por BKO ou Administrador.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_vendas_operational_update on public.vendas;
create trigger trg_guard_vendas_operational_update
before update on public.vendas
for each row execute function public.guard_vendas_operational_update();

revoke all on function public.guard_vendas_operational_update() from public;

create or replace function public.pipeline_move_venda(p_venda_id uuid, p_etapa_id text)
returns table(funil_id text, etapa_id text, funil_nome text, etapa_nome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_target_funil_id text;
  v_target_funil_nome text;
  v_target_etapa_id text;
  v_target_etapa_nome text;
  v_old_funil_nome text;
  v_old_etapa_nome text;
  v_user_nome text;
  v_roles text;
  v_broad boolean;
  v_consultor boolean;
  v_allowed_consultor_bko text[] := array['bko-pendente','bko-apoio','bko-troca'];
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  v_broad := public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'gestor'::public.app_role)
    or public.has_role(v_user_id, 'bko'::public.app_role);
  v_consultor := public.has_role(v_user_id, 'consultor'::public.app_role);

  if not v_broad and not v_consultor then
    raise exception '403: perfil sem permissão para movimentar pedidos comerciais.';
  end if;

  select * into v_venda
  from public.vendas
  where id = p_venda_id
  for update;

  if not found or v_venda.deleted_at is not null or coalesce(v_venda.is_deleted, false) then
    raise exception 'Pedido não encontrado.';
  end if;
  if coalesce(v_venda.status_pedido, '') in ('cancelado', 'reprovado') then
    raise exception 'Pedido cancelado ou reprovado não pode ser movimentado.';
  end if;
  if v_venda.concluido_em is not null then
    raise exception 'Pedido concluído não pode ser movimentado nem reaberto.';
  end if;
  if v_consultor and not v_broad and v_venda.consultor_id is distinct from v_user_id then
    raise exception '403: consultor sem acesso a este pedido.';
  end if;

  select f.id, f.nome, e.id, e.nome
    into v_target_funil_id, v_target_funil_nome, v_target_etapa_id, v_target_etapa_nome
  from public.pipeline_funis f
  join public.pipeline_etapas e on e.funil_id = f.id
  where e.id = p_etapa_id
    and f.ativo
    and f.participa_fluxo_comercial
    and e.ativo
  for share of f, e;

  if not found then
    raise exception 'Destino comercial inválido ou desativado.';
  end if;
  if v_venda.funil::text = v_target_funil_id and v_venda.etapa_id = v_target_etapa_id then
    raise exception 'O pedido já está neste destino.';
  end if;

  if v_consultor and not v_broad then
    if v_venda.funil::text = 'processos_bko' then
      if not (v_venda.etapa_id = any(v_allowed_consultor_bko)) then
        raise exception '403: consultor não pode movimentar pedido após a faixa permitida de Processos BKO.';
      end if;
      if v_target_funil_id <> 'processos_bko' or not (v_target_etapa_id = any(v_allowed_consultor_bko)) then
        raise exception '403: em Processos BKO o consultor só pode circular entre Pendente Consultor, Apoio Gestão e Troca de Carteira | Abertura de Caso.';
      end if;
    elsif v_target_funil_id = 'processos_bko' and not (v_target_etapa_id = any(v_allowed_consultor_bko)) then
      raise exception '403: consultor só pode entrar em Processos BKO por Pendente Consultor, Apoio Gestão ou Troca de Carteira | Abertura de Caso.';
    end if;
  end if;

  select nome into v_old_funil_nome from public.pipeline_funis where id = v_venda.funil::text;
  select nome into v_old_etapa_nome from public.pipeline_etapas where id = v_venda.etapa_id;
  select coalesce(nome_completo, email, 'Usuário') into v_user_nome from public.profiles where id = v_user_id;
  select coalesce(string_agg(role::text, ', ' order by role::text), 'sem_perfil') into v_roles
  from public.user_roles where user_id = v_user_id;

  update public.vendas
  set funil = v_target_funil_id::public.funil_enum,
      etapa_id = v_target_etapa_id,
      dias_na_etapa = 0
  where id = p_venda_id;

  insert into public.venda_historico(
    venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome
  ) values (
    p_venda_id,
    'funil'::public.historico_tipo_enum,
    'movimentacao_pipeline',
    v_venda.funil::text || ' / ' || v_venda.etapa_id,
    v_target_funil_id || ' / ' || v_target_etapa_id,
    'Movimentação manual confirmada no Pipeline. Perfil: ' || v_roles || E'\nOrigem: ' ||
      coalesce(v_old_funil_nome, v_venda.funil::text) || ' → ' || coalesce(v_old_etapa_nome, v_venda.etapa_id) ||
      E'\nDestino: ' || v_target_funil_nome || ' → ' || v_target_etapa_nome,
    v_user_id,
    coalesce(v_user_nome, 'Usuário')
  );

  return query select v_target_funil_id, v_target_etapa_id, v_target_funil_nome, v_target_etapa_nome;
end;
$$;
