CREATE OR REPLACE FUNCTION public.normalizar_campos_venda_linha()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
         'transferencia de titularidade pf/pj pre'
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
$function$
