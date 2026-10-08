
-- ============ ticket_leituras ============
CREATE TABLE IF NOT EXISTS public.ticket_leituras (
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticket_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_leituras TO authenticated;
GRANT ALL ON public.ticket_leituras TO service_role;

ALTER TABLE public.ticket_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leituras: usuário lê a própria + suporte/admin vê tudo"
  ON public.ticket_leituras FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'suporte'::app_role)
  );

CREATE POLICY "leituras: usuário insere/atualiza a própria"
  ON public.ticket_leituras FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "leituras: usuário atualiza a própria"
  ON public.ticket_leituras FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.ticket_leituras REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_leituras;

-- ============ Auto-criação de ticket quando status_pedido = 'prd_suporte' ============
CREATE OR REPLACE FUNCTION public.auto_ticket_on_prd_suporte()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_id uuid;
  actor uuid := COALESCE(auth.uid(), NEW.consultor_id);
BEGIN
  IF NEW.status_pedido = 'prd_suporte'
     AND (OLD.status_pedido IS DISTINCT FROM NEW.status_pedido) THEN
    -- Evita duplicidade: só cria se ainda não houver ticket aberto para essa venda
    SELECT id INTO existing_id
      FROM public.tickets
      WHERE venda_id = NEW.id
        AND status NOT IN ('resolvido','fechado')
      LIMIT 1;

    IF existing_id IS NULL AND actor IS NOT NULL THEN
      INSERT INTO public.tickets(
        venda_id, cliente_razao_social, cliente_cnpj, operadora,
        titulo, descricao, categoria, prioridade, status,
        criado_por, sla_due_at
      ) VALUES (
        NEW.id,
        NEW.cliente_razao_social,
        NEW.cliente_cnpj,
        NEW.operadora::text,
        'PRD/Suporte — venda ' || NEW.numero,
        COALESCE(NEW.status_pedido_obs, 'Solicitação de suporte gerada automaticamente pela venda ' || NEW.numero || '.'),
        'operacional',
        'alta',
        'aberto',
        actor,
        now() + interval '24 hours'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_ticket_on_prd_suporte ON public.vendas;
CREATE TRIGGER trg_auto_ticket_on_prd_suporte
AFTER UPDATE OF status_pedido ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.auto_ticket_on_prd_suporte();
