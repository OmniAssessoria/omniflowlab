
DROP POLICY "Sistema insere histórico autenticado" ON public.venda_historico;

CREATE POLICY "Histórico inserido por usuário com acesso à venda"
ON public.venda_historico FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_id));
