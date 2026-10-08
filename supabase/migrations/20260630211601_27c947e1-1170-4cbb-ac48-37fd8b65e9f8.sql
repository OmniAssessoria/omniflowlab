
-- Status da comissão
DO $$ BEGIN
  CREATE TYPE public.comissao_status_enum AS ENUM (
    'pendente_confirmacao','pendente_regra','confirmada','revisada','cancelada','paga'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Itens
ALTER TABLE public.comissao_itens
  ADD COLUMN IF NOT EXISTS status public.comissao_status_enum NOT NULL DEFAULT 'pendente_confirmacao',
  ADD COLUMN IF NOT EXISTS confirmada_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS confirmada_por_nome text,
  ADD COLUMN IF NOT EXISTS confirmada_em timestamptz,
  ADD COLUMN IF NOT EXISTS data_ativacao_100 timestamptz,
  ADD COLUMN IF NOT EXISTS sem_regra boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS produto text,
  ADD COLUMN IF NOT EXISTS tipo_pedido text;

-- Garantir unicidade por venda
DO $$ BEGIN
  ALTER TABLE public.comissao_itens ADD CONSTRAINT comissao_itens_venda_unique UNIQUE (venda_id);
EXCEPTION WHEN duplicate_object THEN NULL; WHEN duplicate_table THEN NULL; END $$;

-- Regras: mapear por produto/tipo de pedido
ALTER TABLE public.comissao_regras
  ADD COLUMN IF NOT EXISTS produto text,
  ADD COLUMN IF NOT EXISTS tipo_pedido text;

-- Atualiza calc_comissao_venda para considerar produto/tipo_pedido
CREATE OR REPLACE FUNCTION public.calc_comissao_venda(_venda_id uuid)
 RETURNS TABLE(percentual numeric, bonus numeric, valor numeric, regra_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v RECORD;
  r RECORD;
BEGIN
  SELECT id, consultor_id, operadora, valor, produto, tipo_pedido FROM public.vendas WHERE id = _venda_id INTO v;
  IF v.id IS NULL THEN RETURN; END IF;

  SELECT * INTO r FROM public.comissao_regras
    WHERE ativo = true
      AND CURRENT_DATE BETWEEN vigencia_inicio AND COALESCE(vigencia_fim, CURRENT_DATE)
      AND (consultor_id = v.consultor_id OR consultor_id IS NULL)
      AND (operadora = v.operadora::text OR operadora IS NULL)
      AND (produto IS NULL OR produto = v.produto)
      AND (tipo_pedido IS NULL OR tipo_pedido = v.tipo_pedido)
      AND COALESCE(v.valor,0) >= COALESCE(valor_min,0)
      AND (valor_max IS NULL OR COALESCE(v.valor,0) <= valor_max)
    ORDER BY
      (consultor_id = v.consultor_id) DESC NULLS LAST,
      (produto IS NOT NULL AND produto = v.produto) DESC,
      (tipo_pedido IS NOT NULL AND tipo_pedido = v.tipo_pedido) DESC,
      (operadora = v.operadora::text) DESC NULLS LAST,
      vigencia_inicio DESC
    LIMIT 1;

  IF r.id IS NULL THEN
    percentual := 0; bonus := 0; valor := 0; regra_id := NULL;
    RETURN NEXT; RETURN;
  END IF;

  percentual := r.percentual;
  bonus := r.bonus_fixo;
  valor := ROUND(COALESCE(v.valor,0) * r.percentual / 100.0, 2) + r.bonus_fixo;
  regra_id := r.id;
  RETURN NEXT;
END;
$function$;

-- Remover gatilho antigo de etapa concluída (se existir)
DROP TRIGGER IF EXISTS trg_gera_comissao_concluida ON public.vendas;
DROP TRIGGER IF EXISTS gera_comissao_on_concluida_trigger ON public.vendas;

-- Nova função: gera comissão pendente quando status_pedido vira 'ativado'
CREATE OR REPLACE FUNCTION public.gera_comissao_on_ativado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c RECORD;
  f_id UUID;
  existing_id UUID;
  _ano INT;
  _mes INT;
  v_user UUID := auth.uid();
  v_nome TEXT;
BEGIN
  IF NEW.status_pedido IS DISTINCT FROM OLD.status_pedido AND NEW.status_pedido = 'ativado' THEN
    -- Evita duplicar
    SELECT id INTO existing_id FROM public.comissao_itens WHERE venda_id = NEW.id;
    IF existing_id IS NOT NULL THEN
      RETURN NEW;
    END IF;

    SELECT * FROM public.calc_comissao_venda(NEW.id) INTO c;

    _ano := EXTRACT(YEAR FROM now())::int;
    _mes := EXTRACT(MONTH FROM now())::int;

    SELECT id INTO f_id FROM public.comissao_fechamentos WHERE ano = _ano AND mes = _mes AND status = 'aberto';
    IF f_id IS NULL THEN
      INSERT INTO public.comissao_fechamentos(ano, mes) VALUES (_ano, _mes) RETURNING id INTO f_id;
    END IF;

    INSERT INTO public.comissao_itens(
      fechamento_id, venda_id, consultor_id, operadora, produto, tipo_pedido,
      base_calculo, percentual_aplicado, bonus_fixo, valor_comissao, regra_id,
      status, sem_regra, data_ativacao_100
    ) VALUES (
      f_id, NEW.id, NEW.consultor_id, NEW.operadora, NEW.produto, NEW.tipo_pedido,
      COALESCE(NEW.valor,0), COALESCE(c.percentual,0), COALESCE(c.bonus,0), COALESCE(c.valor,0), c.regra_id,
      CASE WHEN c.regra_id IS NULL THEN 'pendente_regra'::public.comissao_status_enum
           ELSE 'pendente_confirmacao'::public.comissao_status_enum END,
      c.regra_id IS NULL,
      now()
    );

    SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = COALESCE(NEW.consultor_id, v_user);
    INSERT INTO public.venda_historico (venda_id, tipo, descricao, user_id, user_nome)
    VALUES (NEW.id, 'observacao',
      'Comissão gerada automaticamente — Motivo: Pedido Ativado 100% — Valor previsto: R$ ' ||
      to_char(COALESCE(c.valor,0),'FM999G999G990D00') ||
      ' — Status: ' || CASE WHEN c.regra_id IS NULL THEN 'Pendente de regra' ELSE 'Pendente de confirmação' END,
      v_user, v_nome);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_gera_comissao_on_ativado ON public.vendas;
CREATE TRIGGER trg_gera_comissao_on_ativado
  AFTER UPDATE OF status_pedido ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.gera_comissao_on_ativado();
