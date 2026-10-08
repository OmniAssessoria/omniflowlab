-- Evolução Operacional 2026-09-16
-- Suporte avulso + responsável principal não-exclusivo.

alter table public.suporte_solicitacoes
  alter column venda_id drop not null,
  add column if not exists cliente_nome text,
  add column if not exists cliente_cnpj text,
  add column if not exists cliente_email text,
  add column if not exists etapa_inicial_id text,
  add column if not exists responsavel_id uuid references auth.users(id),
  add column if not exists responsavel_nome text,
  add column if not exists assumido_em timestamptz;

create or replace function public.suporte_usuario_tem_acesso(p_solicitacao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.suporte_solicitacoes s
    left join public.vendas v on v.id = s.venda_id
    where s.id = p_solicitacao_id
      and auth.uid() is not null
      and (
        public.has_role(auth.uid(),'admin'::public.app_role)
        or public.has_role(auth.uid(),'bko'::public.app_role)
        or public.has_role(auth.uid(),'gestor'::public.app_role)
        or s.criado_por = auth.uid()
        or v.consultor_id = auth.uid()
      )
  );
$$;

revoke all on function public.suporte_usuario_tem_acesso(uuid) from public;
grant execute on function public.suporte_usuario_tem_acesso(uuid) to authenticated;

drop policy if exists "suporte solicitacoes leitura" on public.suporte_solicitacoes;
create policy "suporte solicitacoes leitura"
on public.suporte_solicitacoes for select to authenticated
using (public.suporte_usuario_tem_acesso(id));

drop policy if exists "suporte eventos leitura" on public.suporte_eventos;
create policy "suporte eventos leitura"
on public.suporte_eventos for select to authenticated
using (public.suporte_usuario_tem_acesso(solicitacao_id));

drop policy if exists "suporte mensagens leitura" on public.suporte_mensagens;
create policy "suporte mensagens leitura"
on public.suporte_mensagens for select to authenticated
using (public.suporte_usuario_tem_acesso(solicitacao_id));

alter table public.suporte_mensagens drop constraint if exists suporte_mensagens_autor_role_check;
alter table public.suporte_mensagens
  add constraint suporte_mensagens_autor_role_check
  check (autor_role in ('consultor','bko','admin'));

drop policy if exists "suporte mensagens insercao" on public.suporte_mensagens;
create policy "suporte mensagens insercao"
on public.suporte_mensagens for insert to authenticated
with check (
  autor_id = auth.uid()
  and public.suporte_usuario_tem_acesso(solicitacao_id)
  and (
    (autor_role='admin' and public.has_role(auth.uid(),'admin'::public.app_role))
    or (autor_role='bko' and public.has_role(auth.uid(),'bko'::public.app_role))
    or (autor_role='consultor' and public.has_role(auth.uid(),'consultor'::public.app_role))
  )
);

