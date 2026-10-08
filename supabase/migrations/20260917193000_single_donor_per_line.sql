do $$
begin
  if exists (
    select 1
    from public.venda_linha_doadores
    group by linha_id
    having count(*) > 1
  ) then
    raise exception 'Existem linhas com mais de um doador; resolva duplicidades antes de aplicar a regra.';
  end if;
end;
$$;

create unique index if not exists uq_venda_linha_doadores_linha_id
  on public.venda_linha_doadores(linha_id);
