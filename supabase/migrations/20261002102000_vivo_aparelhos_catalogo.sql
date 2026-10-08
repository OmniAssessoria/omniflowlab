-- Catálogo de aparelhos VIVO informado pelo usuário em 2026-10-02.
-- O arquivo original contém linhas repetidas; o catálogo usa um item por modelo exato (71 modelos).
-- Como os preços não foram fornecidos, usa R$ 1,00 como valor técnico.
-- Aparelhos continuam fora do valor total da venda pela regra de recálculo existente.

with produto as (
  select id
  from public.produtos_catalogo
  where operadora = 'VIVO'
    and lower(btrim(nome)) = 'aparelho'
    and ativo = true
  limit 1
),
entrada(nome, tecnologia) as (
  values
    ('iPad (A16) 11"" Wi-Fi + Cellular 128GB','5G'),
    ('iPad (A16) 11"" Wi-Fi + Cellular 256GB','5G'),
    ('iPad Air M4 11Pol WiFi Cellular 128GB','5G'),
    ('iPad Pro M5 11Pol WiFi Cellular 512GB','5G'),
    ('iPad Pro M5 13Pol WiFi Cellular 256GB','5G'),
    ('iPhone 15 256GB','5G'),
    ('iPhone 16 256GB','5G'),
    ('iPhone 16e 256GB','5G'),
    ('iPhone 17 256GB','5G'),
    ('iPhone 17 512GB','5G'),
    ('iPhone 17e 256GB','5G'),
    ('iPhone 17e 512GB','5G'),
    ('iPhone 17 Pro 1TB','5G'),
    ('iPhone 17 Pro 256GB','5G'),
    ('iPhone 17 Pro 512GB','5G'),
    ('iPhone 17 Pro Max 1TB','5G'),
    ('iPhone 17 Pro Max 256GB','5G'),
    ('iPhone 17 Pro Max 2TB','5G'),
    ('iPhone 17 Pro Max 512GB','5G'),
    ('iPhone 18 Pro Max 1TB','5G'),
    ('iPhone 18 Pro Max 256GB','5G'),
    ('iPhone 18 Pro Max 2TB','5G'),
    ('iPhone 18 Pro Max 512GB','5G'),
    ('iPhone 18 Pro 1TB','5G'),
    ('iPhone 18 Pro 256GB','5G'),
    ('iPhone 18 Pro 2TB','5G'),
    ('iPhone 18 Pro 512GB','5G'),
    ('iPhone Air 1TB','5G'),
    ('iPhone Air 256GB','5G'),
    ('iPhone Air 512GB','5G'),
    ('Roteador Huawei FWA 5G','5G'),
    ('JOVI V70 5G 512GB','5G'),
    ('JOVI Y21 5G 256GB','5G'),
    ('Moto G86 5G 256GB','5G'),
    ('Moto G06 128G 4G','4G'),
    ('Motorola Edge 70 Swarovski 5G 512GB','5G'),
    ('Motorola Edge 70 512GB','5G'),
    ('Motorola Signature 512GB','5G'),
    ('Motorola Edge 70 Fusion 12GB 256GB','5G'),
    ('Motorola Moto G67 5G 128GB','5G'),
    ('Motorola Moto G67 5G 256GB','5G'),
    ('Moto G Max 5G 256GB','5G'),
    ('Moto G47 5G 128GB','5G'),
    ('Moto G47 5G 128GB For Business','5G'),
    ('Motorola Razr Fold 1TB','5G'),
    ('Motorola Razr 70 Ultra 512GB','5G'),
    ('Motorola G06 4G For Business 128GB','4G'),
    ('Oppo A5 5G 256GB','5G'),
    ('Oppo A6X 5G 256GB','5G'),
    ('Samsung Galaxy A07 4G 128GB','4G'),
    ('Samsung Galaxy A07 5G 128GB','5G'),
    ('Samsung Galaxy A17 5G 128GB','5G'),
    ('Samsung Galaxy A27 5G 256GB','5G'),
    ('Samsung Galaxy A37 5G 256GB','5G'),
    ('Samsung Galaxy A57 5G 256GB','5G'),
    ('Samsung Galaxy Z Flip 8 256GB','5G'),
    ('Samsung Galaxy Z Flip 8 512GB','5G'),
    ('Samsung Galaxy Z Fold 8 256GB','5G'),
    ('Samsung Galaxy Z Fold 8 512GB','5G'),
    ('Samsung Galaxy Z Fold 8 Ultra 256GB','5G'),
    ('Samsung Galaxy Z Fold 8 Ultra 512GB','5G'),
    ('Samsung Galaxy S26 FE 256GB','5G'),
    ('Samsung Galaxy S26 256GB','5G'),
    ('Samsung Galaxy S26+ 256GB','5G'),
    ('Samsung Galaxy S26 Ultra 256GB','5G'),
    ('Samsung Galaxy Tab A11+ 5G 128GB','5G'),
    ('Samsung Galaxy Tab S10 Lite 5G 128GB','5G'),
    ('Galaxy Watch8 Classic LTE 46mm','4G'),
    ('Galaxy Watch9 LTE 40mm','4G'),
    ('Galaxy Watch9 LTE 44mm','4G'),
    ('Galaxy Watch Ultra 2 LTE 47mm','4G')
)
update public.planos_catalogo pc
set ativo = true,
    produto_id = p.id,
    bonus_extra = e.tecnologia,
    valor_mes = 1.00,
    origem = 'VIVO APARELHOS',
    pagina_fonte = null
