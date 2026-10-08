-- Unifica o relógio de SLA por status, independentemente da origem da alteração.
-- Robô, BKO, Admin/Gestor ou integrações passam pela mesma regra configurada
-- em status_comercial_operadoras. Alterações que não trocam status não reiniciam SLA.

create or replace function public.sync_venda_status_sla_unificado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status_nome text;
  v_evento_em timestamptz;
  v_sla_horas integer;
  v_config_encontrada boolean := false;
  v_status_pedido_mudou boolean := false;
  v_status_comercial_mudou boolean := false;
  v_status_generico_mudou boolean := false;
  v_nome_usuario text;
  v_role text;
begin
  if tg_op = 'INSERT' then
    v_status_pedido_mudou := nullif(btrim(coalesce(new.status_pedido, '')), '') is not null;
    v_status_comercial_mudou := nullif(btrim(coalesce(new.status_comercial_nome, '')), '') is not null;
    v_status_generico_mudou := nullif(btrim(coalesce(new.status, '')), '') is not null;
  else
    v_status_pedido_mudou := new.status_pedido is distinct from old.status_pedido;
    v_status_comercial_mudou := new.status_comercial_nome is distinct from old.status_comercial_nome;
    v_status_generico_mudou := new.status is distinct from old.status;
  end if;

  -- status_pedido_em representa exclusivamente a troca real do Status do Pedido.
  -- Antes desta correção a aplicação também o atualizava ao editar datas/outros campos.
  if v_status_pedido_mudou then
    if nullif(btrim(coalesce(new.status_pedido, '')), '') is null then
      new.status_pedido_em := null;
      new.status_pedido_user_id := null;
      new.status_pedido_user_nome := null;
    else
      if tg_op = 'UPDATE'
         and new.status_pedido_em is distinct from old.status_pedido_em
         and new.status_pedido_em is not null then
        -- Preserva timestamp explícito recebido de integração/automação.
        new.status_pedido_em := new.status_pedido_em;
      else
        new.status_pedido_em := now();
      end if;

      if auth.uid() is null then
        new.status_pedido_user_id := null;
        new.status_pedido_user_nome := null;
      else
        select coalesce(nullif(btrim(p.nome_completo), ''), nullif(btrim(p.email), ''), auth.jwt() ->> 'email', 'Usuário')
          into v_nome_usuario
        from public.profiles p
        where p.id = auth.uid();

        v_role := case
          when public.has_role(auth.uid(), 'admin'::public.app_role) then 'admin'
          when public.has_role(auth.uid(), 'gestor'::public.app_role) then 'gestor'
          when public.has_role(auth.uid(), 'bko'::public.app_role) then 'bko'
          when public.has_role(auth.uid(), 'consultor'::public.app_role) then 'consultor'
          else null
        end;

        new.status_pedido_user_id := auth.uid();
        new.status_pedido_user_nome := coalesce(v_nome_usuario, 'Usuário')
          || case when v_role is not null then ' (' || v_role || ')' else '' end;
      end if;
    end if;
  end if;

  if v_status_comercial_mudou
     and nullif(btrim(coalesce(new.status_comercial_nome, '')), '') is not null then
    if tg_op = 'UPDATE'
       and new.status_comercial_em is distinct from old.status_comercial_em
       and new.status_comercial_em is not null then
      new.status_comercial_em := new.status_comercial_em;
    else
      new.status_comercial_em := now();
    end if;
  end if;

  -- Se houve mudança em uma das duas fontes operacionais, o status vigente é
  -- escolhido pela data real do evento. Remover uma fonte faz a outra voltar
  -- a valer sem reiniciar artificialmente o relógio dela.
  if v_status_pedido_mudou or v_status_comercial_mudou then
    if nullif(btrim(coalesce(new.status_pedido, '')), '') is not null
       and (
         nullif(btrim(coalesce(new.status_comercial_nome, '')), '') is null
         or coalesce(new.status_pedido_em, '-infinity'::timestamptz)
            >= coalesce(new.status_comercial_em, '-infinity'::timestamptz)
       ) then
      v_status_nome := new.status_pedido;
      v_evento_em := coalesce(new.status_pedido_em, now());
    elsif nullif(btrim(coalesce(new.status_comercial_nome, '')), '') is not null then
      v_status_nome := new.status_comercial_nome;
      v_evento_em := coalesce(new.status_comercial_em, now());
    else
      -- Nenhum status operacional vigente: encerra o relógio por status.
      new.sla_horas_atual := null;
      new.sla_metade_em := null;
      new.sla_limite_em := null;
      return new;
    end if;
  elsif v_status_generico_mudou then
    -- O campo legado "status" só interfere no SLA quando o valor também existe
    -- no catálogo oficial de Status Comercial da operadora.
    v_status_nome := new.status;
    v_evento_em := now();
  else
    return new;
  end if;

  select sco.sla_horas
    into v_sla_horas
  from public.status_comercial_operadoras sco
  join public.status_comercial_catalogo c
    on c.id = sco.status_id
   and c.ativo = true
  where sco.operadora = new.operadora
    and sco.ativo = true
    and lower(public.status_comercial_nome_reduzido(coalesce(sco.nome, c.nome)))
        = lower(public.status_comercial_nome_reduzido(v_status_nome))
  order by
    case when lower(btrim(coalesce(sco.nome, c.nome))) = lower(btrim(v_status_nome)) then 0 else 1 end,
    sco.updated_at desc
  limit 1;

  v_config_encontrada := found;

  -- Um status genérico que não pertence ao catálogo de SLA não deve tocar
  -- no relógio operacional atual.
  if not v_config_encontrada and v_status_generico_mudou
     and not (v_status_pedido_mudou or v_status_comercial_mudou) then
    return new;
  end if;

  -- Para status operacionais sem vínculo configurado, não carregamos o SLA
  -- anterior por engano. Status configurado como "Sem SLA" também cai aqui.
  if not v_config_encontrada or v_sla_horas is null then
    new.sla_horas_atual := null;
    new.sla_metade_em := null;
    new.sla_limite_em := null;
    return new;
  end if;

  new.sla_horas_atual := v_sla_horas;
  new.sla_metade_em := v_evento_em + make_interval(secs => v_sla_horas * 1800.0);
  new.sla_limite_em := v_evento_em + make_interval(hours => v_sla_horas);

  return new;
