-- CNPJ passa a aceitar formato livre/alfa-numérico em todo o sistema.

alter table public.closer_clientes
  drop constraint if exists closer_clientes_cnpj_14_digits_chk;

drop index if exists public.closer_clientes_cnpj_global_uidx;

create unique index closer_clientes_cnpj_global_uidx
on public.closer_clientes (
  (regexp_replace(upper(btrim(cnpj)), '[^A-Z0-9]', '', 'g'))
)
where nullif(regexp_replace(upper(btrim(cnpj)), '[^A-Z0-9]', '', 'g'), '') is not null;

create or replace function public.recalc_cliente_totais(_cliente_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  _ops text[];
  _last record;
begin
  if _cliente_id is null then return; end if;

  select array(
    select distinct v.operadora::text
    from public.vendas v
    where v.cliente_id = _cliente_id
      and v.operadora is not null
      and coalesce(v.is_deleted,false) = false
  ) into _ops;

  select v.cliente_uf, v.ddd, v.cliente_telefone, v.cliente_email, v.cliente_contato,
         v.cliente_razao_social, v.cliente_cnpj
  into _last
  from public.vendas v
  where v.cliente_id = _cliente_id
    and coalesce(v.is_deleted,false) = false
  order by coalesce(v.data_ativacao::timestamptz, v.data_recebimento::timestamptz, v.updated_at, v.created_at) desc nulls last
  limit 1;

  update public.clientes c set
    qtd_linhas_total = coalesce((select sum(v.quantidade_linhas) from public.vendas v where v.cliente_id = _cliente_id and coalesce(v.is_deleted,false)=false), 0),
    receita_total = coalesce((select sum(v.valor) from public.vendas v where v.cliente_id = _cliente_id and coalesce(v.is_deleted,false)=false), 0),
    ultima_venda_em = (select max(coalesce(v.data_ativacao::timestamptz, v.data_recebimento::timestamptz, v.updated_at, v.created_at)) from public.vendas v where v.cliente_id = _cliente_id and coalesce(v.is_deleted,false)=false),
    operadoras = case when array_length(_ops,1) is null then c.operadoras else _ops end,
    razao_social = coalesce(nullif(_last.cliente_razao_social, ''), c.razao_social),
    cnpj_cpf = coalesce(nullif(btrim(coalesce(_last.cliente_cnpj,'')), ''), c.cnpj_cpf),
    uf = coalesce(nullif(_last.cliente_uf, ''), c.uf),
    ddd = coalesce(nullif(_last.ddd, ''), c.ddd),
    telefone = coalesce(nullif(_last.cliente_telefone, ''), c.telefone),
    email = coalesce(nullif(_last.cliente_email, ''), c.email),
    contato = coalesce(nullif(_last.cliente_contato, ''), c.contato)
  where c.id = _cliente_id;
end;
$function$;

create or replace function public.criar_suporte_avulso_v2(
  p_cliente_razao_social text,
  p_cliente_cnpj text,
  p_cliente_nome text,
  p_cliente_email text,
  p_cliente_telefone text,
  p_motivo text,
  p_prioridade text,
  p_etapa_inicial_id text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_nome text;
  v_role text;
  v_solicitacao_id uuid;
  v_ticket_id uuid;
  v_ticket_numero text;
  v_etapa_nome text;
  v_telefone_digits text := regexp_replace(coalesce(p_cliente_telefone,''), '[^0-9]', '', 'g');
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_user_id,'admin'::public.app_role)
    or public.has_role(v_user_id,'bko'::public.app_role)
    or public.has_role(v_user_id,'gestor'::public.app_role)
    or public.has_role(v_user_id,'consultor'::public.app_role)
  ) then
    raise exception '403: perfil sem permissão para criar suporte.';
  end if;

  if nullif(btrim(p_cliente_razao_social),'') is null then
    raise exception 'Razão social é obrigatória.';
  end if;
  if nullif(btrim(p_cliente_cnpj),'') is null then
    raise exception 'CNPJ é obrigatório.';
  end if;
  if nullif(btrim(p_cliente_nome),'') is null then
    raise exception 'Nome completo é obrigatório.';
  end if;
  if nullif(btrim(p_cliente_email),'') is null or position('@' in p_cliente_email) <= 1 then
    raise exception 'E-mail válido é obrigatório.';
  end if;
  if length(v_telefone_digits) not in (10,11) then
    raise exception 'Telefone é obrigatório e deve conter DDD e 8 ou 9 dígitos.';
  end if;
  if nullif(btrim(p_motivo),'') is null then
    raise exception 'Motivo/descrição é obrigatório.';
  end if;
  if p_prioridade not in ('a_tratar','urgente') then
    raise exception 'Prioridade inválida.';
  end if;
  if p_etapa_inicial_id not in ('s-espera','s-prevendas') then
    raise exception 'Destino inicial inválido.';
  end if;

  select e.nome into v_etapa_nome
  from public.pipeline_etapas e
  join public.pipeline_funis f on f.id=e.funil_id
  where f.id='suporte'
    and f.ativo
    and e.id=p_etapa_inicial_id
    and e.ativo;

  if v_etapa_nome is null then
    raise exception 'Destino inicial de suporte está desativado.';
  end if;

  v_nome := public.suporte_nome_usuario(v_user_id);
  v_role := case
    when public.has_role(v_user_id,'admin'::public.app_role) then 'admin'
    when public.has_role(v_user_id,'bko'::public.app_role) then 'bko'
    when public.has_role(v_user_id,'gestor'::public.app_role) then 'gestor'
    else 'consultor'
  end;

  insert into public.suporte_solicitacoes(
    venda_id, criado_por, criado_por_nome, motivo, prioridade, status,
    cliente_razao_social, cliente_nome, cliente_cnpj, cliente_email,
    cliente_telefone, etapa_inicial_id, card_criado_por, card_criado_em
  ) values (
    null, v_user_id, v_nome, btrim(p_motivo), p_prioridade, 'em_atendimento',
    btrim(p_cliente_razao_social), btrim(p_cliente_nome), btrim(p_cliente_cnpj),
    lower(btrim(p_cliente_email)), btrim(p_cliente_telefone),
    p_etapa_inicial_id, v_user_id, now()
  )
  returning id into v_solicitacao_id;

  v_ticket_numero := 'TK-' || to_char(now(),'YYYY') || '-' ||
    lpad(nextval('public.suporte_ticket_num_seq')::text, 6, '0');

  insert into public.tickets(
    numero, venda_id, solicitacao_id, etapa_suporte_id, titulo, descricao,
    categoria, prioridade, status, operadora, cliente_razao_social,
    cliente_cnpj, criado_por, atribuido_a
  ) values (
    v_ticket_numero, null, v_solicitacao_id, p_etapa_inicial_id,
    'Suporte - ' || btrim(p_cliente_razao_social), btrim(p_motivo), 'Suporte',
    case when p_prioridade='urgente' then 'urgente' else 'media' end,
    'aberto', null, btrim(p_cliente_razao_social), btrim(p_cliente_cnpj),
    v_user_id, null
  )
  returning id into v_ticket_id;

  update public.suporte_solicitacoes
  set ticket_id = v_ticket_id
  where id = v_solicitacao_id;

  perform public.suporte_registrar_evento(
    v_solicitacao_id, v_ticket_id, 'suporte_avulso_criado',
    'Suporte avulso criado em ' || v_etapa_nome || '.',
    v_user_id, v_role,
    jsonb_build_object(
      'etapa_id', p_etapa_inicial_id,
      'etapa_nome', v_etapa_nome,
      'ticket_numero', v_ticket_numero,
      'prioridade', p_prioridade,
      'cliente_razao_social', btrim(p_cliente_razao_social),
      'cliente_nome', btrim(p_cliente_nome)
    )
  );

  return v_solicitacao_id;
end;
$function$;
