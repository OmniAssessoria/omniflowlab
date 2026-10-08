-- Ao trocar a empresa de um pedido, vínculos de Cedente/Cessionário pertencentes
-- à empresa anterior não podem permanecer associados às linhas ou ao pedido.
-- Os cadastros das partes não são apagados; apenas os vínculos desta venda são limpos.

create or replace function public.limpar_partes_ao_trocar_empresa_pedido()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_nome text;
begin
  if new.cliente_id is not distinct from old.cliente_id then
    return new;
  end if;

  delete from public.venda_linha_doadores vld
  using public.venda_linhas vl
  where vl.id = vld.linha_id
    and vl.venda_id = new.id;

  delete from public.venda_linha_cessionarios vlc
  using public.venda_linhas vl
  where vl.id = vlc.linha_id
    and vl.venda_id = new.id;

  delete from public.venda_cedentes
  where venda_id = new.id;

  delete from public.venda_cessionarios
  where venda_id = new.id;

  select coalesce(nullif(btrim(p.nome_completo), ''), nullif(btrim(p.email), ''), 'Usuário')
    into v_user_nome
  from public.profiles p
  where p.id = auth.uid();

  insert into public.venda_historico(
    venda_id,
    tipo,
    campo,
    valor_anterior,
    valor_novo,
    descricao,
    user_id,
    user_nome
  ) values (
    new.id,
    'campo'::public.historico_tipo_enum,
    'cliente_id',
    old.cliente_id::text,
    new.cliente_id::text,
    'Empresa do pedido alterada. Vínculos de Cedente/Cessionário da empresa anterior foram removidos das linhas e do pedido.',
    auth.uid(),
    v_user_nome
  );

  return new;
end;
$function$;

drop trigger if exists trg_limpar_partes_ao_trocar_empresa_pedido
  on public.vendas;

create trigger trg_limpar_partes_ao_trocar_empresa_pedido
after update of cliente_id
on public.vendas
for each row
when (old.cliente_id is distinct from new.cliente_id)
execute function public.limpar_partes_ao_trocar_empresa_pedido();