from entrada e
cross join produto p
where pc.operadora = 'VIVO'
  and lower(btrim(pc.nome)) = lower(btrim(e.nome));

with produto as (
  select id
  from public.produtos_catalogo
  where operadora = 'VIVO'
    and lower(btrim(nome)) = 'aparelho'
    and ativo = true
  limit 1
),
entrada(nome, tecnologia) as (
  values
    ('iPad (A16) 11"" Wi-Fi + Cellular 128GB','5G'),
    ('iPad (A16) 11"" Wi-Fi + Cellular 256GB','5G'),
    ('iPad Air M4 11Pol WiFi Cellular 128GB','5G'),
    ('iPad Pro M5 11Pol WiFi Cellular 512GB','5G'),
    ('iPad Pro M5 13Pol WiFi Cellular 256GB','5G'),
    ('iPhone 15 256GB','5G'),
    ('iPhone 16 256GB','5G'),
    ('iPhone 16e 256GB','5G'),
    ('iPhone 17 256GB','5G'),
    ('iPhone 17 512GB','5G'),
    ('iPhone 17e 256GB','5G'),
    ('iPhone 17e 512GB','5G'),
    ('iPhone 17 Pro 1TB','5G'),
    ('iPhone 17 Pro 256GB','5G'),
    ('iPhone 17 Pro 512GB','5G'),
    ('iPhone 17 Pro Max 1TB','5G'),
    ('iPhone 17 Pro Max 256GB','5G'),
    ('iPhone 17 Pro Max 2TB','5G'),
    ('iPhone 17 Pro Max 512GB','5G'),
    ('iPhone 18 Pro Max 1TB','5G'),
    ('iPhone 18 Pro Max 256GB','5G'),
    ('iPhone 18 Pro Max 2TB','5G'),
    ('iPhone 18 Pro Max 512GB','5G'),
    ('iPhone 18 Pro 1TB','5G'),
    ('iPhone 18 Pro 256GB','5G'),
    ('iPhone 18 Pro 2TB','5G'),
    ('iPhone 18 Pro 512GB','5G'),
    ('iPhone Air 1TB','5G'),
    ('iPhone Air 256GB','5G'),
    ('iPhone Air 512GB','5G'),
    ('Roteador Huawei FWA 5G','5G'),
    ('JOVI V70 5G 512GB','5G'),
    ('JOVI Y21 5G 256GB','5G'),
    ('Moto G86 5G 256GB','5G'),
    ('Moto G06 128G 4G','4G'),
    ('Motorola Edge 70 Swarovski 5G 512GB','5G'),
    ('Motorola Edge 70 512GB','5G'),
    ('Motorola Signature 512GB','5G'),
    ('Motorola Edge 70 Fusion 12GB 256GB','5G'),
    ('Motorola Moto G67 5G 128GB','5G'),
    ('Motorola Moto G67 5G 256GB','5G'),
    ('Moto G Max 5G 256GB','5G'),
    ('Moto G47 5G 128GB','5G'),
    ('Moto G47 5G 128GB For Business','5G'),
    ('Motorola Razr Fold 1TB','5G'),
    ('Motorola Razr 70 Ultra 512GB','5G'),
    ('Motorola G06 4G For Business 128GB','4G'),
    ('Oppo A5 5G 256GB','5G'),
    ('Oppo A6X 5G 256GB','5G'),
    ('Samsung Galaxy A07 4G 128GB','4G'),
    ('Samsung Galaxy A07 5G 128GB','5G'),
    ('Samsung Galaxy A17 5G 128GB','5G'),
    ('Samsung Galaxy A27 5G 256GB','5G'),
    ('Samsung Galaxy A37 5G 256GB','5G'),
    ('Samsung Galaxy A57 5G 256GB','5G'),
    ('Samsung Galaxy Z Flip 8 256GB','5G'),
    ('Samsung Galaxy Z Flip 8 512GB','5G'),
    ('Samsung Galaxy Z Fold 8 256GB','5G'),
    ('Samsung Galaxy Z Fold 8 512GB','5G'),
    ('Samsung Galaxy Z Fold 8 Ultra 256GB','5G'),
    ('Samsung Galaxy Z Fold 8 Ultra 512GB','5G'),
    ('Samsung Galaxy S26 FE 256GB','5G'),
    ('Samsung Galaxy S26 256GB','5G'),
    ('Samsung Galaxy S26+ 256GB','5G'),
    ('Samsung Galaxy S26 Ultra 256GB','5G'),
    ('Samsung Galaxy Tab A11+ 5G 128GB','5G'),
    ('Samsung Galaxy Tab S10 Lite 5G 128GB','5G'),
    ('Galaxy Watch8 Classic LTE 46mm','4G'),
    ('Galaxy Watch9 LTE 40mm','4G'),
    ('Galaxy Watch9 LTE 44mm','4G'),
    ('Galaxy Watch Ultra 2 LTE 47mm','4G')
)
insert into public.planos_catalogo(
  nome, operadora, ativo, produto_id, bonus_extra, valor_mes, origem, pagina_fonte
)
select e.nome, 'VIVO', true, p.id, e.tecnologia, 1.00, 'VIVO APARELHOS', null
from entrada e
cross join produto p
where not exists (
  select 1
  from public.planos_catalogo pc
  where pc.operadora = 'VIVO'
    and lower(btrim(pc.nome)) = lower(btrim(e.nome))
);