create or replace function public.criar_suporte_avulso(
  p_cliente_nome text,
  p_cliente_cnpj text,
  p_cliente_email text,
  p_motivo text,
  p_prioridade text,
  p_etapa_inicial_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_nome text;
  v_role text;
  v_solicitacao_id uuid;
  v_ticket_id uuid;
  v_ticket_numero text;
  v_etapa_nome text;
begin
  if v_user_id is null then raise exception '401: usuário não autenticado.'; end if;
  if not (
    public.has_role(v_user_id,'admin'::public.app_role)
    or public.has_role(v_user_id,'bko'::public.app_role)
    or public.has_role(v_user_id,'gestor'::public.app_role)
    or public.has_role(v_user_id,'consultor'::public.app_role)
  ) then raise exception '403: perfil sem permissão para criar suporte.'; end if;

  if nullif(btrim(p_cliente_nome),'') is null then raise exception 'Nome completo é obrigatório.'; end if;
  if nullif(btrim(p_cliente_cnpj),'') is null then raise exception 'CNPJ é obrigatório.'; end if;
  if nullif(btrim(p_cliente_email),'') is null or position('@' in p_cliente_email) <= 1 then raise exception 'E-mail válido é obrigatório.'; end if;
  if nullif(btrim(p_motivo),'') is null then raise exception 'Motivo/descrição é obrigatório.'; end if;
  if p_prioridade not in ('a_tratar','urgente') then raise exception 'Prioridade inválida.'; end if;
  if p_etapa_inicial_id not in ('s-espera','s-prevendas') then raise exception 'Destino inicial inválido.'; end if;

  select e.nome into v_etapa_nome
  from public.pipeline_etapas e
  join public.pipeline_funis f on f.id=e.funil_id
  where f.id='suporte' and f.ativo and e.id=p_etapa_inicial_id and e.ativo;
  if v_etapa_nome is null then raise exception 'Destino inicial de suporte está desativado.'; end if;

  v_nome := public.suporte_nome_usuario(v_user_id);
  v_role := case
    when public.has_role(v_user_id,'admin'::public.app_role) then 'admin'
    when public.has_role(v_user_id,'bko'::public.app_role) then 'bko'
    when public.has_role(v_user_id,'gestor'::public.app_role) then 'gestor'
    else 'consultor'
  end;

  insert into public.suporte_solicitacoes(
    venda_id, criado_por, criado_por_nome, motivo, prioridade, status,
    cliente_nome, cliente_cnpj, cliente_email, etapa_inicial_id,
    card_criado_por, card_criado_em
  ) values (
    null, v_user_id, v_nome, btrim(p_motivo), p_prioridade, 'em_atendimento',
    btrim(p_cliente_nome), btrim(p_cliente_cnpj), lower(btrim(p_cliente_email)), p_etapa_inicial_id,
    v_user_id, now()
  ) returning id into v_solicitacao_id;

  v_ticket_numero := 'TK-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.suporte_ticket_num_seq')::text,6,'0');
  insert into public.tickets(
    numero,venda_id,solicitacao_id,etapa_suporte_id,titulo,descricao,categoria,prioridade,status,
    operadora,cliente_razao_social,cliente_cnpj,criado_por,atribuido_a
  ) values (
    v_ticket_numero,null,v_solicitacao_id,p_etapa_inicial_id,
    'Suporte - '||btrim(p_cliente_nome),btrim(p_motivo),'Suporte',
    case when p_prioridade='urgente' then 'urgente' else 'media' end,
    'aberto',null,btrim(p_cliente_nome),btrim(p_cliente_cnpj),v_user_id,null
  ) returning id into v_ticket_id;

  update public.suporte_solicitacoes set ticket_id=v_ticket_id where id=v_solicitacao_id;
  perform public.suporte_registrar_evento(
    v_solicitacao_id,v_ticket_id,'suporte_avulso_criado',
    'Suporte avulso criado em '||v_etapa_nome||'.',
    v_user_id,v_role,
    jsonb_build_object('etapa_id',p_etapa_inicial_id,'etapa_nome',v_etapa_nome,'ticket_numero',v_ticket_numero,'prioridade',p_prioridade)
  );
  return v_solicitacao_id;
end;
$$;

grant execute on function public.criar_suporte_avulso(text,text,text,text,text,text) to authenticated;

