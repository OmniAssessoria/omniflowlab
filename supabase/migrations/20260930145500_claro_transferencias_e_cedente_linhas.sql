-- Regras de Transferência CLARO + saneamento de Cedente/Passaporte por linha.
-- PF/PJ: sem Passaporte, Operadora Doadora e Cedente da linha.
-- PJ/PJ: mesmas restrições + Plano e Valor principal bloqueados.

create or replace function public.aplicar_regras_transferencia_claro_linha()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tipo text := lower(btrim(coalesce(new.tipo_produto, '')));
  v_claro boolean := upper(btrim(coalesce(new.operadora, ''))) = 'CLARO';
  v_transferencia boolean;
  v_pj_pj boolean;
begin
  v_transferencia := v_tipo in (
    lower('Transferência de Titularidade PF/PJ Pós'),
    lower('Transferência de Titularidade PF/PJ Pos'),
    lower('Transferência de Titularidade PF/PJ Pré'),
    lower('Transferência de Titularidade PF/PJ Pre'),
    lower('Transferência de Titularidade PJ/PJ')
  );
  v_pj_pj := v_tipo = lower('Transferência de Titularidade PJ/PJ');

  if v_claro and v_transferencia then
    new.operadora_doadora := null;
    new.passaporte_produto_id := null;
    new.passaporte_plano_oferta_id := null;
    new.passaporte_plano := null;
    new.passaporte_valor := null;

    if v_pj_pj then
      new.plano := 'Não informado';
      new.plano_catalogo_id := null;
      new.plano_oferta_id := null;
      new.valor_mensal := 0;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_aplicar_regras_transferencia_claro_linha on public.venda_linhas;
create trigger trg_aplicar_regras_transferencia_claro_linha
before insert or update of operadora, tipo_produto, operadora_doadora,
  passaporte_produto_id, passaporte_plano_oferta_id, passaporte_plano, passaporte_valor,
  plano, plano_catalogo_id, plano_oferta_id, valor_mensal
on public.venda_linhas
for each row execute function public.aplicar_regras_transferencia_claro_linha();

create or replace function public.bloquear_cedente_transferencia_claro()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_operadora text;
  v_tipo text;
begin
  select upper(btrim(coalesce(vl.operadora,''))),
         lower(btrim(coalesce(vl.tipo_produto,'')))
    into v_operadora, v_tipo
  from public.venda_linhas vl
  where vl.id = new.linha_id;

  if v_operadora = 'CLARO'
     and v_tipo in (
       lower('Transferência de Titularidade PF/PJ Pós'),
       lower('Transferência de Titularidade PF/PJ Pos'),
       lower('Transferência de Titularidade PF/PJ Pré'),
       lower('Transferência de Titularidade PF/PJ Pre'),
       lower('Transferência de Titularidade PJ/PJ')
     ) then
    raise exception 'Transferências CLARO não utilizam Cedente na linha.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_bloquear_cedente_transferencia_claro on public.venda_linha_doadores;
create trigger trg_bloquear_cedente_transferencia_claro
before insert or update of linha_id, cedente_id
on public.venda_linha_doadores
for each row execute function public.bloquear_cedente_transferencia_claro();

create or replace function public.forcar_sem_doador_transferencia_claro_catalogo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tipo text := lower(btrim(coalesce(new.nome,'')));
begin
  if upper(btrim(coalesce(new.operadora,''))) = 'CLARO'
     and v_tipo in (
       lower('Transferência de Titularidade PF/PJ Pós'),
       lower('Transferência de Titularidade PF/PJ Pos'),
       lower('Transferência de Titularidade PF/PJ Pré'),
       lower('Transferência de Titularidade PF/PJ Pre'),
       lower('Transferência de Titularidade PJ/PJ')
     ) then
    new.permite_doador := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_forcar_sem_doador_transferencia_claro_catalogo on public.tipos_pedido_catalogo;
create trigger trg_forcar_sem_doador_transferencia_claro_catalogo
before insert or update of nome, operadora, permite_doador
on public.tipos_pedido_catalogo
for each row execute function public.forcar_sem_doador_transferencia_claro_catalogo();

update public.tipos_pedido_catalogo
set permite_doador = false
where upper(btrim(operadora)) = 'CLARO'
  and lower(btrim(nome)) in (
    lower('Transferência de Titularidade PF/PJ Pós'),
    lower('Transferência de Titularidade PF/PJ Pos'),
    lower('Transferência de Titularidade PF/PJ Pré'),
    lower('Transferência de Titularidade PF/PJ Pre'),
    lower('Transferência de Titularidade PJ/PJ')
  );

delete from public.venda_linha_doadores vld
using public.venda_linhas vl
where vl.id = vld.linha_id
  and upper(btrim(coalesce(vl.operadora,''))) = 'CLARO'
  and lower(btrim(coalesce(vl.tipo_produto,''))) in (
    lower('Transferência de Titularidade PF/PJ Pós'),
    lower('Transferência de Titularidade PF/PJ Pos'),
    lower('Transferência de Titularidade PF/PJ Pré'),
    lower('Transferência de Titularidade PF/PJ Pre'),
    lower('Transferência de Titularidade PJ/PJ')
  );

update public.venda_linhas
set operadora_doadora = null,
    passaporte_produto_id = null,
    passaporte_plano_oferta_id = null,
    passaporte_plano = null,
    passaporte_valor = null,
    updated_at = now()
where upper(btrim(coalesce(operadora,''))) = 'CLARO'
  and lower(btrim(coalesce(tipo_produto,''))) in (
    lower('Transferência de Titularidade PF/PJ Pós'),
    lower('Transferência de Titularidade PF/PJ Pos'),
    lower('Transferência de Titularidade PF/PJ Pré'),
    lower('Transferência de Titularidade PF/PJ Pre'),
    lower('Transferência de Titularidade PJ/PJ')
  );

update public.venda_linhas
set plano = 'Não informado',
    plano_catalogo_id = null,
    plano_oferta_id = null,
    valor_mensal = 0,
    updated_at = now()
where upper(btrim(coalesce(operadora,''))) = 'CLARO'
  and lower(btrim(coalesce(tipo_produto,''))) = lower('Transferência de Titularidade PJ/PJ');
