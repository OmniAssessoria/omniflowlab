-- Normaliza Status Comercial removendo apenas o prefixo legado anterior ao primeiro " - ",
-- consolida duplicados por nome reduzido e migra todas as referências para o ID canônico.
-- A migração técnica de vendas é feita com triggers de usuário temporariamente desabilitados
-- para não disparar automações, logs ou movimentações de Pipeline por uma simples troca de representação.

begin;

alter table public.vendas disable trigger user;
alter table public.venda_status_comercial_historico disable trigger user;
alter table public.status_comercial_operadoras disable trigger user;
alter table public.status_comercial_catalogo disable trigger user;

create temp table tmp_status_map on commit drop as
with base as (
  select
    id as old_id,
    nome as old_nome,
    ordem as old_ordem,
    ativo as old_ativo,
    created_at as old_created_at,
    case
      when position(' - ' in nome) > 0
        then btrim(substr(nome, position(' - ' in nome) + 3))
      else btrim(nome)
    end as new_nome
  from public.status_comercial_catalogo
),
chosen as (
  select distinct on (lower(new_nome))
    lower(new_nome) as nome_key,
    old_id as canonical_id
  from base
  order by
    lower(new_nome),
    case when lower(btrim(old_nome)) = lower(btrim(new_nome)) then 0 else 1 end,
    old_ordem,
    old_created_at,
    old_id
)
select b.*, c.canonical_id
from base b
join chosen c on c.nome_key = lower(b.new_nome);

create index on tmp_status_map(old_id);
create index on tmp_status_map(canonical_id);

create temp table tmp_status_op_target on commit drop as
with ranked as (
  select
    m.canonical_id as status_id,
    m.new_nome as nome,
    o.operadora,
    o.sla_horas,
    bool_or(o.ativo) over (partition by m.canonical_id,o.operadora) as ativo,
    bool_or(o.is_final) over (partition by m.canonical_id,o.operadora) as is_final,
    min(o.created_at) over (partition by m.canonical_id,o.operadora) as created_at,
    row_number() over (
      partition by m.canonical_id,o.operadora
      order by
        case when m.old_id = m.canonical_id then 0 else 1 end,
        m.old_ordem,
        o.created_at,
        m.old_id
    ) as rn
  from tmp_status_map m
  join public.status_comercial_operadoras o on o.status_id=m.old_id
)
select status_id,operadora,nome,sla_horas,ativo,is_final,created_at
from ranked
where rn=1;

update public.vendas v
set status_comercial_id = m.canonical_id,
    status_comercial_nome = m.new_nome
from tmp_status_map m
where v.status_comercial_id = m.old_id
  and (
    v.status_comercial_id is distinct from m.canonical_id
    or v.status_comercial_nome is distinct from m.new_nome
  );

update public.venda_status_comercial_historico h
set status_id = m.canonical_id,
    status_nome_snapshot = m.new_nome
from tmp_status_map m
where h.status_id = m.old_id
  and (
    h.status_id is distinct from m.canonical_id
    or h.status_nome_snapshot is distinct from m.new_nome
  );

-- Corrige snapshots antigos sem FK apenas quando o texto corresponde exatamente
-- a um nome que existia no catálogo antes da normalização.
update public.venda_status_comercial_historico h
set status_nome_snapshot = m.new_nome
from tmp_status_map m
where h.status_id is null
  and lower(btrim(h.status_nome_snapshot)) = lower(btrim(m.old_nome))
  and h.status_nome_snapshot is distinct from m.new_nome;

update public.status_comercial_catalogo c
set nome = g.new_nome,
    ativo = g.ativo
from (
  select canonical_id,
         min(new_nome) as new_nome,
         bool_or(old_ativo) as ativo
  from tmp_status_map
  group by canonical_id
) g
where c.id=g.canonical_id;

-- Preserva os metadados do vínculo canônico quando ele já existia.
-- Se o ID canônico não tinha a operadora, herda o primeiro vínculo daquele status.
insert into public.status_comercial_operadoras(
  status_id,operadora,sla_horas,ativo,created_at,updated_at,nome,is_final
)
select
  status_id,operadora,sla_horas,ativo,created_at,now(),nome,is_final
from tmp_status_op_target
on conflict (status_id,operadora)
do update set
  sla_horas=excluded.sla_horas,
  ativo=excluded.ativo,
  updated_at=now(),
  nome=excluded.nome,
  is_final=excluded.is_final;

delete from public.status_comercial_catalogo c
using tmp_status_map m
where c.id=m.old_id
  and m.old_id<>m.canonical_id;

