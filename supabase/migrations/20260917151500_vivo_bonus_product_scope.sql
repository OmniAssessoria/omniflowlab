-- Restringe bônus VIVO aos tipos de produto corretos por linha.
-- Ao sair de um tipo elegível, remove automaticamente o bônus antigo.

create or replace function public.guard_venda_linha_bonus()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_operadora public.operadora_enum;
  v_bonus_valido boolean := false;
begin
  select operadora into v_operadora
  from public.vendas
  where id = new.venda_id;

  if v_operadora is null then
    raise exception 'Venda da linha não encontrada.';
  end if;

  if v_operadora <> 'VIVO'::public.operadora_enum
     or coalesce(trim(new.tipo_produto), '') not in (
       'Portabilidade Cruzada PF/PJ',
       'Portabilidade PJ/PJ',
       'Portado'
     ) then
    new.possui_bonus := null;
    new.bonus_gb := null;
    return new;
  end if;

  if coalesce(new.possui_bonus, false) = false then
    new.bonus_gb := null;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.venda_id is not distinct from old.venda_id
     and new.tipo_produto is not distinct from old.tipo_produto
     and new.possui_bonus is not distinct from old.possui_bonus
     and new.bonus_gb is not distinct from old.bonus_gb then
    return new;
  end if;

  if to_regclass('public.bonus_vivo_catalogo') is not null then
    execute 'select exists (
      select 1 from public.bonus_vivo_catalogo
      where gb = $1 and ativo = true
    )'
    into v_bonus_valido
    using new.bonus_gb;
  else
    v_bonus_valido := new.bonus_gb in (10, 20);
  end if;

  if new.bonus_gb is null or not v_bonus_valido then
    raise exception 'Selecione uma opção ativa do catálogo de bônus VIVO.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_venda_linha_bonus on public.venda_linhas;
create trigger trg_guard_venda_linha_bonus
before insert or update of possui_bonus, bonus_gb, venda_id, tipo_produto
on public.venda_linhas
for each row execute function public.guard_venda_linha_bonus();

update public.venda_linhas vl
set possui_bonus = null,
    bonus_gb = null
from public.vendas v
where v.id = vl.venda_id
  and (vl.possui_bonus is not null or vl.bonus_gb is not null)
  and (
    v.operadora <> 'VIVO'::public.operadora_enum
    or coalesce(trim(vl.tipo_produto), '') not in (
      'Portabilidade Cruzada PF/PJ',
      'Portabilidade PJ/PJ',
      'Portado'
    )
  );
