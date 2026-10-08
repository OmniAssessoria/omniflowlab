-- Catálogo VIVO: novos produtos e Tipos de Pedido com grupos de compatibilidade.
-- Regras PF: Migração Pré, Migração Pós e Portabilidade PF/PJ usam Cedente com CPF.

with novos(nome, grupo) as (
  values
    ('LINK DEDICADO','G1'),
    ('PACOTE ADICIONAL','G1'),
    ('VIVO TRAVEL AMÉRICAS','G1'),
    ('VIVO TRAVEL EUROPA','G1'),
    ('VIVO TRAVEL MUNDO','G1'),
    ('ALUGUEL DE EQUIPAMENTOS','G1'),
    ('SIGA-ME','G1'),
    ('MICROSOFT 365','G2'),
    ('VVN','G2'),
    ('LDI','G2'),
    ('SIP','G2'),
    ('PABX','G2'),
    ('IP FIXO','G2')
)
update public.produtos_catalogo p
set ativo=true,
    grupo_compatibilidade=n.grupo
from novos n
where p.operadora='VIVO'
  and lower(btrim(p.nome))=lower(btrim(n.nome));

with novos(nome, grupo) as (
  values
    ('LINK DEDICADO','G1'),
    ('PACOTE ADICIONAL','G1'),
    ('VIVO TRAVEL AMÉRICAS','G1'),
    ('VIVO TRAVEL EUROPA','G1'),
    ('VIVO TRAVEL MUNDO','G1'),
    ('ALUGUEL DE EQUIPAMENTOS','G1'),
    ('SIGA-ME','G1'),
    ('MICROSOFT 365','G2'),
    ('VVN','G2'),
    ('LDI','G2'),
    ('SIP','G2'),
    ('PABX','G2'),
    ('IP FIXO','G2')
)
insert into public.produtos_catalogo(nome,operadora,ativo,grupo_compatibilidade)
select n.nome,'VIVO',true,n.grupo
from novos n
where not exists (
  select 1
  from public.produtos_catalogo p
  where p.operadora='VIVO'
    and lower(btrim(p.nome))=lower(btrim(n.nome))
);

update public.tipos_pedido_catalogo
set grupo_compatibilidade='G1'
where operadora='VIVO'
  and grupo_compatibilidade is null
  and created_at >= timestamptz '2026-09-29 00:00:00-03';

update public.tipos_pedido_catalogo
set nome='Migração Pré',
    ativo=true,
    permite_doador=true,
    grupo_compatibilidade='G1'
where operadora='VIVO'
  and lower(btrim(nome)) in (lower('Migração Pre'), lower('Migração Pré'));

update public.tipos_pedido_catalogo
set ativo=true,
    permite_doador=true,
    grupo_compatibilidade='G1'
where operadora='VIVO'
  and lower(btrim(nome))=lower('Migração Pós');

update public.tipos_pedido_catalogo
set ativo=true,
    permite_doador=false,
    grupo_compatibilidade='G1'
where operadora='VIVO'
  and lower(btrim(nome))=lower('SVA');

update public.tipos_pedido_catalogo
set ativo=true,
    permite_bonus=false,
    permite_doador=true,
    grupo_compatibilidade='G1'
where operadora='VIVO'
  and lower(btrim(nome))=lower('Portabilidade PF/PJ');

insert into public.tipos_pedido_catalogo(
  nome,operadora,ativo,permite_bonus,permite_doador,grupo_compatibilidade
)
select 'Portabilidade PF/PJ','VIVO',true,false,true,'G1'
where not exists (
  select 1
  from public.tipos_pedido_catalogo
  where operadora='VIVO'
    and lower(btrim(nome))=lower('Portabilidade PF/PJ')
);

create or replace function public.validar_cedente_da_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_venda_id uuid;
  v_tipo_pedido text;
  v_documento text;
begin
  select venda_id, tipo_produto
    into v_venda_id, v_tipo_pedido
  from public.venda_linhas
  where id = new.linha_id;

  if v_venda_id is null then
    raise exception 'Linha não encontrada para vínculo de Cedente';
  end if;

  if not exists (
    select 1
    from public.venda_cedentes vc
    where vc.venda_id = v_venda_id
      and vc.cedente_id = new.cedente_id
  ) then
    raise exception 'Cedente não pertence aos Cedentes disponíveis deste pedido';
  end if;

  select regexp_replace(coalesce(c.cnpj_cpf,''), '[^0-9]', '', 'g')
    into v_documento
  from public.cedentes c
  where c.id = new.cedente_id;

  if upper(
       translate(
         btrim(coalesce(v_tipo_pedido,'')),
         'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç',
         'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'
       )
     ) in ('MIGRACAO PRE','MIGRACAO POS','PORTABILIDADE PF/PJ')
     and length(v_documento) <> 11 then
    raise exception 'Este Tipo de Pedido exige Cedente Pessoa Física com CPF de 11 dígitos';
  end if;

  return new;
end;
$function$;
