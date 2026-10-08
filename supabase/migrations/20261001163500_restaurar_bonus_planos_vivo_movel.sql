with alvo as (
  select pc.id
  from public.planos_catalogo pc
  join public.produtos_catalogo pr on pr.id = pc.produto_id
  where pr.operadora = 'VIVO'
    and lower(btrim(pr.nome)) in ('movel', 'móvel')
    and (
      (upper(btrim(pc.nome)) = '6GB' and pc.valor_mes = 39.99)
      or (upper(btrim(pc.nome)) = '15GB' and pc.valor_mes = 54.99)
      or (upper(btrim(pc.nome)) = '20GB' and pc.valor_mes = 59.99)
      or (upper(btrim(pc.nome)) = '30GB' and pc.valor_mes = 69.99)
      or (upper(btrim(pc.nome)) = '40GB' and pc.valor_mes = 79.99)
      or (upper(btrim(pc.nome)) = '50GB' and pc.valor_mes = 89.99)
      or (upper(btrim(pc.nome)) = '100GB' and pc.valor_mes = 99.99)
    )
)
update public.planos_catalogo pc
set bonus_extra = 'BÔNUS +10GB'
where pc.id in (select id from alvo);

with alvo as (
  select pc.id
  from public.planos_catalogo pc
  join public.produtos_catalogo pr on pr.id = pc.produto_id
  where pr.operadora = 'VIVO'
    and lower(btrim(pr.nome)) in ('movel', 'móvel')
    and (
      (upper(btrim(pc.nome)) = '6GB' and pc.valor_mes = 39.99)
      or (upper(btrim(pc.nome)) = '15GB' and pc.valor_mes = 54.99)
      or (upper(btrim(pc.nome)) = '20GB' and pc.valor_mes = 59.99)
      or (upper(btrim(pc.nome)) = '30GB' and pc.valor_mes = 69.99)
      or (upper(btrim(pc.nome)) = '40GB' and pc.valor_mes = 79.99)
      or (upper(btrim(pc.nome)) = '50GB' and pc.valor_mes = 89.99)
      or (upper(btrim(pc.nome)) = '100GB' and pc.valor_mes = 99.99)
    )
)
update public.plano_ofertas_catalogo po
set bonus_extra = 'BÔNUS +10GB'
where po.plano_id in (select id from alvo)
  and po.ativo = true;
