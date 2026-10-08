-- Planos móveis VIVO informados pelo time OMNI.
-- Mantém a carga idempotente e registra o bônus como legenda da oferta.

with produto as (
  select id
  from public.produtos_catalogo
  where operadora='VIVO' and nome='Móvel' and ativo=true
  limit 1
),
entrada(nome, valor_mes, bonus_extra) as (
  values
    ('6GB',   39.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('15GB',  54.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('20GB',  59.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('30GB',  69.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('40GB',  79.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('50GB',  89.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('100GB', 99.99::numeric, 'BÔNUS +10GB POR LINHA')
)
update public.planos_catalogo pc
set valor_mes=e.valor_mes,
    bonus_extra=e.bonus_extra,
    origem='VIVO MÓVEL',
    ativo=true
from entrada e, produto p
where pc.operadora='VIVO'
  and pc.produto_id=p.id
  and pc.nome=e.nome;

with produto as (
  select id
  from public.produtos_catalogo
  where operadora='VIVO' and nome='Móvel' and ativo=true
  limit 1
),
entrada(nome, valor_mes, bonus_extra) as (
  values
    ('6GB',   39.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('15GB',  54.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('20GB',  59.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('30GB',  69.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('40GB',  79.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('50GB',  89.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('100GB', 99.99::numeric, 'BÔNUS +10GB POR LINHA')
)
insert into public.planos_catalogo(
  nome, operadora, ativo, produto_id, bonus_extra, valor_mes, origem, pagina_fonte
)
select e.nome,'VIVO',true,p.id,e.bonus_extra,e.valor_mes,'VIVO MÓVEL',null
from entrada e
cross join produto p
where not exists (
  select 1
  from public.planos_catalogo pc
  where pc.operadora='VIVO'
    and pc.produto_id=p.id
    and pc.nome=e.nome
);

with entrada(nome, valor_mes, bonus_extra) as (
  values
    ('6GB',   39.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('15GB',  54.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('20GB',  59.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('30GB',  69.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('40GB',  79.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('50GB',  89.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('100GB', 99.99::numeric, 'BÔNUS +10GB POR LINHA')
)
update public.plano_ofertas_catalogo po
set valor_mes=e.valor_mes,
    bonus_extra=e.bonus_extra,
    origem='VIVO MÓVEL',
    ativo=true
from public.planos_catalogo pc
join entrada e on e.nome=pc.nome
where po.plano_id=pc.id
  and pc.operadora='VIVO'
  and po.origem='VIVO MÓVEL';

with entrada(nome, valor_mes, bonus_extra) as (
  values
    ('6GB',   39.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('15GB',  54.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('20GB',  59.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('30GB',  69.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('40GB',  79.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('50GB',  89.99::numeric, 'BÔNUS +10GB POR LINHA'),
    ('100GB', 99.99::numeric, 'BÔNUS +10GB POR LINHA')
)
insert into public.plano_ofertas_catalogo(
  plano_id, bonus_extra, valor_mes, origem, pagina_fonte, ativo
)
select pc.id,e.bonus_extra,e.valor_mes,'VIVO MÓVEL',null,true
from public.planos_catalogo pc
join entrada e on e.nome=pc.nome
where pc.operadora='VIVO'
  and not exists (
    select 1
    from public.plano_ofertas_catalogo po
    where po.plano_id=pc.id
      and po.origem='VIVO MÓVEL'
  );
