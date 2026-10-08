CREATE OR REPLACE FUNCTION public.pipeline_trocar_operadora(p_venda_id uuid, p_nova_operadora text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_venda public.vendas%rowtype;
  v_old_operadora public.operadora_enum;
  v_new_operadora public.operadora_enum;
  v_new_etapa text;
  v_now timestamptz := now();
  v_user_nome text;

  v_status_can_remap boolean := false;
  v_status_sla_horas integer := null;
  v_status_is_final boolean := false;

  v_sla_config_id uuid := null;
  v_sla_prazo_horas integer := null;
  v_sla_alerta_horas integer := null;

  v_linhas_ajustadas integer := 0;
begin
  if v_uid is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_uid, 'bko'::public.app_role)
    or public.has_role(v_uid, 'admin'::public.app_role)
  ) then
    raise exception '403: somente BKO ou Administrador podem trocar a operadora do pedido.';
  end if;

  if upper(btrim(coalesce(p_nova_operadora,''))) not in ('CLARO','VIVO') then
    raise exception 'Operadora inválida.';
  end if;

  v_new_operadora := upper(btrim(p_nova_operadora))::public.operadora_enum;

  select *
    into v_venda
  from public.vendas
  where id = p_venda_id
    and deleted_at is null
    and not coalesce(is_deleted,false)
  for update;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  v_old_operadora := v_venda.operadora;

  if v_old_operadora = v_new_operadora then
    raise exception 'O pedido já pertence à operadora %.', v_new_operadora;
  end if;

  v_new_etapa := v_venda.etapa_id;

  if v_venda.status_comercial_id is not null then
    select o.sla_horas, coalesce(o.is_final,false)
      into v_status_sla_horas, v_status_is_final
    from public.status_comercial_operadoras o
    join public.status_comercial_catalogo c
      on c.id = o.status_id
     and c.ativo = true
    where o.status_id = v_venda.status_comercial_id
      and o.operadora = v_new_operadora
      and o.ativo = true
    limit 1;

    if found then
      v_status_can_remap := true;

      if v_status_is_final and (
        v_venda.data_recebimento is null
        or v_venda.data_preenchimento is null
        or v_venda.data_aceite is null
        or v_venda.data_input is null
        or v_venda.data_ativacao is null
      ) then
        v_status_can_remap := false;
      end if;
    else
      v_status_sla_horas := null;
      v_status_is_final := false;
      v_status_can_remap := false;
    end if;
  end if;

  select sc.id, sc.prazo_horas, sc.alerta_horas
    into v_sla_config_id, v_sla_prazo_horas, v_sla_alerta_horas
  from public.sla_config sc
  where sc.etapa_id = v_new_etapa
    and (sc.operadora = v_new_operadora::text or sc.operadora is null)
    and sc.ativo = true
  order by (sc.operadora = v_new_operadora::text) desc nulls last
  limit 1;

  if not found then
    v_sla_config_id := null;
    v_sla_prazo_horas := null;
    v_sla_alerta_horas := null;
  end if;

  select coalesce(nullif(btrim(p.nome_completo),''), nullif(btrim(p.email),''), 'Usuário')
    into v_user_nome
  from public.profiles p
  where p.id = v_uid;

  update public.vendas
  set operadora = v_new_operadora,
      etapa_id = v_new_etapa,

      produto = v_venda.produto,
      tipo_pedido = v_venda.tipo_pedido,
      status_pedido = v_venda.status_pedido,
      status_pedido_obs = v_venda.status_pedido_obs,
      status_pedido_user_id = v_venda.status_pedido_user_id,
      status_pedido_user_nome = v_venda.status_pedido_user_nome,
      status_pedido_em = v_venda.status_pedido_em,
      status_comercial_id = v_venda.status_comercial_id,
      status_comercial_nome = v_venda.status_comercial_nome,
      status_comercial_em = v_venda.status_comercial_em,

      sla_horas_atual = case
        when v_status_can_remap then v_status_sla_horas
        else null
      end,
      sla_metade_em = case
        when v_status_can_remap and coalesce(v_status_sla_horas,0) > 0
          then v_now + make_interval(hours => greatest(1, ceil(v_status_sla_horas::numeric / 2.0)::int))
        else null
      end,
      sla_limite_em = case
        when v_status_can_remap and coalesce(v_status_sla_horas,0) > 0
          then v_now + make_interval(hours => v_status_sla_horas)
        else null
      end,

      sla_due_at = case
        when v_sla_config_id is null then null
        else v_now + make_interval(hours => v_sla_prazo_horas)
      end,
      sla_alerta_at = case
        when v_sla_config_id is null then null
        else v_now + make_interval(hours => v_sla_alerta_horas)
      end,
      sla_status_calc = case when v_sla_config_id is null then null else 'ok' end
  where id = p_venda_id;

  update public.venda_linhas l
  set possui_bonus = case
        when v_new_operadora = 'CLARO'::public.operadora_enum then false
        else l.possui_bonus
      end,
      bonus_gb = case
        when v_new_operadora = 'CLARO'::public.operadora_enum then null
        else l.bonus_gb
      end,
      updated_at = v_now
  where l.venda_id = p_venda_id;

  get diagnostics v_linhas_ajustadas = row_count;

  insert into public.venda_historico(
    venda_id,
    tipo,
    campo,
    valor_anterior,
    valor_novo,
    descricao,
    user_id,
    user_nome
  ) values (
    p_venda_id,
    'campo'::public.historico_tipo_enum,
    'operadora',
    v_old_operadora::text,
    v_new_operadora::text,
    'Troca de operadora: ' || v_old_operadora::text || ' → ' || v_new_operadora::text
      || '. Realizada por ' || coalesce(v_user_nome,'Usuário') || '.'
      || case when v_new_etapa is distinct from v_venda.etapa_id
              then ' Etapa ajustada: ' || v_venda.etapa_id || ' → ' || v_new_etapa || '.'
              else '' end
      || ' Tipo do pedido preservado: ' || coalesce(nullif(v_venda.tipo_pedido,''),'Não informado') || '.'
      || ' Último status preservado: ' || coalesce(nullif(v_venda.status_pedido,''), nullif(v_venda.status_comercial_nome,''), 'Não informado') || '.'
      || case
           when v_venda.status_comercial_id is null then ''
           when v_status_can_remap then ' Status comercial compatível com a nova operadora; SLA recalculado.'
           else ' Status comercial preservado como referência; o SLA comercial ficou pendente de uma seleção válida para a nova operadora.'
         end,
    v_uid,
    coalesce(v_user_nome,'Usuário')
  );

  insert into public.audit_logs(
    user_id, acao, descricao, entidade, entidade_id, valor_anterior, valor_novo
  ) values (
    v_uid,
    'operadora_pedido_alterada',
    'Troca de operadora do pedido ' || coalesce(v_venda.numero,p_venda_id::text) || ': '
      || v_old_operadora::text || ' → ' || v_new_operadora::text
      || '. Tipo e último status preservados.',
    'venda',
    p_venda_id::text,
    jsonb_build_object(
      'operadora', v_old_operadora::text,
      'etapa_id', v_venda.etapa_id,
      'produto', v_venda.produto,
      'tipo_pedido', v_venda.tipo_pedido,
      'status_pedido', v_venda.status_pedido,
      'status_pedido_em', v_venda.status_pedido_em,
      'status_comercial_id', v_venda.status_comercial_id,
      'status_comercial_nome', v_venda.status_comercial_nome
    ),
    jsonb_build_object(
      'operadora', v_new_operadora::text,
      'etapa_id', v_new_etapa,
      'produto_preservado', v_venda.produto,
      'tipo_pedido_preservado', v_venda.tipo_pedido,
      'status_pedido_preservado', v_venda.status_pedido,
      'status_comercial_preservado', v_venda.status_comercial_nome,
      'status_comercial_compativel_nova_operadora', v_status_can_remap,
      'linhas_preservadas', v_linhas_ajustadas
    )
  );

  return jsonb_build_object(
    'venda_id', p_venda_id,
    'operadora_anterior', v_old_operadora::text,
    'operadora_nova', v_new_operadora::text,
    'etapa_anterior', v_venda.etapa_id,
    'etapa_nova', v_new_etapa,
    'tipo_pedido_preservado', v_venda.tipo_pedido,
    'status_pedido_preservado', v_venda.status_pedido,
    'status_comercial_preservado', v_venda.status_comercial_nome,
    'status_comercial_compativel', v_status_can_remap,
    'linhas_preservadas', v_linhas_ajustadas
  );
