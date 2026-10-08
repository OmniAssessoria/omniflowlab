DROP POLICY IF EXISTS "clientes update por perfil e vinculo" ON public.clientes;
CREATE POLICY "clientes update por perfil e vinculo" ON public.clientes FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'bko'::app_role) OR consultor_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role)
  OR has_role(auth.uid(), 'bko'::app_role) OR consultor_id = auth.uid()
);

CREATE OR REPLACE FUNCTION public.protect_cliente_metricas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  NEW.qtd_linhas_total := OLD.qtd_linhas_total;
  NEW.receita_total := OLD.receita_total;
  NEW.ultima_venda_em := OLD.ultima_venda_em;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_cliente_metricas ON public.clientes;
CREATE TRIGGER trg_protect_cliente_metricas
BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.protect_cliente_metricas();