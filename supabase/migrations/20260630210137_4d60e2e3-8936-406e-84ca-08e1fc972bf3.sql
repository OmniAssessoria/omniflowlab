
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS status_pedido TEXT,
  ADD COLUMN IF NOT EXISTS status_pedido_obs TEXT,
  ADD COLUMN IF NOT EXISTS status_pedido_user_id UUID,
  ADD COLUMN IF NOT EXISTS status_pedido_user_nome TEXT,
  ADD COLUMN IF NOT EXISTS status_pedido_em TIMESTAMPTZ;

-- Log dedicado para status_pedido (mais granular que o array padrão)
CREATE OR REPLACE FUNCTION public.log_venda_status_pedido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_nome TEXT;
  label_old TEXT;
  label_new TEXT;
BEGIN
  SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = v_user;
  label_old := COALESCE(OLD.status_pedido, '—');
  label_new := COALESCE(NEW.status_pedido, '—');

  IF NEW.status_pedido IS DISTINCT FROM OLD.status_pedido THEN
    INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
    VALUES (NEW.id, 'campo', 'status_pedido', label_old, label_new,
      'Status do pedido: ' || label_old || ' → ' || label_new ||
      COALESCE(' — ' || NEW.status_pedido_obs, ''),
      v_user, v_nome);
  END IF;

  IF COALESCE(NEW.status_pedido_obs,'') IS DISTINCT FROM COALESCE(OLD.status_pedido_obs,'')
     AND NEW.status_pedido IS NOT DISTINCT FROM OLD.status_pedido THEN
    INSERT INTO public.venda_historico (venda_id, tipo, campo, valor_anterior, valor_novo, descricao, user_id, user_nome)
    VALUES (NEW.id, 'observacao', 'status_pedido_obs', COALESCE(OLD.status_pedido_obs,'—'), COALESCE(NEW.status_pedido_obs,'—'),
      'Observação do status do pedido alterada', v_user, v_nome);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_venda_status_pedido ON public.vendas;
CREATE TRIGGER trg_log_venda_status_pedido
AFTER UPDATE OF status_pedido, status_pedido_obs ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.log_venda_status_pedido();