end;
$function$;

drop trigger if exists zzzz_sync_venda_status_sla_unificado on public.vendas;
create trigger zzzz_sync_venda_status_sla_unificado
before insert or update on public.vendas
for each row
execute function public.sync_venda_status_sla_unificado();

-- O backfill abaixo altera apenas metadados/SLA. Desabilitamos temporariamente
-- triggers de usuário para não recalcular clientes, gerar logs ou disparar automações
-- por uma correção histórica. A alteração é transacional e os triggers são reativados.
alter table public.vendas disable trigger user;

-- Corrige metadados que foram contaminados por edições de datas/informações.
update public.vendas
set status_pedido_em = null,
    status_pedido_user_id = null,
    status_pedido_user_nome = null
where nullif(btrim(coalesce(status_pedido, '')), '') is null
  and (
    status_pedido_em is not null
    or status_pedido_user_id is not null
    or status_pedido_user_nome is not null
  );

with ultimo_status_pedido as (
  select distinct on (h.venda_id)
    h.venda_id,
    h.valor_novo as status_nome,
    h.created_at as evento_em,
    h.user_id,
    h.user_nome
  from public.venda_historico h
  where h.campo = 'status_pedido'
    and nullif(btrim(coalesce(h.valor_novo, '')), '') is not null
  order by h.venda_id, h.created_at desc, h.id desc
)
update public.vendas v
set status_pedido_em = u.evento_em,
    status_pedido_user_id = u.user_id,
    status_pedido_user_nome = case
      when u.user_id is null then null
      when v.status_pedido_user_id = u.user_id and v.status_pedido_user_nome is not null
        then v.status_pedido_user_nome
      else u.user_nome
    end
