begin;

-- Empresa é entidade global: um único cadastro ativo por CNPJ/CPF.
-- As vendas continuam protegidas pelas RLS próprias e não se tornam globais.

create or replace function public.normalizar_documento_cliente(p_documento text)
returns text
language sql
immutable
parallel safe
as $function$
  select upper(regexp_replace(coalesce(p_documento, ''), '[^0-9A-Za-z]', '', 'g'));
$function$;

-- Mapa das duplicidades ativas atuais. O cadastro mais antigo é o canônico.
create temporary table tmp_cliente_merge on commit drop as
with base as (
  select
    c.id,
    public.normalizar_documento_cliente(c.cnpj_cpf) as doc,
    c.created_at,
    first_value(c.id) over (
      partition by public.normalizar_documento_cliente(c.cnpj_cpf)
      order by c.created_at asc, c.id asc
    ) as canonical_id,
    count(*) over (
      partition by public.normalizar_documento_cliente(c.cnpj_cpf)
    ) as qtd
  from public.clientes c
  where c.deleted_at is null
    and not coalesce(c.is_deleted, false)
    and public.normalizar_documento_cliente(c.cnpj_cpf) <> ''
)
select canonical_id, id as duplicate_id, doc
from base
where qtd > 1
  and id <> canonical_id;

-- Guarda a prioridade atual dos papéis de representantes antes da fusão.
create temporary table tmp_cliente_rep_roles on commit drop as
select
  m.canonical_id,
  r.id as representante_id,
  r.negociante,
  r.assinante,
  r.principal,
  case when r.cliente_id = m.canonical_id then 0 else 1 end as prioridade_origem,
  r.created_at
from (
  select distinct canonical_id, doc from tmp_cliente_merge
) g
join public.clientes c
  on public.normalizar_documento_cliente(c.cnpj_cpf) = g.doc
 and c.deleted_at is null
 and not coalesce(c.is_deleted, false)
join public.cliente_representantes r on r.cliente_id = c.id
join tmp_cliente_merge m on m.canonical_id = g.canonical_id
group by
  m.canonical_id, r.id, r.negociante, r.assinante, r.principal,
  case when r.cliente_id = m.canonical_id then 0 else 1 end,
  r.created_at;

-- O merge não deve disparar automações de negócio, histórico de venda,
-- recalculadores ou validadores intermediários.
alter table public.vendas disable trigger user;
alter table public.clientes disable trigger user;
alter table public.cliente_representantes disable trigger user;
alter table public.cliente_cedentes disable trigger user;
alter table public.cliente_cessionarios disable trigger user;

-- Completa campos vazios do cadastro canônico usando a melhor informação
-- disponível entre as duplicatas, sem substituir dados já preenchidos.
update public.clientes c
set
  contato = coalesce(
    nullif(btrim(c.contato), ''),
    (
      select nullif(btrim(x.contato), '')
      from public.clientes x
      join tmp_cliente_merge m on m.canonical_id = c.id
      where public.normalizar_documento_cliente(x.cnpj_cpf) = m.doc
        and nullif(btrim(x.contato), '') is not null
      order by x.updated_at desc nulls last, x.created_at desc, x.id
      limit 1
    )
  ),
  ddd = coalesce(
    nullif(btrim(c.ddd), ''),
    (
      select nullif(btrim(x.ddd), '')
      from public.clientes x
      join tmp_cliente_merge m on m.canonical_id = c.id
      where public.normalizar_documento_cliente(x.cnpj_cpf) = m.doc
        and nullif(btrim(x.ddd), '') is not null
      order by x.updated_at desc nulls last, x.created_at desc, x.id
      limit 1
    )
  ),
  telefone = coalesce(
    nullif(btrim(c.telefone), ''),
    (
      select nullif(btrim(x.telefone), '')
      from public.clientes x
      join tmp_cliente_merge m on m.canonical_id = c.id
      where public.normalizar_documento_cliente(x.cnpj_cpf) = m.doc
        and nullif(btrim(x.telefone), '') is not null
      order by x.updated_at desc nulls last, x.created_at desc, x.id
      limit 1
    )
  ),
  email = coalesce(
    nullif(btrim(c.email), ''),
    (
      select nullif(btrim(x.email), '')
      from public.clientes x
      join tmp_cliente_merge m on m.canonical_id = c.id
      where public.normalizar_documento_cliente(x.cnpj_cpf) = m.doc
        and nullif(btrim(x.email), '') is not null
      order by x.updated_at desc nulls last, x.created_at desc, x.id
      limit 1
    )
  ),
  uf = coalesce(
    nullif(btrim(c.uf), ''),
    (
      select nullif(btrim(x.uf), '')
      from public.clientes x
      join tmp_cliente_merge m on m.canonical_id = c.id
      where public.normalizar_documento_cliente(x.cnpj_cpf) = m.doc
        and nullif(btrim(x.uf), '') is not null
      order by x.updated_at desc nulls last, x.created_at desc, x.id
      limit 1
    )
  ),
  observacao = coalesce(
    nullif(btrim(c.observacao), ''),
    (
      select nullif(btrim(x.observacao), '')
      from public.clientes x
      join tmp_cliente_merge m on m.canonical_id = c.id
      where public.normalizar_documento_cliente(x.cnpj_cpf) = m.doc
        and nullif(btrim(x.observacao), '') is not null
      order by x.updated_at desc nulls last, x.created_at desc, x.id
      limit 1
    )
  )