create or replace function public.assumir_atendimento_suporte(p_solicitacao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_nome text;
  v_req public.suporte_solicitacoes%rowtype;
  v_role text;
begin
  if v_user_id is null or not (
    public.has_role(v_user_id,'bko'::public.app_role)
    or public.has_role(v_user_id,'admin'::public.app_role)
  ) then raise exception '403: somente BKO ou Admin pode assumir atendimento.'; end if;

  select * into v_req from public.suporte_solicitacoes where id=p_solicitacao_id for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  if v_req.status='concluido' then raise exception 'Atendimento concluído não pode ser assumido.'; end if;

  v_nome := public.suporte_nome_usuario(v_user_id);
  v_role := case when public.has_role(v_user_id,'admin'::public.app_role) then 'admin' else 'bko' end;

  update public.suporte_solicitacoes
  set responsavel_id=v_user_id,responsavel_nome=v_nome,assumido_em=now(),updated_at=now()
  where id=p_solicitacao_id;

  if v_req.ticket_id is not null then
    update public.tickets set atribuido_a=v_user_id,updated_at=now() where id=v_req.ticket_id;
  end if;

  perform public.suporte_registrar_evento(
    p_solicitacao_id,v_req.ticket_id,'atendimento_assumido',
    'Atendimento assumido por '||coalesce(v_nome,'BKO')||'.',
    v_user_id,v_role,
    jsonb_build_object('responsavel_id',v_user_id,'responsavel_nome',v_nome)
  );
end;
$$;

grant execute on function public.assumir_atendimento_suporte(uuid) to authenticated;

-- Mantém criação de card compatível com atendimento vinculado ou avulso.
create or replace function public.criar_card_suporte(p_solicitacao_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid:=auth.uid();
  v_req public.suporte_solicitacoes%rowtype;
  v_venda public.vendas%rowtype;
  v_ticket_id uuid;
  v_ticket_numero text;
  v_etapa_id text;
  v_etapa_nome text;
  v_cliente_nome text;
  v_cliente_cnpj text;
  v_operadora text;
begin
  if v_user_id is null or not (
    public.has_role(v_user_id,'bko'::public.app_role)
    or public.has_role(v_user_id,'admin'::public.app_role)
  ) then raise exception '403: somente BKO ou Admin pode criar card de atendimento.'; end if;

  select * into v_req from public.suporte_solicitacoes where id=p_solicitacao_id for update;
  if not found then raise exception 'Solicitação não encontrada.'; end if;
  if v_req.ticket_id is not null then return v_req.ticket_id; end if;
  if v_req.status='concluido' then raise exception 'Solicitação concluída não pode gerar card.'; end if;

  v_etapa_id:=coalesce(v_req.etapa_inicial_id,public.pipeline_resolve_first_stage('suporte'));
  select nome into v_etapa_nome from public.pipeline_etapas where id=v_etapa_id and ativo;
  if v_etapa_nome is null then raise exception 'O destino de Suporte está desativado ou inválido.'; end if;

  if v_req.venda_id is not null then
    select * into v_venda from public.vendas where id=v_req.venda_id;
    if not found then raise exception 'Pedido vinculado não encontrado.'; end if;
    v_cliente_nome:=coalesce(v_venda.cliente_razao_social,v_venda.numero,'Pedido');
    v_cliente_cnpj:=v_venda.cliente_cnpj;
    v_operadora:=v_venda.operadora::text;
  else
    v_cliente_nome:=v_req.cliente_nome;
    v_cliente_cnpj:=v_req.cliente_cnpj;
    v_operadora:=null;
  end if;

  v_ticket_numero:='TK-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.suporte_ticket_num_seq')::text,6,'0');
  insert into public.tickets(numero,venda_id,solicitacao_id,etapa_suporte_id,titulo,descricao,categoria,prioridade,status,operadora,cliente_razao_social,cliente_cnpj,criado_por,atribuido_a)
  values(v_ticket_numero,v_req.venda_id,v_req.id,v_etapa_id,'Suporte - '||coalesce(v_cliente_nome,'Cliente'),v_req.motivo,'Suporte',case when v_req.prioridade='urgente' then 'urgente' else 'media' end,'aberto',v_operadora,coalesce(v_cliente_nome,'Cliente não informado'),v_cliente_cnpj,v_req.criado_por,null)
  returning id into v_ticket_id;

  update public.suporte_solicitacoes
  set ticket_id=v_ticket_id,status='em_atendimento',card_criado_por=v_user_id,card_criado_em=now(),concluido_por=null,concluido_em=null,updated_at=now()
  where id=v_req.id;

  perform public.suporte_registrar_evento(v_req.id,v_ticket_id,'card_criado','Card de atendimento criado em '||v_etapa_nome||'.',v_user_id,case when public.has_role(v_user_id,'admin'::public.app_role) then 'admin' else 'bko' end,jsonb_build_object('etapa_id',v_etapa_id,'etapa_nome',v_etapa_nome,'ticket_numero',v_ticket_numero));
  return v_ticket_id;
end;
$$;