from ultimo_status_pedido u
where v.id = u.venda_id
  and lower(public.status_comercial_nome_reduzido(v.status_pedido))
      = lower(public.status_comercial_nome_reduzido(u.status_nome));

-- Recalcula o SLA atual com a data do evento real, sem reiniciar prazos.
with ultimo_status_pedido as (
  select distinct on (h.venda_id)
    h.venda_id,
    h.valor_novo as status_nome,
    h.created_at as evento_em
  from public.venda_historico h
  where h.campo = 'status_pedido'
    and nullif(btrim(coalesce(h.valor_novo, '')), '') is not null
  order by h.venda_id, h.created_at desc, h.id desc
),
ultimo_status_generico as (
  select distinct on (h.venda_id)
    h.venda_id,
    h.valor_novo as status_nome,
    h.created_at as evento_em
  from public.venda_historico h
  where h.campo = 'status'
    and nullif(btrim(coalesce(h.valor_novo, '')), '') is not null
  order by h.venda_id, h.created_at desc, h.id desc
),
candidatos as (
  select v.id as venda_id, v.operadora, 'status_pedido'::text as origem,
         p.status_nome, p.evento_em
  from public.vendas v
  join ultimo_status_pedido p on p.venda_id = v.id
  where v.deleted_at is null
    and not coalesce(v.is_deleted, false)
    and lower(public.status_comercial_nome_reduzido(v.status_pedido))
        = lower(public.status_comercial_nome_reduzido(p.status_nome))

  union all

  select v.id, v.operadora, 'status_comercial',
         v.status_comercial_nome,
         coalesce(v.status_comercial_em, v.updated_at, v.created_at)
  from public.vendas v
  where v.deleted_at is null
    and not coalesce(v.is_deleted, false)
    and nullif(btrim(coalesce(v.status_comercial_nome, '')), '') is not null

  union all

  select v.id, v.operadora, 'status',
         g.status_nome, g.evento_em
  from public.vendas v
  join ultimo_status_generico g on g.venda_id = v.id
  where v.deleted_at is null
    and not coalesce(v.is_deleted, false)
    and lower(public.status_comercial_nome_reduzido(v.status))
        = lower(public.status_comercial_nome_reduzido(g.status_nome))
),
mapeados as (
  select
    c.venda_id,
    c.origem,
    c.status_nome,
    c.evento_em,
    cfg.sla_horas
  from candidatos c
  join lateral (
    select sco.sla_horas
    from public.status_comercial_operadoras sco
    join public.status_comercial_catalogo cat
      on cat.id = sco.status_id
     and cat.ativo = true
    where sco.operadora = c.operadora
      and sco.ativo = true
      and lower(public.status_comercial_nome_reduzido(coalesce(sco.nome, cat.nome)))
          = lower(public.status_comercial_nome_reduzido(c.status_nome))
    order by
      case when lower(btrim(coalesce(sco.nome, cat.nome))) = lower(btrim(c.status_nome)) then 0 else 1 end,
      sco.updated_at desc
    limit 1
  ) cfg on true
),
vigente as (
  select distinct on (m.venda_id)
    m.*
  from mapeados m
  order by
    m.venda_id,
    m.evento_em desc nulls last,
    case m.origem when 'status_pedido' then 0 when 'status_comercial' then 1 else 2 end
)
update public.vendas v
set sla_horas_atual = x.sla_horas,
    sla_metade_em = case
      when x.sla_horas is null then null
      else x.evento_em + make_interval(secs => x.sla_horas * 1800.0)
    end,
    sla_limite_em = case
      when x.sla_horas is null then null
      else x.evento_em + make_interval(hours => x.sla_horas)
    end
from vigente x
where v.id = x.venda_id;

alter table public.vendas enable trigger user;

revoke all on function public.sync_venda_status_sla_unificado() from public;
