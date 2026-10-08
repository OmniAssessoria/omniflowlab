-- Regras configuráveis por Tipo de Produto.
-- O catálogo passa a ser a fonte de verdade para permitir novos bônus e doadores.
-- Alterações de configuração não apagam extras já existentes em linhas antigas.

alter table public.tipos_pedido_catalogo
  add column if not exists permite_bonus boolean not null default false,
  add column if not exists permite_doador boolean not null default false;

alter table public.tipos_pedido_catalogo
  drop constraint if exists tipos_pedido_catalogo_bonus_somente_vivo;

alter table public.tipos_pedido_catalogo
  add constraint tipos_pedido_catalogo_bonus_somente_vivo
  check (not permite_bonus or upper(btrim(operadora)) = 'VIVO');

-- Preserva exatamente as regras que já existiam no código antes desta migração.
update public.tipos_pedido_catalogo
set permite_bonus = (
  upper(btrim(operadora)) = 'VIVO'
  and nome in (
    'Portabilidade Cruzada PF/PJ',
    'Portabilidade PJ/PJ',
    'Portado'
  )
);

update public.tipos_pedido_catalogo
set permite_doador = (
  nome in (
    'Portabilidade Cruzada PF/PJ',
    'Transferência de Titularidade PF/PJ Pós',
    'Transferência de Titularidade PF/PJ Pré',
    'Transferência de Titularidade PJ/PJ'
  )
);

