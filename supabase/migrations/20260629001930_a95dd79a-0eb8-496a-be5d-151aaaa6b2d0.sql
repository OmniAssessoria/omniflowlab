
-- =============== ENUMs ===============
CREATE TYPE public.operadora_enum AS ENUM ('CLARO', 'VIVO');
CREATE TYPE public.funil_enum AS ENUM ('prospeccao', 'followup', 'assinatura', 'suporte');
CREATE TYPE public.sla_enum AS ENUM ('ok', 'atencao', 'alerta', 'atrasado');
CREATE TYPE public.prioridade_enum AS ENUM ('baixa', 'media', 'alta', 'urgente');
CREATE TYPE public.historico_tipo_enum AS ENUM ('criacao', 'etapa', 'funil', 'valor', 'consultor', 'observacao', 'importacao');

-- =============== Tabela vendas ===============
CREATE TABLE public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL,
  operadora public.operadora_enum NOT NULL,
  mes_ref SMALLINT NOT NULL CHECK (mes_ref BETWEEN 1 AND 12),
  ano_ref SMALLINT NOT NULL CHECK (ano_ref BETWEEN 2024 AND 2030),

  -- Cliente (denormalizado, vem direto da planilha)
  cliente_razao_social TEXT NOT NULL,
  cliente_cnpj TEXT NOT NULL,
  cliente_contato TEXT,
  cliente_telefone TEXT,
  cliente_email TEXT,
  cliente_uf TEXT,

  -- Pipeline
  funil public.funil_enum NOT NULL DEFAULT 'prospeccao',
  etapa_id TEXT NOT NULL,
  status TEXT,
  tipo_pedido TEXT,
  produto TEXT,
  quantidade_linhas INT NOT NULL DEFAULT 0,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Pessoas
  consultor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  bko_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consultor_nome TEXT,

  -- Datas + SLA
  data_recebimento DATE,
  data_aceite DATE,
  data_ativacao DATE,
  proxima_acao TEXT,
  proxima_acao_data DATE,
  dias_na_etapa INT NOT NULL DEFAULT 0,
  sla_status public.sla_enum NOT NULL DEFAULT 'ok',
  prioridade public.prioridade_enum NOT NULL DEFAULT 'media',

  observacao TEXT,
  tem_erro BOOLEAN DEFAULT FALSE,
  tem_biometria BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  UNIQUE (operadora, cliente_cnpj, mes_ref, ano_ref, numero)
);

CREATE INDEX idx_vendas_operadora_mes ON public.vendas(operadora, mes_ref, ano_ref);
CREATE INDEX idx_vendas_funil_etapa ON public.vendas(funil, etapa_id);
CREATE INDEX idx_vendas_consultor ON public.vendas(consultor_id);
CREATE INDEX idx_vendas_cnpj ON public.vendas(cliente_cnpj);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendas TO authenticated;
GRANT ALL ON public.vendas TO service_role;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER vendas_touch_updated_at
BEFORE UPDATE ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Policies vendas
CREATE POLICY "Admin/Gestor veem todas as vendas"
ON public.vendas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "BKO/Suporte veem todas as vendas (leitura)"
ON public.vendas FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'bko') OR public.has_role(auth.uid(), 'suporte'));

CREATE POLICY "Consultor vê suas vendas"
ON public.vendas FOR SELECT TO authenticated
USING (consultor_id = auth.uid());

CREATE POLICY "Admin/Gestor gerenciam vendas"
ON public.vendas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Consultor edita as próprias vendas"
ON public.vendas FOR UPDATE TO authenticated
USING (consultor_id = auth.uid())
WITH CHECK (consultor_id = auth.uid());

-- =============== Tabela import_logs ===============
CREATE TABLE public.import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo TEXT NOT NULL,
  operadora public.operadora_enum NOT NULL,
  mes_ref SMALLINT NOT NULL,
  ano_ref SMALLINT NOT NULL,
  total_linhas INT NOT NULL DEFAULT 0,
  total_inseridas INT NOT NULL DEFAULT 0,
  total_duplicadas INT NOT NULL DEFAULT 0,
  total_erros INT NOT NULL DEFAULT 0,
  importado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.import_logs TO authenticated;
GRANT ALL ON public.import_logs TO service_role;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Gestor veem logs"
ON public.import_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Admin/Gestor inserem logs"
ON public.import_logs FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- =============== Tabela venda_historico ===============
CREATE TABLE public.venda_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  tipo public.historico_tipo_enum NOT NULL,
  campo TEXT,
  valor_anterior TEXT,
  valor_novo TEXT,
  descricao TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_historico_venda ON public.venda_historico(venda_id, created_at DESC);
GRANT SELECT, INSERT ON public.venda_historico TO authenticated;
GRANT ALL ON public.venda_historico TO service_role;
ALTER TABLE public.venda_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Histórico visível para quem vê a venda"
ON public.venda_historico FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_id)
);

CREATE POLICY "Sistema insere histórico autenticado"
ON public.venda_historico FOR INSERT TO authenticated
WITH CHECK (true);

-- =============== Trigger automático de histórico ===============
CREATE OR REPLACE FUNCTION public.log_venda_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
BEGIN
  SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = v_user;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.venda_historico (venda_id, tipo, descricao, user_id, user_nome)
    VALUES (NEW.id, 'criacao', 'Venda criada (' || NEW.operadora || ' · ' || NEW.cliente_razao_social || ')', v_user, v_nome);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.etapa_id IS DISTINCT FROM OLD.etapa_id THEN
      INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      VALUES (NEW.id, 'etapa', 'etapa_id', OLD.etapa_id, NEW.etapa_id, 'Etapa: ' || OLD.etapa_id || ' → ' || NEW.etapa_id, v_user, v_nome);
    END IF;
    IF NEW.funil IS DISTINCT FROM OLD.funil THEN
      INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      VALUES (NEW.id, 'funil', 'funil', OLD.funil::text, NEW.funil::text, 'Funil: ' || OLD.funil || ' → ' || NEW.funil, v_user, v_nome);
    END IF;
    IF NEW.valor IS DISTINCT FROM OLD.valor THEN
      INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      VALUES (NEW.id, 'valor', 'valor', OLD.valor::text, NEW.valor::text, 'Valor alterado', v_user, v_nome);
    END IF;
    IF NEW.consultor_id IS DISTINCT FROM OLD.consultor_id THEN
      INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      VALUES (NEW.id, 'consultor', 'consultor_id', OLD.consultor_id::text, NEW.consultor_id::text, 'Consultor responsável alterado', v_user, v_nome);
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_venda_historico() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER vendas_log_historico
AFTER INSERT OR UPDATE ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.log_venda_historico();
