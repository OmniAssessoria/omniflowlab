create or replace function public.sincronizar_cliente_por_representante()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_next public.cliente_representantes%rowtype;
begin
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    select *
    into v_next
    from public.cliente_representantes
    where cliente_id = old.cliente_id
    order by ordem, created_at, id
    limit 1;

    if not found then
      raise exception 'A empresa precisa manter pelo menos um representante.';
    end if;

    if old.principal then
      update public.cliente_representantes
      set principal = true
      where id = v_next.id;

      update public.clientes
      set
        contato = v_next.nome,
        ddd = v_next.ddd,
        telefone = v_next.telefone,
        email = v_next.email
      where id = old.cliente_id;
    end if;

    if old.negociante then
      update public.cliente_representantes
      set negociante = true
      where id = v_next.id;
    end if;

    if old.assinante then
      update public.cliente_representantes
      set assinante = true
      where id = v_next.id;
    end if;

    return old;
  end if;

  if new.principal then
    update public.clientes
    set
      contato = new.nome,
      ddd = new.ddd,
      telefone = new.telefone,
      email = new.email
    where id = new.cliente_id
      and (
        contato is distinct from new.nome
        or ddd is distinct from new.ddd
        or telefone is distinct from new.telefone
        or email is distinct from new.email
      );
  end if;

  return new;
end;
$function$;