with entrada(nome, tecnologia) as (
  values
    ('iPad (A16) 11"" Wi-Fi + Cellular 128GB','5G'),
    ('iPad (A16) 11"" Wi-Fi + Cellular 256GB','5G'),
    ('iPad Air M4 11Pol WiFi Cellular 128GB','5G'),
    ('iPad Pro M5 11Pol WiFi Cellular 512GB','5G'),
    ('iPad Pro M5 13Pol WiFi Cellular 256GB','5G'),
    ('iPhone 15 256GB','5G'),
    ('iPhone 16 256GB','5G'),
    ('iPhone 16e 256GB','5G'),
    ('iPhone 17 256GB','5G'),
    ('iPhone 17 512GB','5G'),
    ('iPhone 17e 256GB','5G'),
    ('iPhone 17e 512GB','5G'),
    ('iPhone 17 Pro 1TB','5G'),
    ('iPhone 17 Pro 256GB','5G'),
    ('iPhone 17 Pro 512GB','5G'),
    ('iPhone 17 Pro Max 1TB','5G'),
    ('iPhone 17 Pro Max 256GB','5G'),
    ('iPhone 17 Pro Max 2TB','5G'),
    ('iPhone 17 Pro Max 512GB','5G'),
    ('iPhone 18 Pro Max 1TB','5G'),
    ('iPhone 18 Pro Max 256GB','5G'),
    ('iPhone 18 Pro Max 2TB','5G'),
    ('iPhone 18 Pro Max 512GB','5G'),
    ('iPhone 18 Pro 1TB','5G'),
    ('iPhone 18 Pro 256GB','5G'),
    ('iPhone 18 Pro 2TB','5G'),
    ('iPhone 18 Pro 512GB','5G'),
    ('iPhone Air 1TB','5G'),
    ('iPhone Air 256GB','5G'),
    ('iPhone Air 512GB','5G'),
    ('Roteador Huawei FWA 5G','5G'),
    ('JOVI V70 5G 512GB','5G'),
    ('JOVI Y21 5G 256GB','5G'),
    ('Moto G86 5G 256GB','5G'),
    ('Moto G06 128G 4G','4G'),
    ('Motorola Edge 70 Swarovski 5G 512GB','5G'),
    ('Motorola Edge 70 512GB','5G'),
    ('Motorola Signature 512GB','5G'),
    ('Motorola Edge 70 Fusion 12GB 256GB','5G'),
    ('Motorola Moto G67 5G 128GB','5G'),
    ('Motorola Moto G67 5G 256GB','5G'),
    ('Moto G Max 5G 256GB','5G'),
    ('Moto G47 5G 128GB','5G'),
    ('Moto G47 5G 128GB For Business','5G'),
    ('Motorola Razr Fold 1TB','5G'),
    ('Motorola Razr 70 Ultra 512GB','5G'),
    ('Motorola G06 4G For Business 128GB','4G'),
    ('Oppo A5 5G 256GB','5G'),
    ('Oppo A6X 5G 256GB','5G'),
    ('Samsung Galaxy A07 4G 128GB','4G'),
    ('Samsung Galaxy A07 5G 128GB','5G'),
    ('Samsung Galaxy A17 5G 128GB','5G'),
    ('Samsung Galaxy A27 5G 256GB','5G'),
    ('Samsung Galaxy A37 5G 256GB','5G'),
    ('Samsung Galaxy A57 5G 256GB','5G'),
    ('Samsung Galaxy Z Flip 8 256GB','5G'),
    ('Samsung Galaxy Z Flip 8 512GB','5G'),
    ('Samsung Galaxy Z Fold 8 256GB','5G'),
    ('Samsung Galaxy Z Fold 8 512GB','5G'),
    ('Samsung Galaxy Z Fold 8 Ultra 256GB','5G'),
    ('Samsung Galaxy Z Fold 8 Ultra 512GB','5G'),
    ('Samsung Galaxy S26 FE 256GB','5G'),
    ('Samsung Galaxy S26 256GB','5G'),
    ('Samsung Galaxy S26+ 256GB','5G'),
    ('Samsung Galaxy S26 Ultra 256GB','5G'),
    ('Samsung Galaxy Tab A11+ 5G 128GB','5G'),
    ('Samsung Galaxy Tab S10 Lite 5G 128GB','5G'),
    ('Galaxy Watch8 Classic LTE 46mm','4G'),
    ('Galaxy Watch9 LTE 40mm','4G'),
    ('Galaxy Watch9 LTE 44mm','4G'),
    ('Galaxy Watch Ultra 2 LTE 47mm','4G')
)
update public.plano_ofertas_catalogo po
set bonus_extra = e.tecnologia,
    valor_mes = 1.00,
    origem = 'VIVO APARELHOS',
    pagina_fonte = null,
    ativo = true
