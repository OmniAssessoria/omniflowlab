
-- Matriz CLARO por Tipo de Pedido + Produto e estrutura de plano do Passaporte.
-- Mantém compatibilidade com VIVO e reaproveita os catálogos de planos/ofertas existentes.

alter table public.venda_linhas
  add column if not exists passaporte_plano_oferta_id uuid null,
  add column if not exists passaporte_plano text null,
  add column if not exists passaporte_valor numeric(12,2) null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='venda_linhas_passaporte_plano_oferta_id_fkey'
  ) then
    alter table public.venda_linhas
      add constraint venda_linhas_passaporte_plano_oferta_id_fkey
      foreign key (passaporte_plano_oferta_id)
      references public.plano_ofertas_catalogo(id)
      on delete set null;
  end if;
end $$;

create index if not exists venda_linhas_passaporte_plano_oferta_id_idx
  on public.venda_linhas(passaporte_plano_oferta_id);

comment on column public.venda_linhas.passaporte_plano_oferta_id is
  'Oferta de plano/franquia selecionada para o Passaporte adicional da linha.';
comment on column public.venda_linhas.passaporte_plano is
  'Snapshot textual do plano/franquia do Passaporte (ex.: 5 GB).';
comment on column public.venda_linhas.passaporte_valor is
  'Snapshot do valor do plano/franquia do Passaporte.';

-- Produto SVA passa a existir no catálogo CLARO para Portado.
with itens(nome,grupo) as (
  values
    ('SVA','G1'),
    ('CLARO PASSAPORTE AMÉRICAS','G1'),
    ('CLARO PASSAPORTE EUROPA','G1'),
    ('CLARO PASSAPORTE MUNDO TOTAL','G1')
)
update public.produtos_catalogo p
set ativo=true,
    grupo_compatibilidade=coalesce(p.grupo_compatibilidade,i.grupo)
from itens i
where p.operadora='CLARO'
  and lower(btrim(p.nome))=lower(btrim(i.nome));

with itens(nome,grupo) as (
  values
    ('SVA','G1'),
    ('CLARO PASSAPORTE AMÉRICAS','G1'),
    ('CLARO PASSAPORTE EUROPA','G1'),
    ('CLARO PASSAPORTE MUNDO TOTAL','G1')
)
insert into public.produtos_catalogo(nome,operadora,ativo,grupo_compatibilidade)
select i.nome,'CLARO',true,i.grupo
from itens i
where not exists (
  select 1
  from public.produtos_catalogo p
  where p.operadora='CLARO'
    and lower(btrim(p.nome))=lower(btrim(i.nome))
);

-- Doador/Cedente é obrigatório como possibilidade de preenchimento
-- nas portabilidades e transferências CLARO citadas.
update public.tipos_pedido_catalogo
set permite_doador=true
where operadora='CLARO'
  and lower(
    translate(
      btrim(nome),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
      'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
    )
  ) in (
    'portabilidade cruzada pf/pj',
    'portabilidade pj/pj',
    'transferencia de titularidade pf/pj pos',
    'transferencia de titularidade pf/pj pre',
    'transferencia de titularidade pj/pj'
  );

