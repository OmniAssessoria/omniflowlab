
-- Clientes: restrict SELECT to admin/gestor or consultor who owns a venda for that cliente
DROP POLICY IF EXISTS "clientes leitura autenticados" ON public.clientes;
CREATE POLICY "clientes select admin/gestor/consultor-owner"
ON public.clientes FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
  OR EXISTS (
    SELECT 1 FROM public.vendas v
    WHERE v.cliente_id = clientes.id AND v.consultor_id = auth.uid()
  )
);

-- comissao_fechamentos: only admin/gestor may SELECT
DROP POLICY IF EXISTS "fech_select_all" ON public.comissao_fechamentos;
CREATE POLICY "fech_select_admin_gestor"
ON public.comissao_fechamentos FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- comissao_regras: admin/gestor OR the specific consultor the rule applies to
DROP POLICY IF EXISTS "regras_select_all" ON public.comissao_regras;
CREATE POLICY "regras_select_admin_gestor_or_owner"
ON public.comissao_regras FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
  OR consultor_id = auth.uid()
);
