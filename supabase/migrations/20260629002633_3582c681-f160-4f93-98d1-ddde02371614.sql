
-- ========== SLA CONFIG ==========
CREATE TABLE public.sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funil TEXT NOT NULL,
  etapa_id TEXT NOT NULL,
  operadora TEXT,
  prazo_horas INT NOT NULL DEFAULT 48,
  alerta_horas INT NOT NULL DEFAULT 24,
  criticidade TEXT NOT NULL DEFAULT 'media',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(funil, etapa_id, operadora)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_config TO authenticated;
GRANT ALL ON public.sla_config TO service_role;
ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "todos autenticados leem sla_config" ON public.sla_config
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin e gestor escrevem sla_config" ON public.sla_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE TRIGGER sla_config_touch BEFORE UPDATE ON public.sla_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== NOTIFICACOES ==========
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  venda_id UUID,
  ticket_id UUID,
  link TEXT,
  criticidade TEXT NOT NULL DEFAULT 'info',
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user_lida ON public.notificacoes(user_id, lida, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user le suas notificacoes" ON public.notificacoes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user marca suas notificacoes" ON public.notificacoes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin gestor inserem notificacoes" ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor') OR user_id = auth.uid());

-- ========== TICKETS ==========
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  venda_id UUID REFERENCES public.vendas(id) ON DELETE SET NULL,
  cliente_razao_social TEXT NOT NULL,
  cliente_cnpj TEXT,
  operadora TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'tecnico',
  prioridade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'aberto',
  atribuido_a UUID,
  criado_por UUID NOT NULL,
  sla_due_at TIMESTAMPTZ,
  resolvido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_status ON public.tickets(status, created_at DESC);
CREATE INDEX idx_tickets_atribuido ON public.tickets(atribuido_a);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura tickets por perfil" ON public.tickets
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gestor')
    OR public.has_role(auth.uid(),'bko')
    OR public.has_role(auth.uid(),'suporte')
    OR criado_por = auth.uid()
    OR atribuido_a = auth.uid()
  );
CREATE POLICY "criacao de tickets autenticados" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid());
CREATE POLICY "atualizacao tickets por perfil" ON public.tickets
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gestor')
    OR public.has_role(auth.uid(),'bko')
    OR public.has_role(auth.uid(),'suporte')
    OR atribuido_a = auth.uid()
  );
CREATE POLICY "exclusao tickets admin" ON public.tickets
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER tickets_touch BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Numero sequencial por ano
CREATE OR REPLACE FUNCTION public.gen_ticket_numero()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  seq INT;
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    SELECT COUNT(*) + 1 INTO seq FROM public.tickets
      WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now());
    NEW.numero := 'TK-' || to_char(now(),'YYYY') || '-' || lpad(seq::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER tickets_numero BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.gen_ticket_numero();

-- ========== TICKET MENSAGENS ==========
CREATE TABLE public.ticket_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL,
  autor_nome TEXT,
  mensagem TEXT NOT NULL,
  interna BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ticket_msg_ticket ON public.ticket_mensagens(ticket_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_mensagens TO authenticated;
GRANT ALL ON public.ticket_mensagens TO service_role;
ALTER TABLE public.ticket_mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura msg quem ve ticket" ON public.ticket_mensagens
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'gestor')
      OR public.has_role(auth.uid(),'bko')
      OR public.has_role(auth.uid(),'suporte')
      OR t.criado_por = auth.uid() OR t.atribuido_a = auth.uid()
    ))
  );
CREATE POLICY "insere msg quem ve ticket" ON public.ticket_mensagens
  FOR INSERT TO authenticated WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND (
      public.has_role(auth.uid(),'admin')
      OR public.has_role(auth.uid(),'gestor')
      OR public.has_role(auth.uid(),'bko')
      OR public.has_role(auth.uid(),'suporte')
      OR t.criado_por = auth.uid() OR t.atribuido_a = auth.uid()
    ))
  );

-- ========== VENDAS extras ==========
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_alerta_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sla_status_calc TEXT,
  ADD COLUMN IF NOT EXISTS pdf_gerado_em TIMESTAMPTZ;

-- ========== Função/trigger de cálculo SLA ao mover etapa ==========
CREATE OR REPLACE FUNCTION public.calc_venda_sla()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg RECORD;
  base_time TIMESTAMPTZ := now();
BEGIN
  IF TG_OP = 'INSERT' OR NEW.etapa_id IS DISTINCT FROM OLD.etapa_id THEN
    SELECT * INTO cfg FROM public.sla_config
      WHERE etapa_id = NEW.etapa_id
        AND (operadora = NEW.operadora OR operadora IS NULL)
        AND ativo = true
      ORDER BY (operadora = NEW.operadora) DESC NULLS LAST
      LIMIT 1;
    IF cfg.id IS NOT NULL THEN
      NEW.sla_due_at := base_time + (cfg.prazo_horas || ' hours')::interval;
      NEW.sla_alerta_at := base_time + (cfg.alerta_horas || ' hours')::interval;
      NEW.sla_status_calc := 'ok';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER vendas_calc_sla
  BEFORE INSERT OR UPDATE OF etapa_id ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.calc_venda_sla();

