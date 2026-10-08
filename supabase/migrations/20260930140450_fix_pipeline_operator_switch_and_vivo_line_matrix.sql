
alter table public.venda_linhas
  add column if not exists descricao_adicional text null,
  add column if not exists siga_me_produto_id uuid null,
  add column if not exists siga_me_descricao text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='venda_linhas_siga_me_produto_id_fkey'
  ) then
    alter table public.venda_linhas
      add constraint venda_linhas_siga_me_produto_id_fkey
      foreign key (siga_me_produto_id)
      references public.produtos_catalogo(id)
      on delete set null;
  end if;
end $$;

create index if not exists venda_linhas_siga_me_produto_id_idx
  on public.venda_linhas(siga_me_produto_id);

comment on column public.venda_linhas.descricao_adicional is
  'Descrição específica do produto da linha (VVN, PABX, LDI, IP Fixo, Siga-Me, aluguel de equipamentos etc.).';
comment on column public.venda_linhas.siga_me_produto_id is
  'Siga-Me adicional vinculado a uma linha Móvel VIVO.';
comment on column public.venda_linhas.siga_me_descricao is
  'Descrição do Siga-Me adicional da linha Móvel VIVO.';

update public.tipos_pedido_catalogo
set permite_doador = case
      when regexp_replace(
        translate(lower(btrim(nome)),
          'áàâãäéèêëíìîïóòôõöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'),
        '\s+',' ','g'
      ) in ('migracao pre','migracao pos','portabilidade pf/pj','portabilidade pj/pj')
        then true
      else false
    end,
    permite_bonus = case
      when regexp_replace(
        translate(lower(btrim(nome)),
          'áàâãäéèêëíìîïóòôõöúùûüç',
          'aaaaaeeeeiiiiooooouuuuc'),
        '\s+',' ','g'
      ) in ('portabilidade pf/pj','portabilidade pj/pj','portado')
        then true
      else false
    end
where operadora='VIVO';


CREATE OR REPLACE FUNCTION public.cleanup_venda_linha_extras_after_type_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_permite_doador boolean := false;
  v_produto text;
  v_tipo text;
  v_doador record;
  v_user_nome text;