alter table public.status_comercial_catalogo enable trigger user;
alter table public.status_comercial_operadoras enable trigger user;
alter table public.venda_status_comercial_historico enable trigger user;
alter table public.vendas enable trigger user;

-- Normalização usada pelos RPCs de gerenciamento.
-- Só remove os prefixos legados conhecidos para não destruir nomes semânticos
-- como "TROCA NEGADA - CANCELADO" e "PRD - SUPORTE".
create or replace function public.status_comercial_nome_reduzido(p_nome text)
returns text
language sql
immutable
set search_path to 'public'
as $function$
  select nullif(
    btrim(
      regexp_replace(
        btrim(regexp_replace(coalesce(p_nome,''), '[[:space:]]+', ' ', 'g')),
        '^(MV|FB|AVA|COM)[[:space:]]*-[[:space:]]*',
        '',
        'i'
      )
    ),
    ''
  );
$function$;

create or replace function public.criar_status_comercial(
  p_nome text,
  p_operadoras text[],
  p_sla_horas integer default null::integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nome text := public.status_comercial_nome_reduzido(p_nome);
  v_ops text[];
  v_op_text text;
  v_op public.operadora_enum;
  v_status_id uuid;
  v_ordem integer;
begin
  if auth.uid() is null then
    raise exception '401: usuário não autenticado.';
  end if;
  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode criar Status Comercial.';
  end if;

  if v_nome is null then
    raise exception 'Informe o nome do Status Comercial.';
  end if;
  if p_sla_horas is not null and p_sla_horas <= 0 then
    raise exception 'SLA deve ser maior que zero ou vazio para Sem SLA.';
  end if;

  select array_agg(distinct upper(btrim(x)))
  into v_ops
  from unnest(coalesce(p_operadoras, array[]::text[])) x
  where btrim(x) <> '';

  if coalesce(cardinality(v_ops),0) = 0 then
    raise exception 'Selecione ao menos uma operadora.';
  end if;

  foreach v_op_text in array v_ops loop
    if v_op_text not in ('CLARO','VIVO') then
      raise exception 'Operadora inválida: %', v_op_text;
    end if;
    v_op := v_op_text::public.operadora_enum;

    if exists (
      select 1
      from public.status_comercial_operadoras o
      join public.status_comercial_catalogo c on c.id=o.status_id
      where o.operadora=v_op
        and o.ativo=true
        and lower(btrim(c.nome))=lower(v_nome)
    ) then
      raise exception 'Já existe um Status Comercial chamado "%" na %.', v_nome, v_op_text;
    end if;
  end loop;

  select id into v_status_id
  from public.status_comercial_catalogo
  where lower(btrim(nome))=lower(v_nome)
  order by ativo desc,ordem,id
  limit 1;

  if v_status_id is null then
    select coalesce(max(ordem),0)+10 into v_ordem
    from public.status_comercial_catalogo;

    insert into public.status_comercial_catalogo(nome,ordem,ativo)
    values(v_nome,v_ordem,true)
    returning id into v_status_id;
  else
    update public.status_comercial_catalogo
    set ativo=true
    where id=v_status_id;
  end if;

  foreach v_op_text in array v_ops loop
    insert into public.status_comercial_operadoras(
      status_id,operadora,nome,sla_horas,ativo,is_final,updated_at
    ) values (
      v_status_id,
      v_op_text::public.operadora_enum,
      v_nome,
      p_sla_horas,
      true,
      false,
      now()
    )
    on conflict (status_id,operadora)
    do update set
      nome=excluded.nome,
      sla_horas=excluded.sla_horas,
      ativo=true,
      updated_at=now();
  end loop;

  return jsonb_build_object(
    'status_id',v_status_id,
    'nome',v_nome,
    'operadoras',v_ops,
    'sla_horas',p_sla_horas
  );
end;
$function$;

create or replace function public.atualizar_status_comercial(
  p_status_id uuid,
  p_operadora text,
  p_nome text,
  p_sla_horas integer default null::integer,
  p_ativo boolean default true
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_nome text := public.status_comercial_nome_reduzido(p_nome);
  v_op public.operadora_enum;
  v_is_final boolean;
begin
  if auth.uid() is null then
    raise exception '401: usuário não autenticado.';
  end if;
  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode editar Status Comercial.';
  end if;

  if upper(btrim(coalesce(p_operadora,''))) not in ('CLARO','VIVO') then
    raise exception 'Operadora inválida.';
  end if;
  v_op := upper(btrim(p_operadora))::public.operadora_enum;

  if v_nome is null then
    raise exception 'Informe o nome do Status Comercial.';
  end if;
  if p_sla_horas is not null and p_sla_horas <= 0 then
    raise exception 'SLA deve ser maior que zero ou vazio para Sem SLA.';
  end if;

  select is_final
  into v_is_final
  from public.status_comercial_operadoras
  where status_id=p_status_id
    and operadora=v_op;

  if not found then
    raise exception 'Status Comercial não encontrado para a operadora %.', v_op;
  end if;

  if v_is_final and not p_ativo then
    raise exception 'Status finalizador não pode ser desativado.';
  end if;

  if exists (
    select 1
    from public.status_comercial_catalogo c
    where c.id<>p_status_id
      and lower(btrim(c.nome))=lower(v_nome)
  ) then
    raise exception 'Já existe um Status Comercial chamado "%".', v_nome;
  end if;

  update public.status_comercial_catalogo
  set nome=v_nome
  where id=p_status_id;

  update public.status_comercial_operadoras
  set nome=v_nome,
      updated_at=now()
  where status_id=p_status_id;

  update public.status_comercial_operadoras
  set sla_horas=p_sla_horas,
      ativo=p_ativo,
      updated_at=now()
  where status_id=p_status_id
    and operadora=v_op;
end;
$function$;

-- Mantém a automação de Móvel compatível tanto com o texto legado
-- quanto com o nome canônico AGUARDANDO ACEITE.
create or replace function public.pipeline_auto_mv_aguardando_aceite()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_status_pedido text;
  v_status_comercial text;
  v_entrou_no_status boolean := false;
  v_tem_movel boolean := false;
begin
  if new.deleted_at is not null
     or coalesce(new.is_deleted,false)
     or new.concluido_em is not null then
    return new;
  end if;

  v_status_pedido := regexp_replace(
    translate(
      upper(btrim(coalesce(new.status_pedido,''))),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'AAAAAEEEEIIIIOOOOOUUUUC'
    ),
    '[^A-Z0-9]+',
    ' ',
    'g'
  );
  v_status_pedido := regexp_replace(btrim(v_status_pedido),'[[:space:]]+',' ','g');

  v_status_comercial := regexp_replace(
    translate(
      upper(btrim(coalesce(new.status_comercial_nome,''))),
      'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'AAAAAEEEEIIIIOOOOOUUUUC'
    ),
    '[^A-Z0-9]+',
    ' ',
    'g'
  );
  v_status_comercial := regexp_replace(btrim(v_status_comercial),'[[:space:]]+',' ','g');

  v_tem_movel :=
    regexp_replace(
      translate(upper(btrim(coalesce(new.produto,''))),
        'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'AAAAAEEEEIIIIOOOOOUUUUC'),
      '[^A-Z0-9]+','','g'
    )='MOVEL'
    or exists (
      select 1
      from unnest(coalesce(new.produtos,array[]::text[])) p
      where regexp_replace(
        translate(upper(btrim(coalesce(p,''))),
          'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
          'AAAAAEEEEIIIIOOOOOUUUUC'),
        '[^A-Z0-9]+','','g'
      )='MOVEL'
    )
    or exists (
      select 1
      from public.venda_linhas vl
      where vl.venda_id=new.id
        and coalesce(vl.status,'ativa')<>'cancelada'
        and regexp_replace(
          translate(upper(btrim(coalesce(vl.produto,''))),
            'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
            'AAAAAEEEEIIIIOOOOOUUUUC'),
          '[^A-Z0-9]+','','g'
        )='MOVEL'
    );

  v_entrou_no_status :=
    (
      new.status_pedido is distinct from old.status_pedido
      and (
        v_status_pedido='MV AGUARDANDO ACEITE'
        or (v_status_pedido='AGUARDANDO ACEITE' and v_tem_movel)
      )
    )
    or
    (
      new.status_comercial_nome is distinct from old.status_comercial_nome
      and (
        v_status_comercial='MV AGUARDANDO ACEITE'
        or (v_status_comercial='AGUARDANDO ACEITE' and v_tem_movel)
      )
    );

  if not v_entrou_no_status then
    return new;
  end if;

  if not exists (
    select 1
    from public.pipeline_funis f
    join public.pipeline_etapas e on e.funil_id=f.id
    where f.id='assinatura'
      and f.ativo
      and f.participa_fluxo_comercial
      and e.id='a-aguardando'
      and e.ativo
  ) then
    raise exception 'Automação: destino Assinatura → Aguardando Assinatura está indisponível.';
  end if;

  new.funil := 'assinatura'::public.funil_enum;
  new.etapa_id := 'a-aguardando';
  new.dias_na_etapa := 0;

  return new;
end;
$function$;

commit;