-- ========== Função pública de varredura SLA (chamada por cron) ==========
CREATE OR REPLACE FUNCTION public.run_sla_check()
RETURNS TABLE(alertas INT, estourados INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_alertas INT := 0;
  v_estourados INT := 0;
  r RECORD;
BEGIN
  -- Marca estourados
  FOR r IN
    SELECT v.id, v.numero, v.cliente_razao_social, v.consultor_id, v.operadora
    FROM public.vendas v
    WHERE v.sla_due_at IS NOT NULL
      AND v.sla_due_at < now()
      AND (v.sla_status_calc IS NULL OR v.sla_status_calc <> 'estourado')
  LOOP
    UPDATE public.vendas SET sla_status_calc = 'estourado' WHERE id = r.id;
    IF r.consultor_id IS NOT NULL THEN
      INSERT INTO public.notificacoes(user_id, tipo, titulo, descricao, venda_id, criticidade, link)
      VALUES (r.consultor_id, 'sla_estouro',
              'SLA estourado: ' || r.numero,
              r.cliente_razao_social || ' (' || r.operadora || ')',
              r.id, 'alta', '/vendas/' || r.id);
    END IF;
    v_estourados := v_estourados + 1;
  END LOOP;

  -- Marca em alerta
  FOR r IN
    SELECT v.id, v.numero, v.cliente_razao_social, v.consultor_id, v.operadora
    FROM public.vendas v
    WHERE v.sla_alerta_at IS NOT NULL
      AND v.sla_alerta_at < now()
      AND v.sla_due_at >= now()
      AND (v.sla_status_calc IS NULL OR v.sla_status_calc = 'ok')
  LOOP
    UPDATE public.vendas SET sla_status_calc = 'alerta' WHERE id = r.id;
    IF r.consultor_id IS NOT NULL THEN
      INSERT INTO public.notificacoes(user_id, tipo, titulo, descricao, venda_id, criticidade, link)
      VALUES (r.consultor_id, 'sla_alerta',
              'SLA em alerta: ' || r.numero,
              r.cliente_razao_social || ' (' || r.operadora || ')',
              r.id, 'media', '/vendas/' || r.id);
    END IF;
    v_alertas := v_alertas + 1;
  END LOOP;

  RETURN QUERY SELECT v_alertas, v_estourados;
END;
$$;
GRANT EXECUTE ON FUNCTION public.run_sla_check() TO anon, authenticated, service_role;

-- ========== Trigger: notifica criação de venda para gestores ==========
CREATE OR REPLACE FUNCTION public.notify_nova_venda()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notificacoes(user_id, tipo, titulo, descricao, venda_id, criticidade, link)
  SELECT ur.user_id, 'nova_venda',
         'Nova venda: ' || NEW.numero,
         NEW.cliente_razao_social || ' (' || NEW.operadora || ')',
         NEW.id, 'info', '/vendas/' || NEW.id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','gestor');
  RETURN NEW;
END;
$$;
CREATE TRIGGER vendas_notify_new AFTER INSERT ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.notify_nova_venda();

-- ========== Trigger: notifica novo ticket para suporte/bko ==========
CREATE OR REPLACE FUNCTION public.notify_novo_ticket()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notificacoes(user_id, tipo, titulo, descricao, ticket_id, criticidade, link)
  SELECT ur.user_id, 'ticket_novo',
         'Novo ticket: ' || NEW.numero,
         NEW.titulo,
         NEW.id,
         CASE NEW.prioridade WHEN 'urgente' THEN 'alta' WHEN 'alta' THEN 'alta' ELSE 'media' END,
         '/suporte/' || NEW.id
  FROM public.user_roles ur
  WHERE ur.role IN ('admin','gestor','bko','suporte');
  RETURN NEW;
END;
$$;
CREATE TRIGGER tickets_notify_new AFTER INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.notify_novo_ticket();

-- ========== Seeds básicos de SLA ==========
INSERT INTO public.sla_config (funil, etapa_id, operadora, prazo_horas, alerta_horas, criticidade) VALUES
  ('prospeccao','p-aguardando',NULL,24,12,'media'),
  ('prospeccao','p-dia1',NULL,24,12,'media'),
  ('prospeccao','p-dia2-lig',NULL,24,12,'media'),
  ('prospeccao','p-dia3',NULL,24,12,'media'),
  ('prospeccao','p-proposta',NULL,48,24,'alta'),
  ('followup','f-proposta',NULL,48,24,'alta'),
  ('followup','f-dia1',NULL,24,12,'media'),
  ('followup','f-dia3',NULL,24,12,'media'),
  ('followup','f-contrato',NULL,48,24,'alta'),
  ('assinatura','a-aguardando',NULL,48,24,'alta'),
  ('assinatura','a-reenvio',NULL,24,12,'alta')
ON CONFLICT (funil, etapa_id, operadora) DO NOTHING;
