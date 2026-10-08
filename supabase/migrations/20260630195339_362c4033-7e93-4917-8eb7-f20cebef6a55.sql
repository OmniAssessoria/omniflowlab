
-- 1) Catálogo de erros
CREATE TABLE public.erros_catalogo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.erros_catalogo TO authenticated;
GRANT ALL ON public.erros_catalogo TO service_role;
ALTER TABLE public.erros_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erros_cat_read_all" ON public.erros_catalogo
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "erros_cat_admin_write" ON public.erros_catalogo
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "erros_cat_admin_update" ON public.erros_catalogo
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "erros_cat_admin_delete" ON public.erros_catalogo
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_erros_catalogo_updated_at
  BEFORE UPDATE ON public.erros_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed da lista de erros
INSERT INTO public.erros_catalogo (nome) VALUES
  ('Troca de carteira aberta'),
  ('Troca de carteira negada'),
  ('Troca de carteira Inside Sales não aprovada'),
  ('Aguardando aprovação para troca de carteira'),
  ('Aguardando de acordo'),
  ('De acordo solicitado ao GC'),
  ('De acordo recebido'),
  ('Cliente saiu da carteira'),
  ('Alteração cadastral'),
  ('Correção cadastral'),
  ('E-mail incorreto'),
  ('Reenvio de termo para outro e-mail'),
  ('Dados divergentes'),
  ('Falta contrato social da cessionária'),
  ('Comprovante de endereço pendente'),
  ('Aguardando assinatura'),
  ('Termo manual necessário'),
  ('Termo cancelado pelo sistema'),
  ('Biometria pendente'),
  ('Sem biometria'),
  ('Biometria com risco'),
  ('Reprovado no crédito'),
  ('Inadimplência'),
  ('Cliente com débito em aberto'),
  ('Linhas suspensas por cobrança'),
  ('Portabilidade negada'),
  ('Ausência de resposta ao SMS'),
  ('Dados divergentes na portabilidade'),
  ('Erro no input automático'),
  ('Seguir input manual'),
  ('Caracteres do telefone inválidos'),
  ('Erro sistêmico CPC'),
  ('Erro no Solar'),
  ('Solar fora do ar'),
  ('Pedido voltou da inspeção'),
  ('Passou do SLA de input'),
  ('Aguardando concluir TT'),
  ('Pedido de TT concluído'),
  ('Suporte aberto'),
  ('Suporte concluído'),
  ('Cliente não responde suporte'),
  ('Pendência comercial'),
  ('Falta equipamento'),
  ('Sem estoque'),
  ('Falta aparelho'),
  ('Pedido devolvido para confecção'),
  ('Pedido devolvido para BKO'),
  ('PRD correção aberto'),
  ('Tratativa interna'),
  ('Rua não cabeada'),
  ('Sem viabilidade'),
  ('Problema na tubulação'),
  ('Nota fiscal não gerada'),
  ('CADESP inapto'),
  ('Outro erro')
ON CONFLICT (nome) DO NOTHING;

-- 2) Erros por venda
CREATE TABLE public.venda_erros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  erro_id UUID NOT NULL REFERENCES public.erros_catalogo(id) ON DELETE RESTRICT,
  data_erro DATE NOT NULL DEFAULT CURRENT_DATE,
  resolvido BOOLEAN NOT NULL DEFAULT false,
  observacao TEXT,
  created_by UUID REFERENCES auth.users(id),
  resolvido_em TIMESTAMPTZ,
  resolvido_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_venda_erros_venda ON public.venda_erros(venda_id);
CREATE INDEX idx_venda_erros_aberto ON public.venda_erros(venda_id) WHERE resolvido = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venda_erros TO authenticated;
GRANT ALL ON public.venda_erros TO service_role;
ALTER TABLE public.venda_erros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venda_erros_read_all" ON public.venda_erros
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "venda_erros_insert" ON public.venda_erros
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gestor')
    OR EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_id AND v.consultor_id = auth.uid())
  );

