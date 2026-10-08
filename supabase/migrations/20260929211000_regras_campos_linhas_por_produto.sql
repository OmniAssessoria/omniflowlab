-- Regras específicas de preenchimento por Produto + Tipo de Pedido.
-- Fixa/Novo: sem número e sem plano.
-- Fixa/Portado: com número, sem plano.
-- Móvel/Novo: sem número; plano continua selecionável.
-- Banda Larga: sem DDD e sem número; plano permanece obrigatório/selecionável.
-- VIVO/Fixa: valor inicial R$ 30,00 quando ainda estiver zerado.

create or replace function public.normalizar_campos_venda_linha()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_produto text := lower(btrim(coalesce(new.produto,'')));
  v_pedido text := lower(btrim(coalesce(new.tipo_produto,'')));
  v_operadora text := upper(btrim(coalesce(new.operadora,'')));
  v_entrou_em_fixa boolean := false;
begin
  if tg_op='INSERT' then
    v_entrou_em_fixa := (v_produto='fixa');
  else
    v_entrou_em_fixa := (
      v_produto='fixa'
      and (
        lower(btrim(coalesce(old.produto,''))) is distinct from v_produto
        or upper(btrim(coalesce(old.operadora,''))) is distinct from v_operadora
      )
    );
  end if;

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

  if v_produto='móvel' and v_pedido='novo' then
    new.numero := null;
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

update public.venda_linhas
set ddd=null,
    numero=null
where lower(btrim(coalesce(produto,'')))='banda larga'
  and (ddd is not null or numero is not null);

update public.venda_linhas
set numero=null,
    plano='Não informado',
    plano_catalogo_id=null,
    plano_oferta_id=null
where lower(btrim(coalesce(produto,'')))='fixa'
  and lower(btrim(coalesce(tipo_produto,'')))='novo';

update public.venda_linhas
set plano='Não informado',
    plano_catalogo_id=null,
    plano_oferta_id=null
where lower(btrim(coalesce(produto,'')))='fixa'
  and lower(btrim(coalesce(tipo_produto,'')))='portado';

update public.venda_linhas
set numero=null
where lower(btrim(coalesce(produto,'')))='móvel'
  and lower(btrim(coalesce(tipo_produto,'')))='novo';

update public.venda_linhas
set valor_mensal=30.00
where upper(btrim(coalesce(operadora,'')))='VIVO'
  and lower(btrim(coalesce(produto,'')))='fixa'
  and coalesce(valor_mensal,0)=0;
