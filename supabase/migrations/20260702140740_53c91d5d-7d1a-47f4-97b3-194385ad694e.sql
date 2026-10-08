
-- Trigger: cria ticket automaticamente quando uma venda entra no funil "suporte"
CREATE OR REPLACE FUNCTION public.auto_ticket_on_funil_suporte()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  existing_id uuid;
  actor uuid := COALESCE(auth.uid(), NEW.consultor_id);
  is_urgente boolean := (NEW.etapa_id = 's-urgente');
  prio text;
BEGIN
  IF NEW.funil::text = 'suporte'
     AND (TG_OP = 'INSERT' OR OLD.funil::text IS DISTINCT FROM NEW.funil::text) THEN

    SELECT id INTO existing_id
      FROM public.tickets
      WHERE venda_id = NEW.id
        AND status NOT IN ('resolvido','fechado')
      LIMIT 1;

    IF existing_id IS NULL AND actor IS NOT NULL THEN
      prio := CASE WHEN is_urgente THEN 'urgente' ELSE 'media' END;
      INSERT INTO public.tickets(
        venda_id, cliente_razao_social, cliente_cnpj, operadora,
        titulo, descricao, categoria, prioridade, status,
        criado_por, atribuido_a, sla_due_at
      ) VALUES (
        NEW.id,
        NEW.cliente_razao_social,
        NEW.cliente_cnpj,
        NEW.operadora::text,
        'Suporte — venda ' || NEW.numero,
        COALESCE(NEW.status_pedido_obs, 'Chamado gerado automaticamente pela venda ' || NEW.numero || ' ao entrar no funil Suporte.'),
        'operacional',
        prio,
        'aberto',
        actor,
        NULL,
        now() + (CASE WHEN is_urgente THEN interval '4 hours' ELSE interval '24 hours' END)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_ticket_on_funil_suporte ON public.vendas;
CREATE TRIGGER trg_auto_ticket_on_funil_suporte
AFTER INSERT OR UPDATE OF funil, etapa_id ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.auto_ticket_on_funil_suporte();

-- Backfill: criar chamados para vendas que já estão no funil suporte e ainda não têm ticket ativo
INSERT INTO public.tickets(
  venda_id, cliente_razao_social, cliente_cnpj, operadora,
  titulo, descricao, categoria, prioridade, status,
  criado_por, atribuido_a, sla_due_at
)
SELECT
  v.id,
  v.cliente_razao_social,
  v.cliente_cnpj,
  v.operadora::text,
  'Suporte — venda ' || v.numero,
  COALESCE(v.status_pedido_obs, 'Chamado gerado automaticamente (backfill) para venda ' || v.numero || '.'),
  'operacional',
  CASE WHEN v.etapa_id = 's-urgente' THEN 'urgente' ELSE 'media' END,
  'aberto',
  v.consultor_id,
  NULL,
  now() + CASE WHEN v.etapa_id = 's-urgente' THEN interval '4 hours' ELSE interval '24 hours' END
FROM public.vendas v
WHERE v.funil::text = 'suporte'
  AND v.consultor_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.venda_id = v.id AND t.status NOT IN ('resolvido','fechado')
  );