-- Passaporte: preserva VIVO e adiciona CLARO.
create or replace function public.validar_passaporte_venda_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
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
    translate(
      lower(btrim(coalesce(new.produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '\s+',' ','g'
  );

  v_pedido := regexp_replace(
    translate(
      lower(btrim(coalesce(new.tipo_produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '\s+',' ','g'
  );

  if upper(btrim(coalesce(new.operadora,'')))='VIVO' then
    v_elegivel :=
      v_produto in ('movel','fixa')
      and v_pedido in ('migracao plano','migracao pre','migracao pos');
  elsif upper(btrim(coalesce(new.operadora,'')))='CLARO' then
    v_elegivel :=
      (
        v_produto='movel'
        and v_pedido in (
          'novo',
          'renovacao',
          'portado',
          'portabilidade cruzada pf/pj',
          'portabilidade pj/pj',
          'transferencia de titularidade pf/pj pos',
          'transferencia de titularidade pf/pj pre',
          'transferencia de titularidade pj/pj'
        )
      )
      or (
        v_produto='passaporte'
        and v_pedido in ('novo','sva')
      );
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

  if upper(btrim(coalesce(new.operadora,'')))='VIVO' then
    if v_passaporte_operadora<>'VIVO'
       or v_passaporte_nome not in (
         'VIVO TRAVEL AMÉRICAS',
         'VIVO TRAVEL EUROPA',
         'VIVO TRAVEL MUNDO'
       ) then
      raise exception 'Passaporte inválido para esta linha VIVO';
    end if;
  else
    if v_passaporte_operadora<>'CLARO'
       or v_passaporte_nome not in (
         'CLARO PASSAPORTE AMÉRICAS',
         'CLARO PASSAPORTE EUROPA',
         'CLARO PASSAPORTE MUNDO TOTAL'
       ) then
      raise exception 'Passaporte inválido para esta linha CLARO';
    end if;
  end if;

  if new.passaporte_plano_oferta_id is null then
    new.passaporte_plano := null;
    new.passaporte_valor := null;
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

  new.passaporte_plano := v_plano_nome;
  new.passaporte_valor := v_plano_valor;

  return new;
end;
$function$;

drop trigger if exists trg_validar_passaporte_venda_linha on public.venda_linhas;
create trigger trg_validar_passaporte_venda_linha
before insert or update of
  operadora,
  produto,
  tipo_produto,
  passaporte_produto_id,
  passaporte_plano_oferta_id
on public.venda_linhas
for each row execute function public.validar_passaporte_venda_linha();

revoke execute on function public.validar_passaporte_venda_linha() from public;
revoke execute on function public.validar_passaporte_venda_linha() from anon;
revoke execute on function public.validar_passaporte_venda_linha() from authenticated;

-- Normalização dos campos da linha.
-- Para CLARO, aplica a matriz informada por Tipo de Pedido + Produto.
-- Para as demais operadoras mantém as regras já existentes.
create or replace function public.normalizar_campos_venda_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_produto text := regexp_replace(
    translate(
      lower(btrim(coalesce(new.produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '\s+',' ','g'
  );
  v_pedido text := regexp_replace(
    translate(
      lower(btrim(coalesce(new.tipo_produto,''))),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '\s+',' ','g'
  );
  v_operadora text := upper(btrim(coalesce(new.operadora,'')));
  v_entrou_em_fixa boolean := false;
  v_regra_claro boolean := false;
  v_usa_ddd boolean := true;
  v_usa_numero boolean := true;
  v_usa_plano boolean := true;
  v_usa_valor boolean := true;
begin
  if tg_op='INSERT' then
    v_entrou_em_fixa := (v_produto='fixa');
  else
    v_entrou_em_fixa := (
      v_produto='fixa'
      and (
        regexp_replace(
          translate(
            lower(btrim(coalesce(old.produto,''))),
            'áàâãäéèêëíìîïóòôõöúùûüç',
            'aaaaaeeeeiiiiooooouuuuc'
          ),
          '\s+',' ','g'
        ) is distinct from v_produto
        or upper(btrim(coalesce(old.operadora,''))) is distinct from v_operadora
      )
    );
  end if;

  if v_operadora='CLARO' then
    -- Móvel: todos os campos principais nas combinações permitidas.
    if v_produto='movel'
       and v_pedido in (
         'novo',
         'renovacao',
         'portado',
         'portabilidade cruzada pf/pj',
         'portabilidade pj/pj',
         'transferencia de titularidade pf/pj pos',
         'transferencia de titularidade pf/pj pre',
         'transferencia de titularidade pj/pj'
       ) then
      v_regra_claro := true;
      v_usa_ddd := true;
      v_usa_numero := true;
      v_usa_plano := true;
      v_usa_valor := true;

    elsif v_produto='fixa' and v_pedido='novo' then
      v_regra_claro := true;
      v_usa_ddd := true;
      v_usa_numero := false;
      v_usa_plano := false;
      v_usa_valor := true;

    elsif v_produto='fixa' and v_pedido='portado' then
      v_regra_claro := true;
      v_usa_ddd := true;
      v_usa_numero := true;
      v_usa_plano := false;
      v_usa_valor := true;

    elsif v_produto='banda larga' and v_pedido='novo' then
      v_regra_claro := true;
      v_usa_ddd := false;
      v_usa_numero := false;
      v_usa_plano := true;
      v_usa_valor := true;

    elsif v_produto='m2m' and v_pedido='novo' then
      v_regra_claro := true;
      v_usa_ddd := true;
      v_usa_numero := false;
      v_usa_plano := true;
      v_usa_valor := true;

    elsif v_produto='tv' and v_pedido='novo' then
      v_regra_claro := true;
      v_usa_ddd := false;
      v_usa_numero := false;
      v_usa_plano := true;
      v_usa_valor := true;

    elsif v_produto='chip dados' and v_pedido='novo' then
      v_regra_claro := true;
      v_usa_ddd := false;
      v_usa_numero := false;
      v_usa_plano := false;
      v_usa_valor := false;

    elsif v_produto='sva' and v_pedido='portado' then
      v_regra_claro := true;
      v_usa_ddd := false;
      v_usa_numero := false;
      v_usa_plano := false;
      v_usa_valor := false;

    elsif v_produto='passaporte' and v_pedido in ('novo','sva') then
      v_regra_claro := true;
      v_usa_ddd := false;
      v_usa_numero := false;
      v_usa_plano := false;
      v_usa_valor := false;

    elsif v_produto='aparelho'
       and v_pedido in (
         'novo',
         'sva',
         'renovacao',
         'portabilidade cruzada pf/pj',
         'portabilidade pj/pj',
         'transferencia de titularidade pf/pj pos',
         'transferencia de titularidade pf/pj pre',
         'transferencia de titularidade pj/pj'
       ) then
      v_regra_claro := true;
      v_usa_ddd := false;
      v_usa_numero := false;
      v_usa_plano := false;
      -- Valor permanece na coluna principal, porém a UI o edita pelo bloco adicional do aparelho.
      v_usa_valor := true;
    end if;

    if v_regra_claro then
      if not v_usa_ddd then new.ddd := null; end if;
      if not v_usa_numero then new.numero := null; end if;
      if not v_usa_plano then
        new.plano := 'Não informado';
        new.plano_catalogo_id := null;
        new.plano_oferta_id := null;
      end if;
      if not v_usa_valor then
        new.valor_mensal := 0;
      end if;
    end if;
  else
    if v_produto='banda larga' then
      new.ddd := null;
      new.numero := null;
    end if;

    if v_produto='fixa' and v_pedido='novo' then
      new.numero := null;
      new.plano := 'Não informado';
      new.plano_catalogo_id := null;
      new.plano_oferta_id := null;
    end if;

    if v_produto='fixa' and v_pedido='portado' then
      new.plano := 'Não informado';
      new.plano_catalogo_id := null;
      new.plano_oferta_id := null;
    end if;

    if v_operadora='VIVO' and v_produto='movel' and v_pedido='novo' then
      new.numero := null;
    end if;
  end if;

  if v_operadora='VIVO'
     and v_produto='fixa'
     and v_entrou_em_fixa
     and coalesce(new.valor_mensal,0)=0 then
    new.valor_mensal := 30.00;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_normalizar_campos_venda_linha on public.venda_linhas;
create trigger trg_normalizar_campos_venda_linha
before insert or update of produto,tipo_produto,operadora,ddd,numero,plano,plano_catalogo_id,plano_oferta_id,valor_mensal
on public.venda_linhas
for each row execute function public.normalizar_campos_venda_linha();

revoke execute on function public.normalizar_campos_venda_linha() from public;
revoke execute on function public.normalizar_campos_venda_linha() from anon;
revoke execute on function public.normalizar_campos_venda_linha() from authenticated;