where c.id in (select distinct canonical_id from tmp_cliente_merge);

-- Move todas as vendas para a empresa canônica.
update public.vendas v
set cliente_id = m.canonical_id
from tmp_cliente_merge m
where v.cliente_id = m.duplicate_id;

-- Une Cedentes vinculados à empresa.
insert into public.cliente_cedentes(cliente_id, cedente_id, created_at, created_by, ativo)
select
  m.canonical_id,
  cc.cedente_id,
  cc.created_at,
  cc.created_by,
  cc.ativo
from public.cliente_cedentes cc
join tmp_cliente_merge m on m.duplicate_id = cc.cliente_id
on conflict (cliente_id, cedente_id)
do update set ativo = public.cliente_cedentes.ativo or excluded.ativo;

delete from public.cliente_cedentes cc
using tmp_cliente_merge m
where cc.cliente_id = m.duplicate_id;

-- Une Cessionários vinculados à empresa.
insert into public.cliente_cessionarios(cliente_id, cessionario_id, created_at, created_by, ativo)
select
  m.canonical_id,
  cc.cessionario_id,
  cc.created_at,
  cc.created_by,
  cc.ativo
from public.cliente_cessionarios cc
join tmp_cliente_merge m on m.duplicate_id = cc.cliente_id
on conflict (cliente_id, cessionario_id)
do update set ativo = public.cliente_cessionarios.ativo or excluded.ativo;

delete from public.cliente_cessionarios cc
using tmp_cliente_merge m
where cc.cliente_id = m.duplicate_id;

-- Antes de mover, limpa temporariamente os papéis dos representantes das
-- empresas duplicadas para não colidir com os índices únicos de Negociante,
-- Assinante e Principal do cadastro canônico. Os papéis originais já foram
-- guardados em tmp_cliente_rep_roles e serão restaurados logo abaixo.
update public.cliente_representantes r
set negociante = false,
    assinante = false,
    principal = false
from tmp_cliente_merge m
where r.cliente_id = m.duplicate_id;

-- Move todos os representantes.
update public.cliente_representantes r
set cliente_id = m.canonical_id
from tmp_cliente_merge m
where r.cliente_id = m.duplicate_id;

-- Normaliza os papéis nos grupos mesclados para continuar existindo
-- exatamente um Negociante e um Assinante por empresa.
update public.cliente_representantes r
set negociante = false,
    assinante = false,
    principal = false
where r.cliente_id in (select distinct canonical_id from tmp_cliente_merge);

with escolhido as (
  select distinct on (rr.canonical_id)
    rr.canonical_id,
    rr.representante_id
  from tmp_cliente_rep_roles rr
  where rr.negociante
  order by rr.canonical_id, rr.prioridade_origem, rr.created_at, rr.representante_id
)
update public.cliente_representantes r
set negociante = true
from escolhido e
where r.id = e.representante_id
  and r.cliente_id = e.canonical_id;

