-- Produtos "Aparelho" (G1) para VIVO e CLARO e planos de Banda Larga.

with operadoras(operadora) as (
  values ('VIVO'),('CLARO')
)
update public.produtos_catalogo p
set ativo=true,
    grupo_compatibilidade='G1'
from operadoras o
where p.operadora=o.operadora
  and lower(btrim(p.nome))=lower('Aparelho');

with operadoras(operadora) as (
  values ('VIVO'),('CLARO')
)
insert into public.produtos_catalogo(nome,operadora,ativo,grupo_compatibilidade)
select 'Aparelho',o.operadora,true,'G1'
from operadoras o
where not exists (
  select 1
  from public.produtos_catalogo p
  where p.operadora=o.operadora
    and lower(btrim(p.nome))=lower('Aparelho')
);

-- VIVO Banda Larga
with produto as (
  select id from public.produtos_catalogo
  where operadora='VIVO' and nome='Banda Larga' and ativo=true
  limit 1
),
entrada(nome,valor_mes) as (
  values
    ('400 MEGA',79.99::numeric),
    ('500 MEGA',89.99::numeric),
    ('600 MEGA',94.99::numeric),
    ('1 GIGA',299.99::numeric),
    ('2 GIGAS',399.99::numeric),
    ('10 GIGAS',1999.99::numeric)
)
update public.planos_catalogo pc
set valor_mes=e.valor_mes,
    bonus_extra=null,
    origem='VIVO BANDA LARGA',
    ativo=true
from entrada e, produto p
where pc.operadora='VIVO'
  and pc.produto_id=p.id
  and lower(btrim(pc.nome))=lower(btrim(e.nome));

with produto as (
  select id from public.produtos_catalogo
  where operadora='VIVO' and nome='Banda Larga' and ativo=true
  limit 1
),
entrada(nome,valor_mes) as (
  values
    ('400 MEGA',79.99::numeric),
    ('500 MEGA',89.99::numeric),
    ('600 MEGA',94.99::numeric),
    ('1 GIGA',299.99::numeric),
    ('2 GIGAS',399.99::numeric),
    ('10 GIGAS',1999.99::numeric)
)
insert into public.planos_catalogo(nome,operadora,ativo,produto_id,bonus_extra,valor_mes,origem,pagina_fonte)
select e.nome,'VIVO',true,p.id,null,e.valor_mes,'VIVO BANDA LARGA',null
from entrada e cross join produto p
where not exists (
  select 1 from public.planos_catalogo pc
  where pc.operadora='VIVO'
    and pc.produto_id=p.id
    and lower(btrim(pc.nome))=lower(btrim(e.nome))
);

with entrada(nome,valor_mes) as (
  values
    ('400 MEGA',79.99::numeric),
    ('500 MEGA',89.99::numeric),
    ('600 MEGA',94.99::numeric),
    ('1 GIGA',299.99::numeric),
    ('2 GIGAS',399.99::numeric),
    ('10 GIGAS',1999.99::numeric)
)
update public.plano_ofertas_catalogo po
set valor_mes=e.valor_mes,
    bonus_extra=null,
    origem='VIVO BANDA LARGA',
    ativo=true
from public.planos_catalogo pc
join entrada e on lower(btrim(e.nome))=lower(btrim(pc.nome))
where po.plano_id=pc.id
  and pc.operadora='VIVO'
  and po.origem='VIVO BANDA LARGA';

with entrada(nome,valor_mes) as (
  values
    ('400 MEGA',79.99::numeric),
    ('500 MEGA',89.99::numeric),
    ('600 MEGA',94.99::numeric),
    ('1 GIGA',299.99::numeric),
    ('2 GIGAS',399.99::numeric),
    ('10 GIGAS',1999.99::numeric)
)
insert into public.plano_ofertas_catalogo(plano_id,bonus_extra,valor_mes,origem,pagina_fonte,ativo)
select pc.id,null,e.valor_mes,'VIVO BANDA LARGA',null,true
from public.planos_catalogo pc
join entrada e on lower(btrim(e.nome))=lower(btrim(pc.nome))
join public.produtos_catalogo p on p.id=pc.produto_id
where pc.operadora='VIVO'
  and p.nome='Banda Larga'
  and not exists (
    select 1 from public.plano_ofertas_catalogo po
    where po.plano_id=pc.id
      and po.origem='VIVO BANDA LARGA'
  );

