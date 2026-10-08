create or replace function public.log_venda_observacao_alteracao()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_nome text;
  v_venda_id uuid;
  v_tag text;
begin
  if v_user is null then
    return case when tg_op='DELETE' then old else new end;
  end if;

  select nome_completo into v_nome
  from public.profiles
  where id = v_user;

  v_venda_id := case when tg_op='DELETE' then old.venda_id else new.venda_id end;
  v_tag := coalesce(
    case when tg_op='DELETE' then old.tag_nome_snapshot else new.tag_nome_snapshot end,
    'Sem tag'
  );

  if tg_op = 'INSERT' then
    insert into public.venda_historico(
      venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome
    ) values (
      v_venda_id,
      'observacao'::public.historico_tipo_enum,
      'observacao',
      null,
      new.texto,
      'Observação adicionada · ' || v_tag,
      v_user,
      coalesce(v_nome,new.autor_nome)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.texto is distinct from old.texto
       or new.tag_id is distinct from old.tag_id then
      insert into public.venda_historico(
        venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome
      ) values (
        v_venda_id,
        'observacao'::public.historico_tipo_enum,
        'observacao',
        old.texto,
        new.texto,
        case
          when new.texto is distinct from old.texto then 'Observação editada · ' || v_tag
          else 'Tag da observação alterada · ' || v_tag
        end,
        v_user,
        coalesce(v_nome,new.autor_nome)
      );
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.venda_historico(
      venda_id,tipo,campo,valor_anterior,valor_novo,descricao,user_id,user_nome
    ) values (
      v_venda_id,
      'observacao'::public.historico_tipo_enum,
      'observacao',
      old.texto,
      null,
      'Observação removida · ' || v_tag,
      v_user,
      coalesce(v_nome,old.autor_nome)
    );
    return old;
  end if;

  return new;
end;
$function$;
