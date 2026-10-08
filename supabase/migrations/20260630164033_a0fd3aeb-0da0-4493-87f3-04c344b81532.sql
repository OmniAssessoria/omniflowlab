
CREATE OR REPLACE FUNCTION public.calc_venda_sla()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cfg RECORD;
  base_time TIMESTAMPTZ := now();
BEGIN
  IF TG_OP = 'INSERT' OR NEW.etapa_id IS DISTINCT FROM OLD.etapa_id THEN
    SELECT * INTO cfg FROM public.sla_config
      WHERE etapa_id = NEW.etapa_id
        AND (operadora = NEW.operadora::text OR operadora IS NULL)
        AND ativo = true
      ORDER BY (operadora = NEW.operadora::text) DESC NULLS LAST
      LIMIT 1;
    IF cfg.id IS NOT NULL THEN
      NEW.sla_due_at := base_time + (cfg.prazo_horas || ' hours')::interval;
      NEW.sla_alerta_at := base_time + (cfg.alerta_horas || ' hours')::interval;
      NEW.sla_status_calc := 'ok';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

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
  SELECT id, consultor_id, operadora, valor FROM public.vendas WHERE id = _venda_id INTO v;
  IF v.id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO r FROM public.comissao_regras
    WHERE ativo = true
      AND CURRENT_DATE BETWEEN vigencia_inicio AND COALESCE(vigencia_fim, CURRENT_DATE)
      AND (consultor_id = v.consultor_id OR consultor_id IS NULL)
      AND (operadora = v.operadora::text OR operadora IS NULL)
      AND COALESCE(v.valor,0) >= COALESCE(valor_min,0)
      AND (valor_max IS NULL OR COALESCE(v.valor,0) <= valor_max)
    ORDER BY
      (consultor_id = v.consultor_id) DESC NULLS LAST,
      (operadora = v.operadora::text) DESC NULLS LAST,
      vigencia_inicio DESC
    LIMIT 1;

  IF r.id IS NULL THEN
    percentual := 0; bonus := 0; valor := 0; regra_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  percentual := r.percentual;
  bonus := r.bonus_fixo;
  valor := ROUND(COALESCE(v.valor,0) * r.percentual / 100.0, 2) + r.bonus_fixo;
  regra_id := r.id;
  RETURN NEXT;
END;
$function$;