-- CLARO Banda Larga
-- 600 Mega: valor recorrente R$ 99,90; promoção de R$ 29,90 por 3 meses registrada na origem.
with produto as (
  select id from public.produtos_catalogo
  where operadora='CLARO' and nome='Banda Larga' and ativo=true
  limit 1
),
entrada(nome,valor_mes,origem) as (
  values
    ('400 Mega',79.90::numeric,'CLARO BANDA LARGA'),
    ('600 Mega',99.90::numeric,'CLARO BANDA LARGA · PROMOÇÃO R$ 29,90/mês nos 3 primeiros meses'),
    ('800 Mega',109.90::numeric,'CLARO BANDA LARGA'),
    ('1 Giga',199.90::numeric,'CLARO BANDA LARGA')
)
update public.planos_catalogo pc
set valor_mes=e.valor_mes,
    bonus_extra=null,
    origem=e.origem,
    ativo=true
from entrada e, produto p
where pc.operadora='CLARO'
  and pc.produto_id=p.id
  and lower(btrim(pc.nome))=lower(btrim(e.nome));

with produto as (
  select id from public.produtos_catalogo
  where operadora='CLARO' and nome='Banda Larga' and ativo=true
  limit 1
),
entrada(nome,valor_mes,origem) as (
  values
    ('400 Mega',79.90::numeric,'CLARO BANDA LARGA'),
    ('600 Mega',99.90::numeric,'CLARO BANDA LARGA · PROMOÇÃO R$ 29,90/mês nos 3 primeiros meses'),
    ('800 Mega',109.90::numeric,'CLARO BANDA LARGA'),
    ('1 Giga',199.90::numeric,'CLARO BANDA LARGA')
)
insert into public.planos_catalogo(nome,operadora,ativo,produto_id,bonus_extra,valor_mes,origem,pagina_fonte)
select e.nome,'CLARO',true,p.id,null,e.valor_mes,e.origem,null
from entrada e cross join produto p
where not exists (
  select 1 from public.planos_catalogo pc
  where pc.operadora='CLARO'
    and pc.produto_id=p.id
    and lower(btrim(pc.nome))=lower(btrim(e.nome))
);

with entrada(nome,valor_mes,origem) as (
  values
    ('400 Mega',79.90::numeric,'CLARO BANDA LARGA'),
    ('600 Mega',99.90::numeric,'CLARO BANDA LARGA · PROMOÇÃO R$ 29,90/mês nos 3 primeiros meses'),
    ('800 Mega',109.90::numeric,'CLARO BANDA LARGA'),
    ('1 Giga',199.90::numeric,'CLARO BANDA LARGA')
)
update public.plano_ofertas_catalogo po
set valor_mes=e.valor_mes,
    bonus_extra=null,
    origem=e.origem,
    ativo=true
from public.planos_catalogo pc
join entrada e on lower(btrim(e.nome))=lower(btrim(pc.nome))
where po.plano_id=pc.id
  and pc.operadora='CLARO'
  and po.origem like 'CLARO BANDA LARGA%';

with entrada(nome,valor_mes,origem) as (
  values
    ('400 Mega',79.90::numeric,'CLARO BANDA LARGA'),
    ('600 Mega',99.90::numeric,'CLARO BANDA LARGA · PROMOÇÃO R$ 29,90/mês nos 3 primeiros meses'),
    ('800 Mega',109.90::numeric,'CLARO BANDA LARGA'),
    ('1 Giga',199.90::numeric,'CLARO BANDA LARGA')
)
insert into public.plano_ofertas_catalogo(plano_id,bonus_extra,valor_mes,origem,pagina_fonte,ativo)
select pc.id,null,e.valor_mes,e.origem,null,true
from public.planos_catalogo pc
join entrada e on lower(btrim(e.nome))=lower(btrim(pc.nome))
join public.produtos_catalogo p on p.id=pc.produto_id
where pc.operadora='CLARO'
  and p.nome='Banda Larga'
  and not exists (
    select 1 from public.plano_ofertas_catalogo po
    where po.plano_id=pc.id
      and po.origem like 'CLARO BANDA LARGA%'
  );
