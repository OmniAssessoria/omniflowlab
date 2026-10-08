-- Protege os status finalizadores e evita nomes duplicados por operadora,
-- inclusive entre registros temporariamente desativados.

drop index if exists public.uq_status_comercial_nome_operadora_ativo;

create unique index if not exists uq_status_comercial_nome_operadora
  on public.status_comercial_operadoras (operadora, lower(btrim(nome)));

create or replace function public.atualizar_status_comercial(
  p_status_id uuid,
  p_operadora text,
  p_nome text,
  p_sla_horas integer default null,
  p_ativo boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := btrim(regexp_replace(coalesce(p_nome,''), '\s+', ' ', 'g'));
  v_op public.operadora_enum;
  v_is_final boolean;
begin
  if auth.uid() is null then
    raise exception '401: usuário não autenticado.';
  end if;
  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode editar Status Comercial.';
  end if;

  if upper(btrim(coalesce(p_operadora,''))) not in ('CLARO','VIVO') then
    raise exception 'Operadora inválida.';
  end if;
  v_op := upper(btrim(p_operadora))::public.operadora_enum;

  if v_nome = '' then
    raise exception 'Informe o nome do Status Comercial.';
  end if;
  if p_sla_horas is not null and p_sla_horas <= 0 then
    raise exception 'SLA deve ser maior que zero ou vazio para Sem SLA.';
  end if;

  select is_final
  into v_is_final
  from public.status_comercial_operadoras
  where status_id = p_status_id
    and operadora = v_op;

  if not found then
    raise exception 'Status Comercial não encontrado para a operadora %.', v_op;
  end if;

  if v_is_final and not p_ativo then
    raise exception 'Status finalizador não pode ser desativado.';
  end if;

  if exists (
    select 1
    from public.status_comercial_operadoras o
    where o.operadora = v_op
      and o.status_id <> p_status_id
      and lower(btrim(o.nome)) = lower(v_nome)
  ) then
    raise exception 'Já existe um Status Comercial chamado "%" na %.', v_nome, v_op;
  end if;

  update public.status_comercial_operadoras
  set nome = v_nome,
      sla_horas = p_sla_horas,
      ativo = p_ativo,
      updated_at = now()
  where status_id = p_status_id
    and operadora = v_op;
end;
$$;

create or replace function public.excluir_status_comercial(
  p_status_id uuid,
  p_operadora text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_op public.operadora_enum;
  v_is_final boolean;
begin
  if auth.uid() is null then
    raise exception '401: usuário não autenticado.';
  end if;
  if not (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'bko'::public.app_role)
  ) then
    raise exception '403: somente Administrador ou BKO pode excluir Status Comercial.';
  end if;

  if upper(btrim(coalesce(p_operadora,''))) not in ('CLARO','VIVO') then
    raise exception 'Operadora inválida.';
  end if;
  v_op := upper(btrim(p_operadora))::public.operadora_enum;

  select is_final
  into v_is_final
  from public.status_comercial_operadoras
  where status_id = p_status_id
    and operadora = v_op;

  if not found then
    raise exception 'Status Comercial não encontrado para a operadora %.', v_op;
  end if;

  if v_is_final then
    raise exception 'Status finalizador não pode ser excluído.';
  end if;

  delete from public.status_comercial_operadoras
  where status_id = p_status_id
    and operadora = v_op;

  if not exists (
    select 1
    from public.status_comercial_operadoras
    where status_id = p_status_id
  ) then
    update public.status_comercial_catalogo
    set ativo = false
    where id = p_status_id;
  end if;
end;
$$;

revoke all on function public.atualizar_status_comercial(uuid,text,text,integer,boolean) from public;
revoke all on function public.excluir_status_comercial(uuid,text) from public;
grant execute on function public.atualizar_status_comercial(uuid,text,text,integer,boolean) to authenticated;
grant execute on function public.excluir_status_comercial(uuid,text) to authenticated;