create or replace function public.update_tipo_produto_catalogo_regras(
  p_item_id uuid,
  p_novo_nome text,
  p_permite_bonus boolean,
  p_permite_doador boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_operadora text;
  v_nome_anterior text;
  v_novo_nome text := btrim(coalesce(p_novo_nome, ''));
  v_bonus boolean := coalesce(p_permite_bonus, false);
  v_doador boolean := coalesce(p_permite_doador, false);
  v_linhas_atualizadas integer := 0;
begin
  if v_user_id is null then
    raise exception '401: usuário não autenticado.';
  end if;

  if not (
    public.has_role(v_user_id, 'admin'::public.app_role)
    or public.has_role(v_user_id, 'bko'::public.app_role)
  ) then
    raise exception '403: somente Admin ou BKO podem editar Tipo de Produto.';
  end if;

  if length(v_novo_nome) < 1 or length(v_novo_nome) > 160 then
    raise exception 'Informe um nome de Tipo de Produto com até 160 caracteres.';
  end if;

  select operadora, nome
    into v_operadora, v_nome_anterior
  from public.tipos_pedido_catalogo
  where id = p_item_id
  for update;

  if not found then
    raise exception 'Tipo de Produto não encontrado.';
  end if;

  if upper(btrim(v_operadora)) <> 'VIVO' and v_bonus then
    raise exception 'Bônus é exclusivo da VIVO.';
  end if;

  if exists (
    select 1
    from public.tipos_pedido_catalogo
    where operadora = v_operadora
      and ativo = true
      and id <> p_item_id
      and lower(btrim(nome)) = lower(v_novo_nome)
  ) then
    raise exception 'Já existe um Tipo de Produto ativo com esse nome para %.', v_operadora;
  end if;

  update public.tipos_pedido_catalogo
  set nome = v_novo_nome,
      permite_bonus = case when upper(btrim(v_operadora)) = 'VIVO' then v_bonus else false end,
      permite_doador = v_doador
  where id = p_item_id;

  if v_nome_anterior is distinct from v_novo_nome then
    update public.venda_linhas vl
    set tipo_produto = v_novo_nome
    from public.vendas v
    where v.id = vl.venda_id
      and v.operadora::text = v_operadora
      and vl.tipo_produto = v_nome_anterior;

    get diagnostics v_linhas_atualizadas = row_count;
  end if;

  return jsonb_build_object(
    'operadora', v_operadora,
    'nome_anterior', v_nome_anterior,
    'nome_novo', v_novo_nome,
    'permite_bonus', case when upper(btrim(v_operadora)) = 'VIVO' then v_bonus else false end,
    'permite_doador', v_doador,
    'linhas_atualizadas', v_linhas_atualizadas
  );
end;
$$;

revoke all on function public.update_tipo_produto_catalogo_regras(uuid, text, boolean, boolean) from public;
revoke all on function public.update_tipo_produto_catalogo_regras(uuid, text, boolean, boolean) from anon;
grant execute on function public.update_tipo_produto_catalogo_regras(uuid, text, boolean, boolean) to authenticated;

create or replace function public.guard_venda_linha_bonus()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_operadora text;
  v_permite_bonus boolean := false;
  v_bonus_valido boolean := false;
  v_contexto_alterado boolean := false;
  v_bonus_ja_existia boolean := false;
begin
  select v.operadora::text
    into v_operadora
  from public.vendas v
  where v.id = new.venda_id;

  if v_operadora is null then
    raise exception 'Venda da linha não encontrada.';
  end if;

  select coalesce(t.permite_bonus, false)
    into v_permite_bonus
  from public.tipos_pedido_catalogo t
  where t.operadora = v_operadora
    and t.ativo = true
    and lower(btrim(t.nome)) = lower(btrim(coalesce(new.tipo_produto, '')))
  limit 1;

  v_permite_bonus := coalesce(v_permite_bonus, false);
  v_contexto_alterado := (
    tg_op = 'INSERT'
    or (
      tg_op = 'UPDATE'
      and (
        new.venda_id is distinct from old.venda_id
        or new.tipo_produto is distinct from old.tipo_produto
      )
    )
  );
  v_bonus_ja_existia := (
    tg_op = 'UPDATE'
    and old.possui_bonus is true
    and new.venda_id is not distinct from old.venda_id
    and new.tipo_produto is not distinct from old.tipo_produto
  );

  if upper(btrim(v_operadora)) <> 'VIVO' then
    if new.possui_bonus is true then
      raise exception 'Bônus é exclusivo da VIVO.';
    end if;
    new.possui_bonus := null;
    new.bonus_gb := null;
    return new;
  end if;

  -- Trocar a linha para um Tipo de Produto sem bônus remove somente o extra
  -- incompatível daquela linha. Mudar a configuração do catálogo, por si só,
  -- nunca altera linhas já existentes.
  if v_contexto_alterado and not v_permite_bonus then
    new.possui_bonus := null;
    new.bonus_gb := null;
    return new;
  end if;

  if coalesce(new.possui_bonus, false) = false then
    new.bonus_gb := null;
    return new;
  end if;

  -- Se o bônus já existia na mesma linha/tipo, ele pode ser corrigido ou
  -- removido mesmo que a configuração futura tenha sido desligada.
  if not v_permite_bonus and not v_bonus_ja_existia then
    raise exception 'Este Tipo de Produto não permite adicionar bônus.';
  end if;

  -- Valor histórico inalterado continua válido mesmo se a opção de GB saiu
  -- do catálogo. Só uma inclusão nova ou troca de valor precisa estar ativa.
  if tg_op = 'UPDATE'
     and old.possui_bonus is true
     and new.possui_bonus is true
     and new.bonus_gb is not distinct from old.bonus_gb then
    return new;
  end if;

  select exists (
    select 1
    from public.bonus_vivo_catalogo
    where gb = new.bonus_gb
      and ativo = true
  )
  into v_bonus_valido;

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

create or replace function public.guard_venda_linha_doador_rule()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_operadora text;
  v_tipo_produto text;
  v_permite_doador boolean := false;
begin
  -- Editar os dados do mesmo doador histórico continua permitido.
  if tg_op = 'UPDATE' and new.linha_id is not distinct from old.linha_id then
    return new;
  end if;

  select v.operadora::text, vl.tipo_produto
    into v_operadora, v_tipo_produto
  from public.venda_linhas vl
  join public.vendas v on v.id = vl.venda_id
  where vl.id = new.linha_id;

  if v_operadora is null then
    raise exception 'Linha da venda não encontrada.';
  end if;

  select coalesce(t.permite_doador, false)
    into v_permite_doador
  from public.tipos_pedido_catalogo t
  where t.operadora = v_operadora
    and t.ativo = true
    and lower(btrim(t.nome)) = lower(btrim(coalesce(v_tipo_produto, '')))
  limit 1;

  if not coalesce(v_permite_doador, false) then
    raise exception 'Este Tipo de Produto não permite adicionar doador.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_venda_linha_doador_rule on public.venda_linha_doadores;
create trigger trg_guard_venda_linha_doador_rule
before insert or update of linha_id
on public.venda_linha_doadores
for each row execute function public.guard_venda_linha_doador_rule();

create or replace function public.cleanup_venda_linha_extras_after_type_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_operadora text;
  v_permite_doador boolean := false;
  v_doador record;
  v_user_nome text;
begin
  if new.venda_id is not distinct from old.venda_id
     and new.tipo_produto is not distinct from old.tipo_produto then
    return new;
  end if;

  select v.operadora::text
    into v_operadora
  from public.vendas v
  where v.id = new.venda_id;

  select coalesce(t.permite_doador, false)
    into v_permite_doador
  from public.tipos_pedido_catalogo t
  where t.operadora = v_operadora
    and t.ativo = true
    and lower(btrim(t.nome)) = lower(btrim(coalesce(new.tipo_produto, '')))
  limit 1;

  select nome_completo, email, telefone, operadora
    into v_doador
  from public.venda_linha_doadores
  where linha_id = new.id
  limit 1;

  if found and not coalesce(v_permite_doador, false) then
    select nome_completo
      into v_user_nome
    from public.profiles
    where id = auth.uid();

    insert into public.venda_historico(
      venda_id, tipo, campo, valor_anterior, valor_novo,
      descricao, user_id, user_nome
    ) values (
      new.venda_id,
      'campo'::public.historico_tipo_enum,
      'doador_linha',
      concat_ws(' | ', v_doador.nome_completo, v_doador.email, v_doador.telefone, v_doador.operadora),
      null,
      'Doador removido automaticamente porque a linha mudou para o Tipo de Produto “' || coalesce(new.tipo_produto, 'Não informado') || '”, que não permite doador.',
      auth.uid(),
      v_user_nome
    );

    delete from public.venda_linha_doadores
    where linha_id = new.id;
  end if;

  if old.possui_bonus is true
     and new.possui_bonus is not true
     and old.bonus_gb is not null then
    if v_user_nome is null then
      select nome_completo
        into v_user_nome
      from public.profiles
      where id = auth.uid();
    end if;

    insert into public.venda_historico(
      venda_id, tipo, campo, valor_anterior, valor_novo,
      descricao, user_id, user_nome
    ) values (
      new.venda_id,
      'campo'::public.historico_tipo_enum,
      'bonus_linha',
      old.bonus_gb::text || ' GB',
      null,
      'Bônus removido automaticamente porque a linha mudou para o Tipo de Produto “' || coalesce(new.tipo_produto, 'Não informado') || '”, que não permite bônus.',
      auth.uid(),
      v_user_nome
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_cleanup_venda_linha_extras_after_type_change on public.venda_linhas;
create trigger trg_cleanup_venda_linha_extras_after_type_change
after update of venda_id, tipo_produto
on public.venda_linhas
for each row execute function public.cleanup_venda_linha_extras_after_type_change();
