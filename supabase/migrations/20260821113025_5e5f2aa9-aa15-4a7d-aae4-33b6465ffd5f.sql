ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS consultor_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_clientes_consultor_id_ativos
  ON public.clientes (consultor_id)
  WHERE deleted_at IS NULL AND COALESCE(is_deleted, false) = false;

CREATE OR REPLACE FUNCTION public.enforce_cliente_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.has_role(auth.uid(), 'consultor'::public.app_role) THEN
    NEW.consultor_id := auth.uid();
    IF TG_OP = 'INSERT' THEN
      NEW.created_by := auth.uid();
    ELSIF OLD.created_by IS NOT NULL THEN
      NEW.created_by := OLD.created_by;
    ELSE
      NEW.created_by := auth.uid();
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_cliente_ownership ON public.clientes;
CREATE TRIGGER trg_enforce_cliente_ownership
BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.enforce_cliente_ownership();

UPDATE public.clientes c
SET consultor_id = candidate.consultor_id
FROM (
  SELECT v.cliente_id, min(v.consultor_id::text)::uuid AS consultor_id
  FROM public.vendas v
  WHERE v.cliente_id IS NOT NULL
    AND v.consultor_id IS NOT NULL
    AND v.deleted_at IS NULL
    AND COALESCE(v.is_deleted, false) = false
  GROUP BY v.cliente_id
  HAVING count(DISTINCT v.consultor_id) = 1
) candidate
WHERE c.id = candidate.cliente_id
  AND c.consultor_id IS NULL;

DROP POLICY IF EXISTS "clientes select autenticados" ON public.clientes;
DROP POLICY IF EXISTS "clientes select admin/gestor/consultor-owner" ON public.clientes;
DROP POLICY IF EXISTS "clientes leitura por perfil" ON public.clientes;
CREATE POLICY "clientes select por perfil e vinculo"
ON public.clientes FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR public.has_role(auth.uid(), 'bko'::public.app_role)
  OR consultor_id = auth.uid()
);

DROP POLICY IF EXISTS "clientes insert autenticados" ON public.clientes;
CREATE POLICY "clientes insert por perfil"
ON public.clientes FOR INSERT
TO authenticated
WITH CHECK (
  (public.has_role(auth.uid(), 'consultor'::public.app_role)
    AND consultor_id = auth.uid()
    AND created_by = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
);

DROP POLICY IF EXISTS "clientes update autenticados" ON public.clientes;
CREATE POLICY "clientes update por perfil e vinculo"
ON public.clientes FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR consultor_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor'::public.app_role)
  OR consultor_id = auth.uid()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;