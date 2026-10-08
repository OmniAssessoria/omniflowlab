create or replace function public.fechar_grupos_notificacao_na_troca_de_ator()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.user_id is null or new.tipo::text = 'criacao' then
    return new;
  end if;

  update public.notificacoes
  set grupo_aberto = false
  where venda_id = new.venda_id
    and grupo_aberto = true
    and actor_user_id is distinct from new.user_id;

  return new;
end;
$function$;

drop trigger if exists trg_fechar_grupos_notificacao_na_troca_de_ator on public.venda_historico;
create trigger trg_fechar_grupos_notificacao_na_troca_de_ator
before insert on public.venda_historico
for each row execute function public.fechar_grupos_notificacao_na_troca_de_ator();