from public.planos_catalogo pc
join entrada e
  on lower(btrim(e.nome)) = lower(btrim(pc.nome))
where po.plano_id = pc.id
  and pc.operadora = 'VIVO'
  and po.origem = 'VIVO APARELHOS';

with entrada(nome, tecnologia) as (
  values
    ('iPad (A16) 11"" Wi-Fi + Cellular 128GB','5G'),
    ('iPad (A16) 11"" Wi-Fi + Cellular 256GB','5G'),
    ('iPad Air M4 11Pol WiFi Cellular 128GB','5G'),
    ('iPad Pro M5 11Pol WiFi Cellular 512GB','5G'),
    ('iPad Pro M5 13Pol WiFi Cellular 256GB','5G'),
    ('iPhone 15 256GB','5G'),
    ('iPhone 16 256GB','5G'),
    ('iPhone 16e 256GB','5G'),
    ('iPhone 17 256GB','5G'),
    ('iPhone 17 512GB','5G'),
    ('iPhone 17e 256GB','5G'),
    ('iPhone 17e 512GB','5G'),
    ('iPhone 17 Pro 1TB','5G'),
    ('iPhone 17 Pro 256GB','5G'),
    ('iPhone 17 Pro 512GB','5G'),
    ('iPhone 17 Pro Max 1TB','5G'),
    ('iPhone 17 Pro Max 256GB','5G'),
    ('iPhone 17 Pro Max 2TB','5G'),
    ('iPhone 17 Pro Max 512GB','5G'),
    ('iPhone 18 Pro Max 1TB','5G'),
    ('iPhone 18 Pro Max 256GB','5G'),
    ('iPhone 18 Pro Max 2TB','5G'),
    ('iPhone 18 Pro Max 512GB','5G'),
    ('iPhone 18 Pro 1TB','5G'),
    ('iPhone 18 Pro 256GB','5G'),
    ('iPhone 18 Pro 2TB','5G'),
    ('iPhone 18 Pro 512GB','5G'),
    ('iPhone Air 1TB','5G'),
    ('iPhone Air 256GB','5G'),
    ('iPhone Air 512GB','5G'),
    ('Roteador Huawei FWA 5G','5G'),
    ('JOVI V70 5G 512GB','5G'),
    ('JOVI Y21 5G 256GB','5G'),
    ('Moto G86 5G 256GB','5G'),
    ('Moto G06 128G 4G','4G'),
    ('Motorola Edge 70 Swarovski 5G 512GB','5G'),
    ('Motorola Edge 70 512GB','5G'),
    ('Motorola Signature 512GB','5G'),
    ('Motorola Edge 70 Fusion 12GB 256GB','5G'),
    ('Motorola Moto G67 5G 128GB','5G'),
    ('Motorola Moto G67 5G 256GB','5G'),
    ('Moto G Max 5G 256GB','5G'),
    ('Moto G47 5G 128GB','5G'),
    ('Moto G47 5G 128GB For Business','5G'),
    ('Motorola Razr Fold 1TB','5G'),
    ('Motorola Razr 70 Ultra 512GB','5G'),
    ('Motorola G06 4G For Business 128GB','4G'),
    ('Oppo A5 5G 256GB','5G'),
    ('Oppo A6X 5G 256GB','5G'),
    ('Samsung Galaxy A07 4G 128GB','4G'),
    ('Samsung Galaxy A07 5G 128GB','5G'),
    ('Samsung Galaxy A17 5G 128GB','5G'),
    ('Samsung Galaxy A27 5G 256GB','5G'),
    ('Samsung Galaxy A37 5G 256GB','5G'),
    ('Samsung Galaxy A57 5G 256GB','5G'),
    ('Samsung Galaxy Z Flip 8 256GB','5G'),
    ('Samsung Galaxy Z Flip 8 512GB','5G'),
    ('Samsung Galaxy Z Fold 8 256GB','5G'),
    ('Samsung Galaxy Z Fold 8 512GB','5G'),
    ('Samsung Galaxy Z Fold 8 Ultra 256GB','5G'),
    ('Samsung Galaxy Z Fold 8 Ultra 512GB','5G'),
    ('Samsung Galaxy S26 FE 256GB','5G'),
    ('Samsung Galaxy S26 256GB','5G'),
    ('Samsung Galaxy S26+ 256GB','5G'),
    ('Samsung Galaxy S26 Ultra 256GB','5G'),
    ('Samsung Galaxy Tab A11+ 5G 128GB','5G'),
    ('Samsung Galaxy Tab S10 Lite 5G 128GB','5G'),
    ('Galaxy Watch8 Classic LTE 46mm','4G'),
    ('Galaxy Watch9 LTE 40mm','4G'),
    ('Galaxy Watch9 LTE 44mm','4G'),
    ('Galaxy Watch Ultra 2 LTE 47mm','4G')
)
insert into public.plano_ofertas_catalogo(
  plano_id, bonus_extra, valor_mes, origem, pagina_fonte, ativo
)
select pc.id, e.tecnologia, 1.00, 'VIVO APARELHOS', null, true
from public.planos_catalogo pc
join entrada e
  on lower(btrim(e.nome)) = lower(btrim(pc.nome))
join public.produtos_catalogo p
  on p.id = pc.produto_id
where pc.operadora = 'VIVO'
  and p.operadora = 'VIVO'
  and lower(btrim(p.nome)) = 'aparelho'
  and not exists (
    select 1
    from public.plano_ofertas_catalogo po
    where po.plano_id = pc.id
      and po.origem = 'VIVO APARELHOS'
  );
