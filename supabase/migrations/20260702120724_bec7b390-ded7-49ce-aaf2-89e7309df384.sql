DROP POLICY IF EXISTS "clientes select admin/gestor/consultor-owner" ON public.clientes;
CREATE POLICY "clientes select autenticados"
ON public.clientes FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'consultor'::app_role)
  OR has_role(auth.uid(), 'bko'::app_role)
  OR has_role(auth.uid(), 'suporte'::app_role)
);