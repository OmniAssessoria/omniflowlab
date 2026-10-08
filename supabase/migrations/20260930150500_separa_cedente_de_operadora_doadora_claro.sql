-- Cedente e Operadora Doadora são conceitos distintos.
-- Transferências CLARO continuam aceitando Cedente por linha, mas não Operadora Doadora.

drop trigger if exists trg_bloquear_cedente_transferencia_claro on public.venda_linha_doadores;
drop function if exists public.bloquear_cedente_transferencia_claro();

drop trigger if exists trg_forcar_sem_doador_transferencia_claro_catalogo on public.tipos_pedido_catalogo;
drop function if exists public.forcar_sem_doador_transferencia_claro_catalogo();

update public.tipos_pedido_catalogo
set permite_doador = true
where upper(btrim(operadora)) = 'CLARO'
  and lower(btrim(nome)) in (
    lower('Transferência de Titularidade PF/PJ Pós'),
    lower('Transferência de Titularidade PF/PJ Pos'),
    lower('Transferência de Titularidade PF/PJ Pré'),
    lower('Transferência de Titularidade PF/PJ Pre'),
    lower('Transferência de Titularidade PJ/PJ')
  );

-- Restaura automaticamente o vínculo quando o pedido possui exatamente um Cedente,
-- que é um caso sem ambiguidade.
insert into public.venda_linha_doadores(linha_id, cedente_id, created_by)
select vl.id,
       (array_agg(vc.cedente_id))[1],
       null
from public.venda_linhas vl
join public.venda_cedentes vc on vc.venda_id = vl.venda_id
left join public.venda_linha_doadores vld on vld.linha_id = vl.id
where vld.id is null
  and upper(btrim(coalesce(vl.operadora,''))) = 'CLARO'
  and lower(btrim(coalesce(vl.tipo_produto,''))) in (
    lower('Transferência de Titularidade PF/PJ Pós'),
    lower('Transferência de Titularidade PF/PJ Pos'),
    lower('Transferência de Titularidade PF/PJ Pré'),
    lower('Transferência de Titularidade PF/PJ Pre'),
    lower('Transferência de Titularidade PJ/PJ')
  )
group by vl.id
having count(vc.cedente_id) = 1
on conflict (linha_id) do nothing;