end;
$function$;

revoke all on function public.pipeline_trocar_operadora(uuid,text) from public, anon;

grant execute on function public.pipeline_trocar_operadora(uuid,text) to authenticated;

CREATE OR REPLACE FUNCTION public.normalizar_campos_venda_linha()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_produto text;
  v_pedido text;
  v_operadora text := upper(btrim(coalesce(new.operadora,'')));
  v_regra boolean := false;
  v_usa_ddd boolean := true;
  v_usa_numero boolean := true;
  v_usa_plano boolean := true;
  v_usa_valor boolean := true;
  v_usa_descricao boolean := false;
  v_usa_aparelho boolean := false;
begin
  v_produto := regexp_replace(
    translate(
      lower(btrim(coalesce(new.produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '[–—_-]+',' ','g'
  );
  v_produto := regexp_replace(v_produto,'\s+',' ','g');

  if v_produto in ('chip de dados','chip de cados') then
    v_produto := 'chip dados';
  elsif v_produto='microsoft 265' then
    v_produto := 'microsoft 365';
  end if;

  v_pedido := regexp_replace(
    translate(
      lower(btrim(coalesce(new.tipo_produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '[–—_-]+',' ','g'
  );
  v_pedido := regexp_replace(v_pedido,'\s+',' ','g');

  if v_operadora='CLARO' then
    if v_produto='movel'
       and v_pedido in (
         'novo','renovacao','portado','portabilidade cruzada pf/pj',
         'portabilidade pj/pj','transferencia de titularidade pf/pj pos',
         'transferencia de titularidade pf/pj pre','transferencia de titularidade pj/pj'
       ) then
      v_regra:=true; v_usa_ddd:=true; v_usa_numero:=true; v_usa_plano:=true; v_usa_valor:=true;

    elsif v_produto='fixa' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=true; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true;

    elsif v_produto='fixa' and v_pedido='portado' then
      v_regra:=true; v_usa_ddd:=true; v_usa_numero:=true; v_usa_plano:=false; v_usa_valor:=true;

    elsif v_produto='banda larga' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=true; v_usa_valor:=true;

    elsif v_produto='m2m' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=true; v_usa_numero:=false; v_usa_plano:=true; v_usa_valor:=true;

    elsif v_produto='tv' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=true; v_usa_valor:=true;

    elsif v_produto='chip dados' and v_pedido='novo' then
      -- CLARO: DDD + Plano + Valor.
      v_regra:=true; v_usa_ddd:=true; v_usa_numero:=false; v_usa_plano:=true; v_usa_valor:=true;

    elsif v_produto='sva' and v_pedido='portado' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=false;

    elsif v_produto='passaporte' and v_pedido in ('novo','sva') then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=false;

    elsif v_produto='aparelho'
       and v_pedido in (
         'novo','sva','renovacao','portabilidade cruzada pf/pj',
         'portabilidade pj/pj','transferencia de titularidade pf/pj pos',
         'transferencia de titularidade pf/pj pre'
       ) then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true; v_usa_aparelho:=true;
    end if;

  elsif v_operadora='VIVO' then
    if v_produto='movel'
       and v_pedido in (
         'migracao plano','migracao pre','migracao pos','novo',
         'portabilidade pf/pj','portabilidade pj/pj','portado'
       ) then
      v_regra:=true; v_usa_ddd:=true; v_usa_numero:=true; v_usa_plano:=true; v_usa_valor:=true;

    elsif v_produto='sip' and v_pedido in ('novo','portado') then
      v_regra:=true; v_usa_ddd:=true; v_usa_numero:=true; v_usa_plano:=false; v_usa_valor:=true;

    elsif v_produto='microsoft 365' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true;

    elsif v_produto='microsoft 365' and v_pedido='sva' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true; v_usa_descricao:=true;

    elsif v_produto='link dedicado' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true;

    elsif v_produto='chip dados' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=true; v_usa_numero:=false; v_usa_plano:=true; v_usa_valor:=true;

    elsif v_produto='aluguel de equipamentos' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true; v_usa_descricao:=true;

    elsif v_produto='tv' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=true; v_usa_valor:=true;

    elsif v_produto='vvn' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true; v_usa_descricao:=true;

    elsif v_produto='siga me' and v_pedido in ('novo','sva') then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true; v_usa_descricao:=true;

    elsif v_produto='pabx' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true; v_usa_descricao:=true;

    elsif v_produto='m2m' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=true; v_usa_numero:=true; v_usa_plano:=true; v_usa_valor:=true;

    elsif v_produto='ldi' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true; v_usa_descricao:=true;

    elsif v_produto='ip fixo' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true; v_usa_descricao:=true;

    elsif v_produto='fixa' and v_pedido='novo' then
      v_regra:=true; v_usa_ddd:=true; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true;

    elsif v_produto='aparelho' and v_pedido in ('novo','sva') then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true; v_usa_aparelho:=true;

    elsif v_produto='passaporte' and v_pedido='sva' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=false;
    end if;
  end if;

  if v_regra then
    if not v_usa_ddd then new.ddd:=null; end if;
    if not v_usa_numero then new.numero:=null; end if;

    if not v_usa_plano then
      new.plano:='Não informado';
      new.plano_catalogo_id:=null;
      new.plano_oferta_id:=null;
    end if;

    if not v_usa_valor then new.valor_mensal:=0; end if;
    if not v_usa_descricao then new.descricao_adicional:=null; end if;
    if not v_usa_aparelho then new.nome_aparelho:=null; end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_normalizar_campos_venda_linha on public.venda_linhas;

create trigger trg_normalizar_campos_venda_linha
before insert or update of produto,tipo_produto,operadora,ddd,numero,plano,plano_catalogo_id,plano_oferta_id,valor_mensal,descricao_adicional,nome_aparelho
on public.venda_linhas
for each row execute function public.normalizar_campos_venda_linha();

revoke execute on function public.normalizar_campos_venda_linha() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validar_passaporte_venda_linha()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_produto text;
  v_pedido text;
  v_passaporte_nome text;
  v_passaporte_operadora text;
  v_passaporte_ativo boolean;
  v_elegivel boolean := false;
  v_plano_nome text;
  v_plano_valor numeric;
  v_plano_produto_id uuid;
  v_plano_operadora text;
  v_plano_ativo boolean;
  v_oferta_ativa boolean;
begin
  v_produto := regexp_replace(
    translate(lower(btrim(coalesce(new.produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '[–—_-]+',' ','g'
  );
  v_produto := regexp_replace(v_produto,'\s+',' ','g');

  v_pedido := regexp_replace(
    translate(lower(btrim(coalesce(new.tipo_produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '[–—_-]+',' ','g'
  );
  v_pedido := regexp_replace(v_pedido,'\s+',' ','g');

  if upper(btrim(coalesce(new.operadora,'')))='VIVO' then
    v_elegivel :=
      (
        v_produto='movel'
        and v_pedido in ('migracao plano','migracao pre','migracao pos','novo')
      )
      or (
        v_produto='passaporte'
        and v_pedido='sva'
      );
  elsif upper(btrim(coalesce(new.operadora,'')))='CLARO' then
    v_elegivel :=
      (
        v_produto='movel'
        and v_pedido in (
          'novo','renovacao','portado','portabilidade cruzada pf/pj',
          'portabilidade pj/pj','transferencia de titularidade pf/pj pos',
          'transferencia de titularidade pf/pj pre','transferencia de titularidade pj/pj'
        )
      )
      or (
        v_produto='passaporte'
        and v_pedido in ('novo','sva')
      );
  end if;

  if not v_elegivel then
    new.passaporte_produto_id:=null;
    new.passaporte_plano_oferta_id:=null;
    new.passaporte_plano:=null;
    new.passaporte_valor:=null;
    return new;
  end if;

  if new.passaporte_produto_id is null then
    new.passaporte_plano_oferta_id:=null;
    new.passaporte_plano:=null;
    new.passaporte_valor:=null;
    return new;
  end if;

  select nome,operadora,ativo
    into v_passaporte_nome,v_passaporte_operadora,v_passaporte_ativo
  from public.produtos_catalogo
  where id=new.passaporte_produto_id;

  if not found or not coalesce(v_passaporte_ativo,false) then
    raise exception 'Passaporte inválido ou inativo para esta linha';
  end if;

  if upper(btrim(coalesce(v_passaporte_operadora,'')))
     is distinct from upper(btrim(coalesce(new.operadora,''))) then
    if tg_op='UPDATE' and new.operadora is distinct from old.operadora then
      new.passaporte_produto_id:=null;
      new.passaporte_plano_oferta_id:=null;
      new.passaporte_plano:=null;
      new.passaporte_valor:=null;
      return new;
    end if;
    raise exception 'Passaporte pertence a outra operadora';
  end if;

  v_passaporte_nome := regexp_replace(
    translate(lower(btrim(coalesce(v_passaporte_nome,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '[–—_-]+',' ','g'
  );
  v_passaporte_nome := regexp_replace(v_passaporte_nome,'\s+',' ','g');

  if upper(btrim(coalesce(new.operadora,'')))='VIVO' then
    if v_passaporte_nome not in (
      'vivo travel americas',
      'vivo travel europa',
      'vivo travel mundo'
    ) then
      raise exception 'Passaporte inválido para esta linha VIVO';
    end if;
  else
    if v_passaporte_nome not in (
      'claro passaporte americas',
      'claro passaporte europa',
      'claro passaporte mundo total'
    ) then
      raise exception 'Passaporte inválido para esta linha CLARO';
    end if;
  end if;

  if new.passaporte_plano_oferta_id is null then
    new.passaporte_plano:=null;
    new.passaporte_valor:=null;
    return new;
  end if;

  select pc.nome,
         po.valor_mes,
         pc.produto_id,
         pc.operadora,
         pc.ativo,
         po.ativo
    into v_plano_nome,
         v_plano_valor,
         v_plano_produto_id,
         v_plano_operadora,
         v_plano_ativo,
         v_oferta_ativa
  from public.plano_ofertas_catalogo po
  join public.planos_catalogo pc on pc.id=po.plano_id
  where po.id=new.passaporte_plano_oferta_id;

  if not found
     or not coalesce(v_plano_ativo,false)
     or not coalesce(v_oferta_ativa,false)
     or v_plano_produto_id is distinct from new.passaporte_produto_id
     or upper(btrim(coalesce(v_plano_operadora,''))) is distinct from upper(btrim(coalesce(new.operadora,''))) then
    raise exception 'Plano do Passaporte inválido para o Passaporte selecionado';
  end if;

  new.passaporte_plano:=v_plano_nome;
  new.passaporte_valor:=v_plano_valor;
  return new;
end;
$function$;

drop trigger if exists trg_validar_passaporte_venda_linha on public.venda_linhas;

create trigger trg_validar_passaporte_venda_linha
before insert or update of operadora,produto,tipo_produto,passaporte_produto_id,passaporte_plano_oferta_id
on public.venda_linhas
for each row execute function public.validar_passaporte_venda_linha();

revoke execute on function public.validar_passaporte_venda_linha() from public, anon, authenticated;