DROP POLICY IF EXISTS "metas consultor read own" ON public.metas_mensais;
CREATE POLICY "metas all authenticated read" ON public.metas_mensais
  FOR SELECT TO authenticated USING (true);