CREATE POLICY "venda_erros_update" ON public.venda_erros
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gestor')
    OR EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_id AND v.consultor_id = auth.uid())
  ) WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gestor')
    OR EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_id AND v.consultor_id = auth.uid())
  );

CREATE POLICY "venda_erros_delete" ON public.venda_erros
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'gestor')
    OR EXISTS (SELECT 1 FROM public.vendas v WHERE v.id = venda_id AND v.consultor_id = auth.uid())
  );

CREATE TRIGGER trg_venda_erros_updated_at
  BEFORE UPDATE ON public.venda_erros
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Recalcular tem_erro da venda
CREATE OR REPLACE FUNCTION public.recalc_venda_tem_erro()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_any BOOLEAN;
BEGIN
  v_id := COALESCE(NEW.venda_id, OLD.venda_id);
  SELECT EXISTS(SELECT 1 FROM public.venda_erros WHERE venda_id = v_id AND resolvido = false) INTO v_any;
  UPDATE public.vendas SET tem_erro = v_any WHERE id = v_id;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER trg_venda_erros_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.venda_erros
  FOR EACH ROW EXECUTE FUNCTION public.recalc_venda_tem_erro();

-- 4) Log no histórico da venda
CREATE OR REPLACE FUNCTION public.log_venda_erro_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  v_erro_nome TEXT;
BEGIN
  SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = v_user;

  IF TG_OP = 'INSERT' THEN
    SELECT nome INTO v_erro_nome FROM public.erros_catalogo WHERE id = NEW.erro_id;
    INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_novo, descricao, user_id, user_nome)
    VALUES (NEW.venda_id, 'observacao', 'erro_adicionado', v_erro_nome,
      'Erro adicionado: ' || v_erro_nome || ' (data ' || to_char(NEW.data_erro,'DD/MM/YYYY') ||
      ', ' || CASE WHEN NEW.resolvido THEN 'Resolvido' ELSE 'Não resolvido' END || ')' ||
      COALESCE(' — ' || NEW.observacao, ''),
      v_user, v_nome);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT nome INTO v_erro_nome FROM public.erros_catalogo WHERE id = NEW.erro_id;
    IF NEW.resolvido IS DISTINCT FROM OLD.resolvido THEN
      INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      VALUES (NEW.venda_id, 'observacao', 'erro_status', CASE WHEN OLD.resolvido THEN 'Resolvido' ELSE 'Não resolvido' END,
        CASE WHEN NEW.resolvido THEN 'Resolvido' ELSE 'Não resolvido' END,
        'Erro "' || v_erro_nome || '" marcado como ' || CASE WHEN NEW.resolvido THEN 'Resolvido' ELSE 'Não resolvido' END,
        v_user, v_nome);
    END IF;
    IF NEW.data_erro IS DISTINCT FROM OLD.data_erro THEN
      INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      VALUES (NEW.venda_id, 'observacao', 'erro_data', to_char(OLD.data_erro,'DD/MM/YYYY'), to_char(NEW.data_erro,'DD/MM/YYYY'),
        'Data do erro "' || v_erro_nome || '" alterada', v_user, v_nome);
    END IF;
    IF COALESCE(NEW.observacao,'') IS DISTINCT FROM COALESCE(OLD.observacao,'') THEN
      INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
      VALUES (NEW.venda_id, 'observacao', 'erro_obs', COALESCE(OLD.observacao,'—'), COALESCE(NEW.observacao,'—'),
        'Observação do erro "' || v_erro_nome || '" alterada', v_user, v_nome);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT nome INTO v_erro_nome FROM public.erros_catalogo WHERE id = OLD.erro_id;
    INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, descricao, user_id, user_nome)
    VALUES (OLD.venda_id, 'observacao', 'erro_removido', v_erro_nome,
      'Erro removido: ' || v_erro_nome, v_user, v_nome);
    RETURN OLD;
  END IF;

  RETURN NULL;
END $$;

CREATE TRIGGER trg_venda_erros_log
  AFTER INSERT OR UPDATE OR DELETE ON public.venda_erros
  FOR EACH ROW EXECUTE FUNCTION public.log_venda_erro_change();