with escolhido as (
  select distinct on (rr.canonical_id)
    rr.canonical_id,
    rr.representante_id
  from tmp_cliente_rep_roles rr
  where rr.assinante
  order by rr.canonical_id, rr.prioridade_origem, rr.created_at, rr.representante_id
)
update public.cliente_representantes r
set assinante = true
from escolhido e
where r.id = e.representante_id
  and r.cliente_id = e.canonical_id;

with escolhido as (
  select distinct on (rr.canonical_id)
    rr.canonical_id,
    rr.representante_id
  from tmp_cliente_rep_roles rr
  where rr.principal
  order by rr.canonical_id, rr.prioridade_origem, rr.created_at, rr.representante_id
)
update public.cliente_representantes r
set principal = true
from escolhido e
where r.id = e.representante_id
  and r.cliente_id = e.canonical_id;

-- Caso um conjunto legado de representantes não tivesse papéis válidos,
-- escolhe o primeiro representante como fallback para não deixar a empresa quebrada.
with faltando as (
  select
    r.cliente_id,
    min(r.id::text)::uuid as representante_id
  from public.cliente_representantes r
  where r.cliente_id in (select distinct canonical_id from tmp_cliente_merge)
  group by r.cliente_id
  having count(*) > 0
     and count(*) filter (where r.negociante) = 0
)
update public.cliente_representantes r
set negociante = true
from faltando f
where r.id = f.representante_id
  and r.cliente_id = f.cliente_id;

with faltando as (
  select
    r.cliente_id,
    min(r.id::text)::uuid as representante_id
  from public.cliente_representantes r
  where r.cliente_id in (select distinct canonical_id from tmp_cliente_merge)
  group by r.cliente_id
  having count(*) > 0
     and count(*) filter (where r.assinante) = 0
)
update public.cliente_representantes r
set assinante = true
from faltando f
where r.id = f.representante_id
  and r.cliente_id = f.cliente_id;

with faltando as (
  select
    r.cliente_id,
    min(r.id::text)::uuid as representante_id
  from public.cliente_representantes r
  where r.cliente_id in (select distinct canonical_id from tmp_cliente_merge)
  group by r.cliente_id
  having count(*) > 0
     and count(*) filter (where r.principal) = 0
)
update public.cliente_representantes r
set principal = true
from faltando f
where r.id = f.representante_id
  and r.cliente_id = f.cliente_id;

-- Remove apenas os cadastros duplicados, depois que toda relação foi movida.
delete from public.clientes c
using tmp_cliente_merge m
where c.id = m.duplicate_id;

-- Recalcula apenas métricas do cadastro canônico, sem alterar contato/documento.
update public.clientes c
set
  qtd_linhas_total = coalesce((
    select sum(v.quantidade_linhas)
    from public.vendas v
    where v.cliente_id = c.id
      and not coalesce(v.is_deleted, false)
      and v.deleted_at is null
  ), 0),
  receita_total = coalesce((
    select sum(v.valor)
    from public.vendas v
    where v.cliente_id = c.id
      and not coalesce(v.is_deleted, false)
      and v.deleted_at is null
  ), 0),
  ultima_venda_em = (
    select max(coalesce(
      v.data_ativacao::timestamptz,
      v.data_recebimento::timestamptz,
      v.updated_at,
      v.created_at
    ))
    from public.vendas v
    where v.cliente_id = c.id
      and not coalesce(v.is_deleted, false)
      and v.deleted_at is null
  ),
  operadoras = coalesce((
    select array_agg(distinct v.operadora::text order by v.operadora::text)
    from public.vendas v
    where v.cliente_id = c.id
      and v.operadora is not null
      and not coalesce(v.is_deleted, false)
      and v.deleted_at is null
  ), c.operadoras)
where c.id in (select distinct canonical_id from tmp_cliente_merge);

alter table public.cliente_cessionarios enable trigger user;
alter table public.cliente_cedentes enable trigger user;
alter table public.cliente_representantes enable trigger user;
alter table public.clientes enable trigger user;
alter table public.vendas enable trigger user;

