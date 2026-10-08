
-- Recalcula totais + sincroniza UF/DDD/contato/telefone/email + operadoras
CREATE OR REPLACE FUNCTION public.recalc_cliente_totais(_cliente_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ops text[];
  _last RECORD;
BEGIN
  IF _cliente_id IS NULL THEN RETURN; END IF;

  SELECT ARRAY(
    SELECT DISTINCT v.operadora::text
    FROM public.vendas v
    WHERE v.cliente_id = _cliente_id AND v.operadora IS NOT NULL
  ) INTO _ops;

  -- Última venda (com dados de contato) para propagar UF/DDD/etc.
  SELECT v.cliente_uf, v.ddd, v.cliente_telefone, v.cliente_email, v.cliente_contato,
         v.cliente_razao_social, v.cliente_cnpj
    INTO _last
    FROM public.vendas v
   WHERE v.cliente_id = _cliente_id
   ORDER BY COALESCE(v.data_ativacao, v.data_recebimento, v.updated_at, v.created_at) DESC NULLS LAST
   LIMIT 1;

  UPDATE public.clientes c SET
    qtd_linhas_total = COALESCE((SELECT SUM(v.quantidade_linhas) FROM public.vendas v WHERE v.cliente_id = _cliente_id), 0),
    receita_total    = COALESCE((SELECT SUM(v.valor)             FROM public.vendas v WHERE v.cliente_id = _cliente_id), 0),
    ultima_venda_em  = (SELECT MAX(COALESCE(v.data_ativacao, v.data_recebimento, v.updated_at, v.created_at)) FROM public.vendas v WHERE v.cliente_id = _cliente_id),
    operadoras       = CASE WHEN array_length(_ops,1) IS NULL THEN c.operadoras ELSE _ops END,
    -- Sincroniza dados básicos priorizando o que veio na venda mais recente
    razao_social     = COALESCE(NULLIF(_last.cliente_razao_social, ''), c.razao_social),
    cnpj_cpf         = COALESCE(NULLIF(regexp_replace(COALESCE(_last.cliente_cnpj,''), '\D', '', 'g'), ''), c.cnpj_cpf),
    uf               = COALESCE(NULLIF(_last.cliente_uf, ''), c.uf),
    ddd              = COALESCE(NULLIF(_last.ddd, ''), c.ddd),
    telefone         = COALESCE(NULLIF(_last.cliente_telefone, ''), c.telefone),
    email            = COALESCE(NULLIF(_last.cliente_email, ''), c.email),
    contato          = COALESCE(NULLIF(_last.cliente_contato, ''), c.contato)
  WHERE c.id = _cliente_id;
END; $$;

-- Trigger em vendas: dispara em qualquer INSERT/UPDATE/DELETE, cobrindo old + new cliente
CREATE OR REPLACE FUNCTION public.trg_recalc_cliente_totais()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_cliente_totais(OLD.cliente_id);
    RETURN OLD;
  END IF;
  PERFORM public.recalc_cliente_totais(NEW.cliente_id);
  IF TG_OP = 'UPDATE' AND OLD.cliente_id IS DISTINCT FROM NEW.cliente_id THEN
    PERFORM public.recalc_cliente_totais(OLD.cliente_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS vendas_recalc_cliente ON public.vendas;
CREATE TRIGGER vendas_recalc_cliente
AFTER INSERT OR UPDATE OR DELETE ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_cliente_totais();

-- Trigger em venda_linhas: garante recálculo mesmo se alteração vier direto nas linhas
CREATE OR REPLACE FUNCTION public.trg_recalc_cliente_from_linha()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cid uuid;
BEGIN
  SELECT cliente_id INTO _cid FROM public.vendas WHERE id = COALESCE(NEW.venda_id, OLD.venda_id);
  IF _cid IS NOT NULL THEN PERFORM public.recalc_cliente_totais(_cid); END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS venda_linhas_recalc_cliente ON public.venda_linhas;
CREATE TRIGGER venda_linhas_recalc_cliente
AFTER INSERT OR UPDATE OR DELETE ON public.venda_linhas
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_cliente_from_linha();

-- Backfill
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.clientes LOOP
    PERFORM public.recalc_cliente_totais(r.id);
  END LOOP;
END $$;
