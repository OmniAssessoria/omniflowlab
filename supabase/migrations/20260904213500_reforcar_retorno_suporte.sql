-- Reforco da regra de retorno do Suporte.
-- Corrige comparacoes com enum/texto, evita duplicidade de retorno aberto
-- e faz o update de funil funcionar mesmo quando public.vendas.funil for enum.

create or replace function public.omni_usuario_eh_bko(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role::text = 'bko'
  );
$$;

create or replace function public.omni_registrar_retorno_suporte_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_nome text;
begin
  if new.funil::text = 'suporte'
     and old.funil::text is distinct from 'suporte'
     and old.funil is not null
     and old.etapa_id is not null
     and not exists (
       select 1
       from public.venda_suporte_retorno vsr
       where vsr.venda_id = old.id
         and vsr.status = 'aberto'
     ) then

    insert into public.venda_suporte_retorno (
      venda_id,
      origem_funil,
      origem_etapa_id,
      suporte_etapa_id,
      created_by
    ) values (
      old.id,
      old.funil::text,
      old.etapa_id,
      new.etapa_id,
      v_user_id
    );

    v_user_nome := public.omni_usuario_nome(v_user_id);

    insert into public.venda_historico (
      venda_id,
      tipo,
      descricao,
      user_id,
      user_nome
    ) values (
      old.id,
      'funil',
      'SUPORTE_RETORNO:' || jsonb_build_object(
        'origem_funil', old.funil::text,
        'origem_etapa_id', old.etapa_id,
        'suporte_etapa_id', new.etapa_id,
        'registrado_em', now()
      )::text,
      v_user_id,
      v_user_nome
    );
  end if;

  return new;
end;
$$;

create or replace function public.omni_restaurar_venda_apos_chamado_resolvido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_retorno public.venda_suporte_retorno%rowtype;
  v_user_id uuid := auth.uid();
  v_user_nome text;
  v_funil_data_type text;
  v_funil_udt_schema text;
  v_funil_udt_name text;
  v_rows integer := 0;
begin
  if new.status::text <> 'resolvido'
     or old.status::text is not distinct from new.status::text
     or new.venda_id is null then
    return new;
  end if;

  select *
    into v_retorno
    from public.venda_suporte_retorno vsr
   where vsr.venda_id = new.venda_id
     and vsr.status = 'aberto'
     and (vsr.ticket_id = new.id or vsr.ticket_id is null)
   order by (vsr.ticket_id = new.id) desc, vsr.aberto_em desc
   limit 1;

  v_user_nome := public.omni_usuario_nome(v_user_id);

  if found then
    select c.data_type, c.udt_schema, c.udt_name
      into v_funil_data_type, v_funil_udt_schema, v_funil_udt_name
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = 'vendas'
       and c.column_name = 'funil'
     limit 1;

    if v_funil_data_type = 'USER-DEFINED' then
      execute format(
        'update public.vendas
            set funil = $1::%I.%I,
                etapa_id = $2,
                dias_na_etapa = 0,
                updated_at = now()
          where id = $3
            and funil::text = ''suporte''',
        v_funil_udt_schema,
        v_funil_udt_name
      ) using v_retorno.origem_funil, v_retorno.origem_etapa_id, new.venda_id;
    else
      update public.vendas
         set funil = v_retorno.origem_funil,
             etapa_id = v_retorno.origem_etapa_id,
             dias_na_etapa = 0,
             updated_at = now()
       where id = new.venda_id
         and funil::text = 'suporte';
    end if;

    get diagnostics v_rows = row_count;

    update public.venda_suporte_retorno
       set status = 'resolvido',
           resolvido_em = now(),
           resolved_by = v_user_id,
           ticket_id = coalesce(ticket_id, new.id)
     where id = v_retorno.id;

    insert into public.venda_historico (
      venda_id,
      tipo,
      descricao,
      user_id,
      user_nome
    ) values (
      new.venda_id,
      'funil',
      case
        when v_rows > 0 then
          'Chamado ' || coalesce(new.numero, '') || ' resolvido por BKO. Venda retornada automaticamente do funil Suporte para ' || v_retorno.origem_funil || ' / ' || v_retorno.origem_etapa_id || '.'
        else
          'Chamado ' || coalesce(new.numero, '') || ' resolvido por BKO. Havia ponto de retorno salvo, mas a venda não estava mais no funil Suporte no momento da resolução.'
      end,
      v_user_id,
      v_user_nome
    );
  end if;

  return new;
end;
$$;

-- Recria os triggers para garantir que apontem para as funcoes reforcadas.
drop trigger if exists trg_omni_registrar_retorno_suporte_venda on public.vendas;
create trigger trg_omni_registrar_retorno_suporte_venda
  before update of funil, etapa_id on public.vendas
  for each row
  execute function public.omni_registrar_retorno_suporte_venda();

drop trigger if exists trg_omni_restaurar_venda_apos_chamado_resolvido on public.tickets;
create trigger trg_omni_restaurar_venda_apos_chamado_resolvido
  after update of status on public.tickets
  for each row
  execute function public.omni_restaurar_venda_apos_chamado_resolvido();
