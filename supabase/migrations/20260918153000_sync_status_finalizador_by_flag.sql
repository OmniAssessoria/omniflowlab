create or replace function public.sync_venda_status_comercial_snapshot()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status_final boolean := false;
begin
  select coalesce(o.is_final, false)
  into v_status_final
  from public.status_comercial_operadoras o
  where o.status_id = new.status_id
    and o.operadora = new.operadora_snapshot
  limit 1;

  update public.vendas
  set status_comercial_id = new.status_id,
      status_comercial_nome = new.status_nome_snapshot,
      status_comercial_em = new.created_at,
      sla_horas_atual = new.sla_horas_snapshot,
      sla_metade_em = new.sla_metade_em,
      sla_limite_em = new.sla_limite_em,
      ativado_100_em = case
        when v_status_final then coalesce(ativado_100_em, new.created_at)
        else ativado_100_em
      end,
      ativado_100_por = case
        when v_status_final then coalesce(ativado_100_por, new.user_id)
        else ativado_100_por
      end
  where id = new.venda_id;

  return new;
end;
$$;

revoke all on function public.sync_venda_status_comercial_snapshot() from public;
