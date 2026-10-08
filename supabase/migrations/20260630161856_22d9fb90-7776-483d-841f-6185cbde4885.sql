
-- Permitir consultor criar/atualizar clientes e leitura ampliada
DROP POLICY IF EXISTS "clientes escrita admin/gestor" ON public.clientes;
DROP POLICY IF EXISTS "clientes leitura por perfil" ON public.clientes;

CREATE POLICY "clientes leitura autenticados"
  ON public.clientes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "clientes insert autenticados"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'consultor'::app_role)
  );

CREATE POLICY "clientes update autenticados"
  ON public.clientes FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'consultor'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'consultor'::app_role)
  );

CREATE POLICY "clientes delete admin/gestor"
  ON public.clientes FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
  );