-- Todos os perfis operacionais podem visualizar o cadastro global de empresas.
-- Isso NÃO altera RLS de vendas; Consultor continua vendo somente suas vendas.
drop policy if exists "usuarios operacionais visualizam todas as empresas" on public.clientes;
create policy "usuarios operacionais visualizam todas as empresas"
on public.clientes
for select
to authenticated
using (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  or public.has_role(auth.uid(), 'gestor'::public.app_role)
  or public.has_role(auth.uid(), 'bko'::public.app_role)
  or public.has_role(auth.uid(), 'consultor'::public.app_role)
  or public.has_role(auth.uid(), 'closer'::public.app_role)
  or public.has_role(auth.uid(), 'suporte'::public.app_role)
);

-- Busca canônica por documento, independente de pontuação.
create or replace function public.buscar_cliente_por_documento(p_documento text)
returns table (
  id uuid,
  razao_social text,
  cnpj_cpf text
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select c.id, c.razao_social, c.cnpj_cpf
  from public.clientes c
  where c.deleted_at is null
    and not coalesce(c.is_deleted, false)
    and public.normalizar_documento_cliente(c.cnpj_cpf)
        = public.normalizar_documento_cliente(p_documento)
    and public.normalizar_documento_cliente(p_documento) <> ''
  order by c.created_at asc, c.id asc
  limit 1;
$function$;

revoke all on function public.buscar_cliente_por_documento(text) from public;
grant execute on function public.buscar_cliente_por_documento(text) to authenticated;

create or replace function public.cliente_documento_em_uso(
  p_documento text,
  p_excluir_cliente_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.clientes c
    where c.deleted_at is null
      and not coalesce(c.is_deleted, false)
      and public.normalizar_documento_cliente(c.cnpj_cpf)
          = public.normalizar_documento_cliente(p_documento)
      and public.normalizar_documento_cliente(p_documento) <> ''
      and (p_excluir_cliente_id is null or c.id <> p_excluir_cliente_id)
  );
$function$;

grant execute on function public.cliente_documento_em_uso(text, uuid) to authenticated;

-- Proteção física contra qualquer nova duplicidade, inclusive com máscaras diferentes.
drop index if exists public.clientes_documento_normalizado_ativo_uidx;
create unique index clientes_documento_normalizado_ativo_uidx
on public.clientes (public.normalizar_documento_cliente(cnpj_cpf))
where deleted_at is null
  and not coalesce(is_deleted, false)
  and public.normalizar_documento_cliente(cnpj_cpf) <> '';

-- Mantém os triggers legados, agora usando a mesma normalização canônica.
create or replace function public.impedir_documento_empresa_duplicado()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_documento text;
begin
  if new.deleted_at is not null or coalesce(new.is_deleted, false) then
    return new;
  end if;

  v_documento := public.normalizar_documento_cliente(new.cnpj_cpf);
  if v_documento = '' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('cliente-documento:' || v_documento));

  if exists (
    select 1
    from public.clientes c
    where c.id <> new.id
      and c.deleted_at is null
      and not coalesce(c.is_deleted, false)
      and public.normalizar_documento_cliente(c.cnpj_cpf) = v_documento
  ) then
    raise exception 'Este CNPJ/CPF já está cadastrado. Selecione a empresa existente.';
  end if;

  return new;
end;
$function$;

create or replace function public.validar_documento_unico_cliente()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_novo text := public.normalizar_documento_cliente(new.cnpj_cpf);
  v_antigo text := case
    when tg_op = 'UPDATE' then public.normalizar_documento_cliente(old.cnpj_cpf)
    else null
  end;
begin
  if v_novo = '' then
    return new;
  end if;

  if tg_op = 'UPDATE' and v_novo = v_antigo then
    return new;
  end if;

  if exists (
    select 1
    from public.clientes c
    where c.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and c.deleted_at is null
      and not coalesce(c.is_deleted, false)
      and public.normalizar_documento_cliente(c.cnpj_cpf) = v_novo
  ) then
    raise exception 'Já existe uma empresa ativa cadastrada com este CNPJ/CPF. Use o cadastro existente.';
  end if;

  return new;
end;
$function$;

commit;