begin
  if coalesce(current_setting('app.tipo_produto_catalog_rename', true), '0') = '1' then
    return new;
  end if;

  if new.venda_id is not distinct from old.venda_id
     and new.tipo_produto is not distinct from old.tipo_produto
     and new.operadora is not distinct from old.operadora
     and new.produto is not distinct from old.produto then
    return new;
  end if;

  v_produto := regexp_replace(
    translate(lower(btrim(coalesce(new.produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '\s+',' ','g'
  );
  v_produto := replace(replace(replace(v_produto,'-',' '),'–',' '),'—',' ');
  v_produto := regexp_replace(v_produto,'\s+',' ','g');

  v_tipo := regexp_replace(
    translate(lower(btrim(coalesce(new.tipo_produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '\s+',' ','g'
  );

  select coalesce(t.permite_doador,false)
    into v_permite_doador
  from public.tipos_pedido_catalogo t
  where upper(btrim(t.operadora))=upper(btrim(coalesce(new.operadora,'')))
    and t.ativo=true
    and regexp_replace(
      translate(lower(btrim(t.nome)),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'),
      '\s+',' ','g'
    )=v_tipo
  limit 1;

  v_permite_doador := coalesce(v_permite_doador,false) and v_produto='movel';

  select vld.cedente_id, c.cnpj_cpf, c.razao_social, c.nome, c.email
    into v_doador
  from public.venda_linha_doadores vld
  join public.cedentes c on c.id=vld.cedente_id
  where vld.linha_id=new.id
  limit 1;

  if found and not v_permite_doador then
    select nome_completo into v_user_nome
    from public.profiles where id=auth.uid();

    insert into public.venda_historico(
      venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome
    ) values (
      new.venda_id,
      'campo'::public.historico_tipo_enum,
      'cedente_linha',
      concat_ws(' | ',
        coalesce(nullif(v_doador.razao_social,''),nullif(v_doador.nome,''),'Cedente'),
        v_doador.cnpj_cpf,
        v_doador.email
      ),
      null,
      'Cedente removido automaticamente porque a linha mudou para “'
        || coalesce(new.tipo_produto,'Não informado') || '” + “'
        || coalesce(new.produto,'Não informado') || '”, combinação que não utiliza Cedente.',
      auth.uid(),
      v_user_nome
    );

    delete from public.venda_linha_doadores where linha_id=new.id;
  end if;

  if old.possui_bonus is true
     and new.possui_bonus is not true
     and old.bonus_gb is not null then
    if v_user_nome is null then
      select nome_completo into v_user_nome
      from public.profiles where id=auth.uid();
    end if;

    insert into public.venda_historico(
      venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome
    ) values (
      new.venda_id,
      'campo'::public.historico_tipo_enum,
      'bonus_linha',
      old.bonus_gb::text || ' GB',
      null,
      'Bônus removido automaticamente porque a linha mudou para “'
        || coalesce(new.tipo_produto,'Não informado') || '” + “'
        || coalesce(new.produto,'Não informado') || '”.',
      auth.uid(),
      v_user_nome
    );
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_venda_linha_bonus()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_operadora text;
  v_produto text;
  v_tipo text;
  v_permite_bonus boolean := false;
  v_bonus_valido boolean := false;
  v_contexto_alterado boolean := false;
  v_bonus_ja_existia boolean := false;
  v_catalog_rename boolean := false;
begin
  v_catalog_rename := (
    tg_op='UPDATE'
    and coalesce(current_setting('app.tipo_produto_catalog_rename', true), '0')='1'
    and new.venda_id is not distinct from old.venda_id
    and new.tipo_produto is distinct from old.tipo_produto
  );
  if v_catalog_rename then return new; end if;

  v_operadora := upper(btrim(coalesce(new.operadora,'')));
  v_produto := regexp_replace(
    translate(lower(btrim(coalesce(new.produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '\s+',' ','g'
  );
  v_produto := replace(replace(replace(v_produto,'-',' '),'–',' '),'—',' ');
  v_produto := regexp_replace(v_produto,'\s+',' ','g');

  v_tipo := regexp_replace(
    translate(lower(btrim(coalesce(new.tipo_produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '\s+',' ','g'
  );

  select coalesce(t.permite_bonus,false)
    into v_permite_bonus
  from public.tipos_pedido_catalogo t
  where upper(btrim(t.operadora))=v_operadora
    and t.ativo=true
    and regexp_replace(
      translate(lower(btrim(t.nome)),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'),
      '\s+',' ','g'
    )=v_tipo
  limit 1;

  v_permite_bonus := v_operadora='VIVO'
    and v_produto='movel'
    and coalesce(v_permite_bonus,false);

  v_contexto_alterado := (
    tg_op='INSERT'
    or (
      tg_op='UPDATE'
      and (
        new.venda_id is distinct from old.venda_id
        or new.tipo_produto is distinct from old.tipo_produto
        or new.operadora is distinct from old.operadora
        or new.produto is distinct from old.produto
      )
    )
  );

  v_bonus_ja_existia := (
    tg_op='UPDATE'
    and old.possui_bonus is true
    and new.venda_id is not distinct from old.venda_id
    and new.tipo_produto is not distinct from old.tipo_produto
    and new.operadora is not distinct from old.operadora
    and new.produto is not distinct from old.produto
  );

  if not v_permite_bonus then
    if new.possui_bonus is true and not v_contexto_alterado and not v_bonus_ja_existia then
      raise exception 'Esta combinação de Tipo de Pedido + Produto não permite bônus.';
    end if;
    new.possui_bonus := null;
    new.bonus_gb := null;
    return new;
  end if;

  if coalesce(new.possui_bonus,false)=false then
    new.bonus_gb := null;
    return new;
  end if;

  if tg_op='UPDATE'
     and old.possui_bonus is true
     and new.possui_bonus is true
     and new.bonus_gb is not distinct from old.bonus_gb then
    return new;
  end if;

  select exists (
    select 1 from public.bonus_vivo_catalogo
    where gb=new.bonus_gb and ativo=true
  ) into v_bonus_valido;

  if new.bonus_gb is null or not v_bonus_valido then
    raise exception 'Selecione uma opção ativa do catálogo de bônus VIVO.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_venda_linha_doador_rule()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_operadora text;
  v_tipo text;
  v_produto text;
  v_permite_doador boolean := false;
begin
  select
    upper(btrim(coalesce(vl.operadora,''))),
    regexp_replace(
      translate(lower(btrim(coalesce(vl.tipo_produto,''))),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'),
      '\s+',' ','g'
    ),
    regexp_replace(
      translate(lower(btrim(coalesce(vl.produto,''))),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'),
      '\s+',' ','g'
    )
    into v_operadora,v_tipo,v_produto
  from public.venda_linhas vl
  where vl.id=new.linha_id;

  if v_operadora is null then
    raise exception 'Linha da venda não encontrada.';
  end if;

  v_produto := replace(replace(replace(v_produto,'-',' '),'–',' '),'—',' ');
  v_produto := regexp_replace(v_produto,'\s+',' ','g');

  select coalesce(t.permite_doador,false)
    into v_permite_doador
  from public.tipos_pedido_catalogo t
  where upper(btrim(t.operadora))=v_operadora
    and t.ativo=true
    and regexp_replace(
      translate(lower(btrim(t.nome)),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'),
      '\s+',' ','g'
    )=v_tipo
  limit 1;

  if not coalesce(v_permite_doador,false) or v_produto<>'movel' then
    raise exception 'Esta combinação de Tipo de Pedido + Produto não utiliza Cedente.';
  end if;

  return new;
end;
$function$;

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
begin
  v_produto := regexp_replace(
    translate(lower(btrim(coalesce(new.produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '\s+',' ','g'
  );
  v_produto := replace(replace(replace(v_produto,'-',' '),'–',' '),'—',' ');
  v_produto := regexp_replace(v_produto,'\s+',' ','g');
  if v_produto in ('chip de dados','chip de cados') then v_produto := 'chip dados'; end if;
  if v_produto='microsoft 265' then v_produto := 'microsoft 365'; end if;

  v_pedido := regexp_replace(
    translate(lower(btrim(coalesce(new.tipo_produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '\s+',' ','g'
  );

  if v_operadora='CLARO' then
    if v_produto='movel' and v_pedido in (
      'novo','renovacao','portado','portabilidade cruzada pf/pj','portabilidade pj/pj',
      'transferencia de titularidade pf/pj pos','transferencia de titularidade pf/pj pre',
      'transferencia de titularidade pj/pj'
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
      v_regra:=true; v_usa_ddd:=true; v_usa_numero:=false; v_usa_plano:=true; v_usa_valor:=true;

    elsif v_produto='sva' and v_pedido='portado' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=false;

    elsif v_produto='passaporte' and v_pedido in ('novo','sva') then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=false;

    elsif v_produto='aparelho' and v_pedido in (
      'novo','sva','renovacao','portabilidade cruzada pf/pj','portabilidade pj/pj',
      'transferencia de titularidade pf/pj pos','transferencia de titularidade pf/pj pre'
    ) then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true;
    end if;

  elsif v_operadora='VIVO' then
    if v_produto='movel' and v_pedido in (
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
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=true;

    elsif v_produto='passaporte' and v_pedido='sva' then
      v_regra:=true; v_usa_ddd:=false; v_usa_numero:=false; v_usa_plano:=false; v_usa_valor:=false;
    end if;
  end if;

  if v_regra then
    if not v_usa_ddd then new.ddd := null; end if;
    if not v_usa_numero then new.numero := null; end if;
    if not v_usa_plano then
      new.plano := 'Não informado';
      new.plano_catalogo_id := null;
      new.plano_oferta_id := null;
    end if;
    if not v_usa_valor then new.valor_mensal := 0; end if;
    if not v_usa_descricao then new.descricao_adicional := null; end if;
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.normalizar_operadora_doadora_linha()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_permite_doador boolean := false;
  v_produto text;
  v_tipo text;
begin
  v_produto := regexp_replace(
    translate(lower(btrim(coalesce(new.produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '\s+',' ','g'
  );
  v_produto := replace(replace(replace(v_produto,'-',' '),'–',' '),'—',' ');
  v_produto := regexp_replace(v_produto,'\s+',' ','g');

  v_tipo := regexp_replace(
    translate(lower(btrim(coalesce(new.tipo_produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '\s+',' ','g'
  );

  select coalesce(t.permite_doador,false)
    into v_permite_doador
  from public.tipos_pedido_catalogo t
  where upper(btrim(t.operadora))=upper(btrim(coalesce(new.operadora,'')))
    and t.ativo=true
    and regexp_replace(
      translate(lower(btrim(t.nome)),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'),
      '\s+',' ','g'
    )=v_tipo
  limit 1;

  v_permite_doador := coalesce(v_permite_doador,false) and v_produto='movel';

  if not v_permite_doador then
    new.operadora_doadora := null;
  end if;

  return new;
end;
$function$;

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

CREATE OR REPLACE FUNCTION public.validar_cedente_da_linha()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_venda_id uuid;
  v_tipo_pedido text;
  v_operadora text;
  v_produto text;
  v_documento text;
begin
  select
    venda_id,
    regexp_replace(
      translate(lower(btrim(coalesce(tipo_produto,''))),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'),
      '\s+',' ','g'
    ),
    upper(btrim(coalesce(operadora,''))),
    regexp_replace(
      translate(lower(btrim(coalesce(produto,''))),
        'áàâãäéèêëíìîïóòôõöúùûüç',
        'aaaaaeeeeiiiiooooouuuuc'),
      '\s+',' ','g'
    )
    into v_venda_id,v_tipo_pedido,v_operadora,v_produto
  from public.venda_linhas
  where id=new.linha_id;

  if v_venda_id is null then
    raise exception 'Linha não encontrada para vínculo de Cedente';
  end if;

  v_produto := replace(replace(replace(v_produto,'-',' '),'–',' '),'—',' ');
  v_produto := regexp_replace(v_produto,'\s+',' ','g');

  if v_produto<>'movel' then
    raise exception 'Cedente é permitido somente nas combinações de Produto Móvel configuradas para esta operadora';
  end if;

  if not exists (
    select 1 from public.venda_cedentes vc
    where vc.venda_id=v_venda_id and vc.cedente_id=new.cedente_id
  ) then
    raise exception 'Cedente não pertence aos Cedentes disponíveis deste pedido';
  end if;

  select regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g')
    into v_documento
  from public.cedentes c
  where c.id=new.cedente_id;

  if v_tipo_pedido in ('migracao pre','migracao pos','portabilidade pf/pj')
     and length(v_documento)<>11 then
    raise exception 'Este Tipo de Pedido exige Cedente Pessoa Física com CPF de 11 dígitos';
  end if;

  return new;
end;
$function$;

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
    '\s+',' ','g'
  );
  v_produto := replace(replace(replace(v_produto,'-',' '),'–',' '),'—',' ');
  v_produto := regexp_replace(v_produto,'\s+',' ','g');

  v_pedido := regexp_replace(
    translate(lower(btrim(coalesce(new.tipo_produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '\s+',' ','g'
  );

  if upper(btrim(coalesce(new.operadora,'')))='VIVO' then
    v_elegivel :=
      (v_produto='movel' and v_pedido in ('migracao plano','migracao pre','migracao pos','novo'))
      or (v_produto='passaporte' and v_pedido='sva');
  elsif upper(btrim(coalesce(new.operadora,'')))='CLARO' then
    v_elegivel :=
      (
        v_produto='movel'
        and v_pedido in (
          'novo','renovacao','portado','portabilidade cruzada pf/pj','portabilidade pj/pj',
          'transferencia de titularidade pf/pj pos','transferencia de titularidade pf/pj pre',
          'transferencia de titularidade pj/pj'
        )
      )
      or (v_produto='passaporte' and v_pedido in ('novo','sva'));
  end if;

  if not v_elegivel then
    new.passaporte_produto_id := null;
    new.passaporte_plano_oferta_id := null;
    new.passaporte_plano := null;
    new.passaporte_valor := null;
    return new;
  end if;

  if new.passaporte_produto_id is null then
    new.passaporte_plano_oferta_id := null;
    new.passaporte_plano := null;
    new.passaporte_valor := null;
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
      new.passaporte_produto_id := null;
      new.passaporte_plano_oferta_id := null;
      new.passaporte_plano := null;
      new.passaporte_valor := null;
      return new;
    end if;
    raise exception 'Passaporte pertence a outra operadora';
  end if;

  v_passaporte_nome := regexp_replace(
    translate(lower(btrim(coalesce(v_passaporte_nome,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '\s+',' ','g'
  );

  if upper(btrim(coalesce(new.operadora,'')))='VIVO' then
    if v_passaporte_nome not in ('vivo travel americas','vivo travel europa','vivo travel mundo') then
      raise exception 'Passaporte inválido para esta linha VIVO';
    end if;
  else
    if v_passaporte_nome not in (
      'claro passaporte americas','claro passaporte europa','claro passaporte mundo total'
    ) then
      raise exception 'Passaporte inválido para esta linha CLARO';
    end if;
  end if;

  if new.passaporte_plano_oferta_id is null then
    new.passaporte_plano := null;
    new.passaporte_valor := null;
    return new;
  end if;

  select pc.nome, po.valor_mes, pc.produto_id, pc.operadora, pc.ativo, po.ativo
    into v_plano_nome, v_plano_valor, v_plano_produto_id, v_plano_operadora, v_plano_ativo, v_oferta_ativa
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

  new.passaporte_plano := v_plano_nome;
  new.passaporte_valor := v_plano_valor;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.validar_siga_me_venda_linha()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_produto text;
  v_extra_nome text;
  v_extra_operadora text;
  v_extra_ativo boolean;
begin
  v_produto := regexp_replace(
    translate(lower(btrim(coalesce(new.produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '\s+',' ','g'
  );
  v_produto := replace(replace(replace(v_produto,'-',' '),'–',' '),'—',' ');
  v_produto := regexp_replace(v_produto,'\s+',' ','g');

  if upper(btrim(coalesce(new.operadora,''))) <> 'VIVO' or v_produto <> 'movel' then
    new.siga_me_produto_id := null;
    new.siga_me_descricao := null;
    return new;
  end if;

  if new.siga_me_produto_id is null then
    new.siga_me_descricao := null;
    return new;
  end if;

  select nome,operadora,ativo
    into v_extra_nome,v_extra_operadora,v_extra_ativo
  from public.produtos_catalogo
  where id=new.siga_me_produto_id;

  if not found or not coalesce(v_extra_ativo,false) then
    raise exception 'Siga-Me inválido ou inativo para esta linha';
  end if;

  v_extra_nome := regexp_replace(
    translate(lower(btrim(coalesce(v_extra_nome,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'),
    '\s+',' ','g'
  );
  v_extra_nome := replace(replace(replace(v_extra_nome,'-',' '),'–',' '),'—',' ');
  v_extra_nome := regexp_replace(v_extra_nome,'\s+',' ','g');

  if upper(btrim(coalesce(v_extra_operadora,''))) <> 'VIVO' or v_extra_nome <> 'siga me' then
    if tg_op='UPDATE' and new.operadora is distinct from old.operadora then
      new.siga_me_produto_id := null;
      new.siga_me_descricao := null;
      return new;
    end if;
    raise exception 'Siga-Me adicional inválido para esta linha VIVO';
  end if;

  return new;
end;
$function$;


drop trigger if exists trg_normalizar_campos_venda_linha on public.venda_linhas;
create trigger trg_normalizar_campos_venda_linha
before insert or update of
  produto,tipo_produto,operadora,ddd,numero,plano,plano_catalogo_id,plano_oferta_id,
  valor_mensal,descricao_adicional
on public.venda_linhas
for each row execute function public.normalizar_campos_venda_linha();

drop trigger if exists trg_validar_passaporte_venda_linha on public.venda_linhas;
create trigger trg_validar_passaporte_venda_linha
before insert or update of
  operadora,produto,tipo_produto,passaporte_produto_id,passaporte_plano_oferta_id
on public.venda_linhas
for each row execute function public.validar_passaporte_venda_linha();

drop trigger if exists trg_validar_siga_me_venda_linha on public.venda_linhas;
create trigger trg_validar_siga_me_venda_linha
before insert or update of operadora,produto,tipo_produto,siga_me_produto_id,siga_me_descricao
on public.venda_linhas
for each row execute function public.validar_siga_me_venda_linha();

drop trigger if exists trg_guard_venda_linha_bonus on public.venda_linhas;
create trigger trg_guard_venda_linha_bonus
before insert or update of possui_bonus,bonus_gb,venda_id,tipo_produto,operadora,produto
on public.venda_linhas
for each row execute function public.guard_venda_linha_bonus();

drop trigger if exists normalizar_operadora_doadora_linha_before_write on public.venda_linhas;
create trigger normalizar_operadora_doadora_linha_before_write
before insert or update of operadora,tipo_produto,produto,operadora_doadora
on public.venda_linhas
for each row execute function public.normalizar_operadora_doadora_linha();

drop trigger if exists trg_cleanup_venda_linha_extras_after_type_change on public.venda_linhas;
create trigger trg_cleanup_venda_linha_extras_after_type_change
after update of venda_id,tipo_produto,operadora,produto
on public.venda_linhas
for each row execute function public.cleanup_venda_linha_extras_after_type_change();



revoke all on function public.pipeline_trocar_operadora(uuid,text) from public, anon;
grant execute on function public.pipeline_trocar_operadora(uuid,text) to authenticated;

revoke execute on function public.normalizar_campos_venda_linha() from public, anon, authenticated;
revoke execute on function public.validar_passaporte_venda_linha() from public, anon, authenticated;
revoke execute on function public.validar_siga_me_venda_linha() from public, anon, authenticated;
revoke execute on function public.guard_venda_linha_bonus() from public, anon, authenticated;
revoke execute on function public.normalizar_operadora_doadora_linha() from public, anon, authenticated;
revoke execute on function public.guard_venda_linha_doador_rule() from public, anon, authenticated;
revoke execute on function public.validar_cedente_da_linha() from public, anon, authenticated;
revoke execute on function public.cleanup_venda_linha_extras_after_type_change() from public, anon, authenticated;
