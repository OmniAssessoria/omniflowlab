-- Closer passa a usar o mesmo fluxo de suporte avulso dos Consultores.
-- BKO/Admin continuam com acesso operacional global aos chamados.

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
    or public.has_role(v_user_id,'closer'::public.app_role)
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

  select e.nome
    into v_etapa_nome
  from public.pipeline_etapas e
  join public.pipeline_funis f on f.id = e.funil_id
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
    when public.has_role(v_user_id,'closer'::public.app_role) then 'closer'
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
      'cliente_nome', btrim(p_cliente_nome),
      'origem_perfil', v_role
    )
  );

  return v_solicitacao_id;
end;
$function$;

grant execute on function public.criar_suporte_avulso_v2(
  text,text,text,text,text,text,text,text
) to authenticated;

alter table public.suporte_mensagens
  drop constraint if exists suporte_mensagens_autor_role_check;

alter table public.suporte_mensagens
  add constraint suporte_mensagens_autor_role_check
  check (autor_role in ('consultor','closer','bko','admin'));

drop policy if exists "suporte mensagens insercao" on public.suporte_mensagens;

create policy "suporte mensagens insercao"
on public.suporte_mensagens
for insert
to authenticated
with check (
  autor_id = auth.uid()
  and public.suporte_usuario_tem_acesso(solicitacao_id)
  and (
    (autor_role='admin' and public.has_role(auth.uid(),'admin'::public.app_role))
    or (autor_role='bko' and public.has_role(auth.uid(),'bko'::public.app_role))
    or (autor_role='consultor' and public.has_role(auth.uid(),'consultor'::public.app_role))
    or (autor_role='closer' and public.has_role(auth.uid(),'closer'::public.app_role))
  )
);
