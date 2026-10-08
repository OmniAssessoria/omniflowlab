DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.vendas; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.venda_historico; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.vendas REPLICA IDENTITY FULL;
ALTER TABLE public.venda_historico REPLICA IDENTITY FULL;
ALTER TABLE public.tickets REPLICA IDENTITY FULL;