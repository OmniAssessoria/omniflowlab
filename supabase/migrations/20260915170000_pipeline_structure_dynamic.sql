-- Estrutura dinâmica de funis e etapas.
-- IDs técnicos permanecem imutáveis; somente estado ativo e nome de etapas são administráveis.

create table if not exists public.pipeline_funis (
  id text primary key,
  nome text not null check (char_length(btrim(nome)) > 0),
  ordem integer not null unique,
  ativo boolean not null default true,
  participa_fluxo_comercial boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipeline_funis_ids_check check (id in ('prospeccao','followup','processos_bko','assinatura','suporte'))
);

create table if not exists public.pipeline_etapas (
  id text primary key,
  funil_id text not null references public.pipeline_funis(id) on delete restrict,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  cor text not null,
  ordem integer not null unique,
  ativo boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.pipeline_funis (id, nome, ordem, ativo, participa_fluxo_comercial)
values
  ('prospeccao', 'Prospecção', 1, true, true),
  ('followup', 'Follow Up', 2, true, true),
  ('processos_bko', 'Processos BKO', 3, true, true),
  ('assinatura', 'Assinatura', 4, true, true),
  ('suporte', 'Suporte', 5, true, false)
on conflict (id) do nothing;

insert into public.pipeline_etapas (id, funil_id, nome, cor, ordem, ativo)
values
  ('p-aguardando','prospeccao','Aguardando Início','default',1,true),
  ('p-d1-lig','prospeccao','Dia 1 - Ligação','info',2,true),
  ('p-d2-lig','prospeccao','Dia 2 - Ligação','info',3,true),
  ('p-d2-wpp','prospeccao','Dia 2 - WhatsApp','info',4,true),
  ('p-d3-lig','prospeccao','Dia 3 - Ligação','info',5,true),
  ('p-d4-lig','prospeccao','Dia 4 - Ligação','info',6,true),
  ('p-d4-wpp','prospeccao','Dia 4 - WhatsApp','info',7,true),
  ('p-d5-lig','prospeccao','Dia 5 - Ligação','info',8,true),
  ('p-d5-declinio','prospeccao','Dia 5 - Declínio WhatsApp','destructive',9,true),
  ('p-proposta','prospeccao','Montar Proposta','warning',10,true),
  ('f-proposta','followup','Montar Proposta','warning',11,true),
  ('f-troca','followup','Troca de Carteira','info',12,true),
  ('f-d1','followup','Dia 1 - Follow Up','info',13,true),
  ('f-d2','followup','Dia 2 - Follow Up','info',14,true),
  ('f-d3','followup','Dia 3 - Follow Up','info',15,true),
  ('f-d4-apoio','followup','Dia 4 - Apoio Gestão','warning',16,true),
  ('f-d5','followup','Dia 5 - Follow Up','info',17,true),
  ('f-d6','followup','Dia 6 - Follow Up','info',18,true),
  ('f-d7-declinio','followup','Dia 7 - Declínio WhatsApp','destructive',19,true),
  ('f-contrato','followup','Preenchimento de Contrato','info',20,true),
  ('bko-pendente','processos_bko','Pendente Consultor','warning',21,true),
  ('bko-apoio','processos_bko','Apoio Gestão','info',22,true),
  ('bko-troca','processos_bko','Troca de Carteira | Abertura de Caso','info',23,true),
  ('bko-montar','processos_bko','Montar Pedido','info',24,true),
  ('bko-suporte','processos_bko','Tratativa de Suporte','warning',25,true),
  ('bko-input','processos_bko','Tempo para Input','info',26,true),
  ('bko-enviado','processos_bko','Enviado para Preenchimento','info',27,true),
  ('bko-assinatura','processos_bko','Aguardando Assinatura','info',28,true),
  ('a-aguardando','assinatura','Aguardando Assinatura','warning',29,true),
  ('a-reenvio','assinatura','Aguardando Reenvio','warning',30,true),
  ('a-correcao','assinatura','Correção Cadastral','warning',31,true),
  ('a-d1','assinatura','Dia 1 - Assinatura','info',32,true),
  ('a-d2','assinatura','Dia 2 - Assinatura','info',33,true),
  ('a-d3','assinatura','Dia 3 - Assinatura','info',34,true),
  ('a-d4','assinatura','Dia 4 - Assinatura','info',35,true),
  ('a-confirmar','assinatura','AG Confirmar Assinatura','info',36,true),
  ('a-biometria','assinatura','Aguardando Biometria','warning',37,true),
  ('a-tt','assinatura','Aguardando Concluir TT','warning',38,true),
  ('a-apoio','assinatura','Apoio Gestão','info',39,true),
  ('a-assinado','assinatura','Contrato Assinado - Claro','success',40,true),
  ('a-assinado-vivo','assinatura','Contrato Assinado - Vivo','success',41,true),
  ('s-espera','suporte','Suportes em Espera','warning',42,true),
  ('s-urgente','suporte','Urgente','destructive',43,true),
  ('s-prevendas','suporte','Pré Vendas','info',44,true),
  ('s-devolutiva','suporte','Devolutiva do Consultor','info',45,true),
  ('s-tratar','suporte','A Tratar','info',46,true),
  ('s-retorno-cliente','suporte','Aguardando Retorno Cliente','warning',47,true),
  ('s-conferencia','suporte','Conferência Agendada','info',48,true),
  ('s-retorno-omni','suporte','Aguardando Retorno OMNI/DATAVOXX','warning',49,true),
  ('s-retorno-interno','suporte','Aguardando Retorno Interno','warning',50,true),
  ('s-anatel','suporte','Aguardando Prazo Anatel/Operadora','warning',51,true),
  ('s-pendencia-comercial','suporte','Pendência Comercial','warning',52,true),
  ('s-concluido','suporte','Concluído','success',53,true)
on conflict (id) do nothing;

-- RLS: qualquer autenticado pode ler; escrita direta é proibida.
alter table public.pipeline_funis enable row level security;
alter table public.pipeline_etapas enable row level security;

revoke all on public.pipeline_funis from anon, authenticated;
revoke all on public.pipeline_etapas from anon, authenticated;
grant select on public.pipeline_funis to authenticated;
grant select on public.pipeline_etapas to authenticated;

drop policy if exists "pipeline funis leitura" on public.pipeline_funis;
create policy "pipeline funis leitura"
on public.pipeline_funis for select to authenticated
using (true);

drop policy if exists "pipeline etapas leitura" on public.pipeline_etapas;
create policy "pipeline etapas leitura"
on public.pipeline_etapas for select to authenticated
using (true);

-- Updated_at automático.
drop trigger if exists pipeline_funis_touch_updated_at on public.pipeline_funis;
create trigger pipeline_funis_touch_updated_at
before update on public.pipeline_funis
for each row execute function public.touch_updated_at();

drop trigger if exists pipeline_etapas_touch_updated_at on public.pipeline_etapas;
create trigger pipeline_etapas_touch_updated_at
before update on public.pipeline_etapas
for each row execute function public.touch_updated_at();

-- Helpers internos.
create or replace function public.pipeline_assert_admin_bko()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '401: usuário não autenticado.';
  end if;
  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode alterar a estrutura do pipeline.';
  end if;
end;
$$;

create or replace function public.pipeline_active_sale_count(p_funil_id text, p_etapa_id text default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.vendas v
  where v.deleted_at is null
    and coalesce(v.is_deleted, false) = false
    and coalesce(v.status_pedido, '') not in ('cancelado', 'reprovado')
    and v.funil::text = p_funil_id
    and (p_etapa_id is null or v.etapa_id = p_etapa_id);
$$;

create or replace function public.pipeline_active_support_count(p_etapa_id text default null)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.suporte_solicitacoes s
  left join public.tickets t on t.id = s.ticket_id
  where s.status <> 'concluido'
    and (
      p_etapa_id is null
      or (s.ticket_id is not null and t.etapa_suporte_id = p_etapa_id)
    );
$$;

revoke all on function public.pipeline_assert_admin_bko() from public, anon, authenticated;
revoke all on function public.pipeline_active_sale_count(text,text) from public, anon, authenticated;
revoke all on function public.pipeline_active_support_count(text) from public, anon, authenticated;

-- Resolvedores de destino.
create or replace function public.pipeline_resolve_initial_destination()
returns table(funil_id text, etapa_id text)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, e.id
  from public.pipeline_funis f
  join lateral (
    select pe.id
    from public.pipeline_etapas pe
    where pe.funil_id = f.id and pe.ativo
    order by pe.ordem
    limit 1
  ) e on true
  where f.ativo and f.participa_fluxo_comercial
  order by f.ordem
  limit 1;
$$;

create or replace function public.pipeline_resolve_next_destination(p_current_funil_id text)
returns table(funil_id text, etapa_id text)
language sql
stable
security definer
set search_path = public
as $$
  with atual as (
    select ordem from public.pipeline_funis where id = p_current_funil_id
  )
  select f.id, e.id
  from public.pipeline_funis f
  cross join atual a
  join lateral (
    select pe.id
    from public.pipeline_etapas pe
    where pe.funil_id = f.id and pe.ativo
    order by pe.ordem
    limit 1
  ) e on true
  where f.ativo
    and f.participa_fluxo_comercial
    and f.ordem > a.ordem
  order by f.ordem
  limit 1;
$$;

create or replace function public.pipeline_resolve_first_stage(p_funil_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select e.id
  from public.pipeline_funis f
  join public.pipeline_etapas e on e.funil_id = f.id
  where f.id = p_funil_id and f.ativo and e.ativo
  order by e.ordem
  limit 1;
$$;

revoke all on function public.pipeline_resolve_initial_destination() from public, anon;
revoke all on function public.pipeline_resolve_next_destination(text) from public, anon;
revoke all on function public.pipeline_resolve_first_stage(text) from public, anon;
grant execute on function public.pipeline_resolve_initial_destination() to authenticated;
grant execute on function public.pipeline_resolve_next_destination(text) to authenticated;
grant execute on function public.pipeline_resolve_first_stage(text) to authenticated;

-- Alterações administrativas com bloqueio + auditoria.
create or replace function public.pipeline_set_funil_ativo(p_funil_id text, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_funil public.pipeline_funis%rowtype;
  v_vendas integer;
  v_suporte integer := 0;
  v_etapas_ativas integer;
  v_email text;
begin
  perform public.pipeline_assert_admin_bko();

  select * into v_funil
  from public.pipeline_funis
  where id = p_funil_id
  for update;
  if not found then raise exception 'Funil não encontrado.'; end if;
  if v_funil.ativo = p_ativo then return; end if;

  if p_ativo then
    select count(*)::integer into v_etapas_ativas
    from public.pipeline_etapas
    where funil_id = p_funil_id and ativo;
    if v_etapas_ativas = 0 then
      raise exception 'Não é possível ativar este funil: ele não possui nenhuma etapa ativa.';
    end if;
  else
    v_vendas := public.pipeline_active_sale_count(p_funil_id, null);
    if p_funil_id = 'suporte' then
      v_suporte := public.pipeline_active_support_count(null);
    end if;
    if v_vendas > 0 or v_suporte > 0 then
      if p_funil_id = 'suporte' then
        raise exception 'Não é possível desativar o funil Suporte: há % venda(s) ativa(s) e % atendimento(s) de suporte ativo(s). Retire/conclua esses itens antes.', v_vendas, v_suporte;
      else
        raise exception 'Não é possível desativar este funil: há % venda(s) ativa(s) nele. Retire essas vendas antes.', v_vendas;
      end if;
    end if;
  end if;

  update public.pipeline_funis
  set ativo = p_ativo, updated_by = auth.uid()
  where id = p_funil_id;

  select email into v_email from public.profiles where id = auth.uid();
  insert into public.audit_logs(user_id,user_email,acao,descricao,entidade,entidade_id,valor_anterior,valor_novo)
  values (
    auth.uid(), v_email,
    case when p_ativo then 'pipeline_funil_ativacao' else 'pipeline_funil_desativacao' end,
    case when p_ativo then 'Funil ativado: ' else 'Funil desativado: ' end || v_funil.nome,
    'pipeline_funil', p_funil_id,
    jsonb_build_object('ativo', v_funil.ativo, 'nome', v_funil.nome),
    jsonb_build_object('ativo', p_ativo, 'nome', v_funil.nome)
  );
end;
$$;

create or replace function public.pipeline_set_etapa_ativo(p_etapa_id text, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etapa public.pipeline_etapas%rowtype;
  v_funil public.pipeline_funis%rowtype;
  v_ocupacao integer;
  v_ativas integer;
  v_email text;
begin
  perform public.pipeline_assert_admin_bko();

  select * into v_etapa
  from public.pipeline_etapas
  where id = p_etapa_id
  for update;
  if not found then raise exception 'Etapa não encontrada.'; end if;
  if v_etapa.ativo = p_ativo then return; end if;

  select * into v_funil
  from public.pipeline_funis
  where id = v_etapa.funil_id
  for update;

  if not p_ativo then
    if v_etapa.funil_id = 'suporte' then
      v_ocupacao := public.pipeline_active_support_count(p_etapa_id) + public.pipeline_active_sale_count('suporte', p_etapa_id);
    else
      v_ocupacao := public.pipeline_active_sale_count(v_etapa.funil_id, p_etapa_id);
    end if;
    if v_ocupacao > 0 then
      raise exception 'Não é possível desativar esta etapa: há % item(ns) ativo(s) nela. Retire esses itens antes.', v_ocupacao;
    end if;

    if v_funil.ativo then
      select count(*)::integer into v_ativas
      from public.pipeline_etapas
      where funil_id = v_etapa.funil_id and ativo;
      if v_ativas <= 1 then
        raise exception 'Não é possível desativar a última etapa ativa de um funil ativo. Desative o funil primeiro ou ative outra etapa.';
      end if;
    end if;
  end if;

  update public.pipeline_etapas
  set ativo = p_ativo, updated_by = auth.uid()
  where id = p_etapa_id;

  select email into v_email from public.profiles where id = auth.uid();
  insert into public.audit_logs(user_id,user_email,acao,descricao,entidade,entidade_id,valor_anterior,valor_novo)
  values (
    auth.uid(), v_email,
    case when p_ativo then 'pipeline_etapa_ativacao' else 'pipeline_etapa_desativacao' end,
    case when p_ativo then 'Etapa ativada: ' else 'Etapa desativada: ' end || v_etapa.nome,
    'pipeline_etapa', p_etapa_id,
    jsonb_build_object('ativo', v_etapa.ativo, 'nome', v_etapa.nome, 'funil_id', v_etapa.funil_id),
    jsonb_build_object('ativo', p_ativo, 'nome', v_etapa.nome, 'funil_id', v_etapa.funil_id)
  );
end;
$$;

create or replace function public.pipeline_rename_etapa(p_etapa_id text, p_nome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_etapa public.pipeline_etapas%rowtype;
  v_nome text := btrim(p_nome);
  v_ocupacao integer;
  v_email text;
begin
  perform public.pipeline_assert_admin_bko();
  if v_nome is null or char_length(v_nome) = 0 then
    raise exception 'O nome da etapa não pode ficar vazio.';
  end if;
  if char_length(v_nome) > 120 then
    raise exception 'O nome da etapa deve ter no máximo 120 caracteres.';
  end if;

  select * into v_etapa
  from public.pipeline_etapas
  where id = p_etapa_id
  for update;
  if not found then raise exception 'Etapa não encontrada.'; end if;
  if v_etapa.nome = v_nome then return; end if;

  if v_etapa.funil_id = 'suporte' then
    v_ocupacao := public.pipeline_active_support_count(p_etapa_id) + public.pipeline_active_sale_count('suporte', p_etapa_id);
  else
    v_ocupacao := public.pipeline_active_sale_count(v_etapa.funil_id, p_etapa_id);
  end if;
  if v_ocupacao > 0 then
    raise exception 'Não é possível renomear esta etapa: há % item(ns) ativo(s) nela. Retire esses itens antes.', v_ocupacao;
  end if;

  update public.pipeline_etapas
  set nome = v_nome, updated_by = auth.uid()
  where id = p_etapa_id;

  select email into v_email from public.profiles where id = auth.uid();
  insert into public.audit_logs(user_id,user_email,acao,descricao,entidade,entidade_id,valor_anterior,valor_novo)
  values (
    auth.uid(), v_email, 'pipeline_etapa_renomeacao',
    'Etapa renomeada de "' || v_etapa.nome || '" para "' || v_nome || '".',
    'pipeline_etapa', p_etapa_id,
    jsonb_build_object('nome', v_etapa.nome, 'ativo', v_etapa.ativo, 'funil_id', v_etapa.funil_id),
    jsonb_build_object('nome', v_nome, 'ativo', v_etapa.ativo, 'funil_id', v_etapa.funil_id)
  );
end;
$$;

revoke all on function public.pipeline_set_funil_ativo(text,boolean) from public, anon;
revoke all on function public.pipeline_set_etapa_ativo(text,boolean) from public, anon;
revoke all on function public.pipeline_rename_etapa(text,text) from public, anon;
grant execute on function public.pipeline_set_funil_ativo(text,boolean) to authenticated;
grant execute on function public.pipeline_set_etapa_ativo(text,boolean) to authenticated;
grant execute on function public.pipeline_rename_etapa(text,text) to authenticated;

-- Guarda de integridade para vendas. Atualizações sem mudança real de destino continuam permitidas.
create or replace function public.pipeline_validate_venda_destination()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.funil = old.funil and new.etapa_id = old.etapa_id then
    return new;
  end if;

  if not exists (
    select 1
    from public.pipeline_funis f
    join public.pipeline_etapas e on e.funil_id = f.id
    where f.id = new.funil::text
      and f.ativo
      and e.id = new.etapa_id
      and e.ativo
  ) then
    raise exception 'Destino inválido: o funil ou a etapa está desativado, ou a etapa não pertence ao funil.';
  end if;
  return new;
end;
$$;

drop trigger if exists vendas_validate_pipeline_destination on public.vendas;
create trigger vendas_validate_pipeline_destination
before insert or update of funil, etapa_id on public.vendas
for each row execute function public.pipeline_validate_venda_destination();

-- Guarda de integridade para cards do fluxo novo de Suporte.
create or replace function public.pipeline_validate_support_ticket_destination()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req_status text;
begin
  if new.solicitacao_id is null or new.etapa_suporte_id is null then return new; end if;
  if tg_op = 'UPDATE' and new.etapa_suporte_id is not distinct from old.etapa_suporte_id then return new; end if;

  -- O marcador técnico terminal pode ser gravado por uma solicitação já concluída,
  -- mesmo se a coluna Concluído estiver desativada para operação.
  select status into v_req_status from public.suporte_solicitacoes where id = new.solicitacao_id;
  if new.etapa_suporte_id = 's-concluido' and v_req_status = 'concluido' then return new; end if;

  if not exists (
    select 1
    from public.pipeline_funis f
    join public.pipeline_etapas e on e.funil_id = f.id
    where f.id = 'suporte' and f.ativo
      and e.id = new.etapa_suporte_id and e.ativo
  ) then
    raise exception 'Destino de Suporte inválido: o funil ou a etapa está desativado.';
  end if;
  return new;
end;
$$;

drop trigger if exists tickets_validate_pipeline_destination on public.tickets;
create trigger tickets_validate_pipeline_destination
before insert or update of etapa_suporte_id on public.tickets
for each row execute function public.pipeline_validate_support_ticket_destination();

revoke all on function public.pipeline_validate_venda_destination() from public, anon, authenticated;
revoke all on function public.pipeline_validate_support_ticket_destination() from public, anon, authenticated;

-- Fluxo de Suporte passa a consultar a estrutura ativa.
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
  if v_user_id is null then raise exception '401: usuário não autenticado'; end if;
  if not exists (select 1 from public.pipeline_funis where id='suporte' and ativo) then
    raise exception 'O funil Suporte está desativado em Configurações → Estrutura.';
  end if;
  if nullif(btrim(p_motivo), '') is null then raise exception 'Motivo/descrição é obrigatório.'; end if;

  select * into v_venda from public.vendas
  where id = p_venda_id and deleted_at is null and coalesce(is_deleted, false) = false;
  if not found then raise exception 'Pedido não encontrado.'; end if;

  if not (
    public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'gestor'::public.app_role)
    or (public.has_role(v_user_id, 'consultor'::public.app_role) and v_venda.consultor_id = v_user_id)
  ) then
    raise exception '403: sem permissão para solicitar suporte deste pedido.';
  end if;

  v_nome := public.suporte_nome_usuario(v_user_id);
  insert into public.suporte_solicitacoes(venda_id, criado_por, criado_por_nome, motivo)
  values (p_venda_id, v_user_id, v_nome, btrim(p_motivo))
  returning id into v_solicitacao_id;

  perform public.suporte_registrar_evento(
    v_solicitacao_id, null, 'solicitacao_criada', 'Solicitação de suporte criada.', v_user_id,
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
  v_etapa_id text;
  v_etapa_nome text;
begin
  if v_user_id is null or not public.has_role(v_user_id, 'bko'::public.app_role) then
    raise exception '403: somente BKO pode criar card de atendimento.';
  end if;
  v_etapa_id := public.pipeline_resolve_first_stage('suporte');
  if v_etapa_id is null then raise exception 'O funil Suporte está desativado ou não possui etapa ativa.'; end if;
  select nome into v_etapa_nome from public.pipeline_etapas where id=v_etapa_id;

  select * into v_req from public.suporte_solicitacoes where id=p_solicitacao_id for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  if v_req.ticket_id is not null then return v_req.ticket_id; end if;
  if v_req.status='concluido' then raise exception 'Reabra a solicitação antes de criar o card.'; end if;

  select * into v_venda from public.vendas where id=v_req.venda_id;
  if not found then raise exception 'Pedido vinculado não encontrado.'; end if;

  v_ticket_numero := 'TK-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.suporte_ticket_num_seq')::text,6,'0');
  insert into public.tickets(
    numero,venda_id,solicitacao_id,etapa_suporte_id,titulo,descricao,categoria,prioridade,status,
    operadora,cliente_razao_social,cliente_cnpj,criado_por,atribuido_a
  ) values (
    v_ticket_numero,v_req.venda_id,v_req.id,v_etapa_id,
    'Suporte - ' || coalesce(v_venda.cliente_razao_social,v_venda.numero,'Pedido'),
    v_req.motivo,'Suporte',coalesce(v_venda.prioridade::text,'media'),'aberto',
    v_venda.operadora::text,coalesce(v_venda.cliente_razao_social,'Cliente não informado'),v_venda.cliente_cnpj,
    v_req.criado_por,null
  ) returning id into v_ticket_id;

  update public.suporte_solicitacoes
  set ticket_id=v_ticket_id,status='em_atendimento',card_criado_por=v_user_id,card_criado_em=now(),concluido_por=null,concluido_em=null
  where id=v_req.id;

  perform public.suporte_registrar_evento(
    v_req.id,v_ticket_id,'card_criado','Card de atendimento criado em ' || v_etapa_nome || '.',
    v_user_id,'bko',jsonb_build_object('etapa_id',v_etapa_id,'etapa_nome',v_etapa_nome,'ticket_numero',v_ticket_numero)
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
  if v_user_id is null or not public.has_role(v_user_id,'bko'::public.app_role) then
    raise exception '403: somente BKO pode movimentar cards de suporte.';
  end if;
  if not exists (
    select 1 from public.pipeline_funis f join public.pipeline_etapas e on e.funil_id=f.id
    where f.id='suporte' and f.ativo and e.id=p_etapa_id and e.ativo
  ) then
    raise exception 'Etapa de suporte inválida ou desativada.';
  end if;
  select nome into v_etapa_nome from public.pipeline_etapas where id=p_etapa_id;

  select * into v_req from public.suporte_solicitacoes where id=p_solicitacao_id for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  if v_req.ticket_id is null then raise exception 'A solicitação ainda não possui card de atendimento.'; end if;

  update public.tickets
  set etapa_suporte_id=p_etapa_id,
      status=case when p_etapa_id='s-concluido' then 'resolvido' else 'em_atendimento' end,
      resolvido_em=case when p_etapa_id='s-concluido' then now() else null end,
      updated_at=now()
  where id=v_req.ticket_id;

  update public.suporte_solicitacoes
  set status=case when p_etapa_id='s-concluido' then 'concluido' else 'em_atendimento' end,
      concluido_por=case when p_etapa_id='s-concluido' then v_user_id else null end,
      concluido_em=case when p_etapa_id='s-concluido' then now() else null end
  where id=v_req.id;

  perform public.suporte_registrar_evento(
    v_req.id,v_req.ticket_id,
    case when p_etapa_id='s-concluido' then 'concluido' else 'etapa_alterada' end,
    case when p_etapa_id='s-concluido' then 'Atendimento concluído.' else 'Card movido para ' || v_etapa_nome || '.' end,
    v_user_id,'bko',jsonb_build_object('etapa_id',p_etapa_id,'etapa_nome',v_etapa_nome)
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
  if v_user_id is null or not public.has_role(v_user_id,'bko'::public.app_role) then
    raise exception '403: somente BKO pode concluir solicitações de suporte.';
  end if;
  select * into v_req from public.suporte_solicitacoes where id=p_solicitacao_id for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;

  -- Conclui primeiro a solicitação para permitir o marcador terminal técnico mesmo se a etapa estiver inativa.
  update public.suporte_solicitacoes
  set status='concluido',concluido_por=v_user_id,concluido_em=now()
  where id=v_req.id;

  if v_req.ticket_id is not null then
    update public.tickets
    set etapa_suporte_id='s-concluido',status='resolvido',resolvido_em=now(),updated_at=now()
    where id=v_req.ticket_id;
  end if;

  perform public.suporte_registrar_evento(
    v_req.id,v_req.ticket_id,'concluido',
    case when v_req.ticket_id is null then 'Solicitação resolvida na triagem.' else 'Atendimento concluído.' end,
    v_user_id,'bko',jsonb_build_object('resolvido_na_triagem',v_req.ticket_id is null)
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
  v_etapa_id text;
  v_etapa_nome text;
begin
  if v_user_id is null or not public.has_role(v_user_id,'bko'::public.app_role) then
    raise exception '403: somente BKO pode reabrir solicitações de suporte.';
  end if;
  v_etapa_id := public.pipeline_resolve_first_stage('suporte');
  if v_etapa_id is null then raise exception 'O funil Suporte está desativado ou não possui etapa ativa.'; end if;
  select nome into v_etapa_nome from public.pipeline_etapas where id=v_etapa_id;

  select * into v_req from public.suporte_solicitacoes where id=p_solicitacao_id for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;

  if v_req.ticket_id is not null then
    update public.suporte_solicitacoes
    set status='em_atendimento',concluido_por=null,concluido_em=null
    where id=v_req.id;
    update public.tickets
    set etapa_suporte_id=v_etapa_id,status='aberto',resolvido_em=null,updated_at=now()
    where id=v_req.ticket_id;
  else
    update public.suporte_solicitacoes
    set status='aguardando_criacao',concluido_por=null,concluido_em=null
    where id=v_req.id;
  end if;

  perform public.suporte_registrar_evento(
    v_req.id,v_req.ticket_id,'reaberto',
    case when v_req.ticket_id is null
      then 'Solicitação reaberta e aguardando criação do atendimento.'
      else 'Atendimento reaberto em ' || v_etapa_nome || '.' end,
    v_user_id,'bko',jsonb_build_object('etapa_id',case when v_req.ticket_id is null then null else v_etapa_id end,'etapa_nome',v_etapa_nome)
  );
end;
$$;

revoke all on function public.criar_solicitacao_suporte(uuid,text) from public, anon;
revoke all on function public.criar_card_suporte(uuid) from public, anon;
revoke all on function public.mover_card_suporte(uuid,text) from public, anon;
revoke all on function public.resolver_solicitacao_suporte(uuid) from public, anon;
revoke all on function public.reabrir_solicitacao_suporte(uuid) from public, anon;
grant execute on function public.criar_solicitacao_suporte(uuid,text) to authenticated;
grant execute on function public.criar_card_suporte(uuid) to authenticated;
grant execute on function public.mover_card_suporte(uuid,text) to authenticated;
grant execute on function public.resolver_solicitacao_suporte(uuid) to authenticated;
grant execute on function public.reabrir_solicitacao_suporte(uuid) to authenticated;

-- Realtime da configuração.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='pipeline_funis'
  ) then
    alter publication supabase_realtime add table public.pipeline_funis;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='pipeline_etapas'
  ) then
    alter publication supabase_realtime add table public.pipeline_etapas;
  end if;
end $$;
