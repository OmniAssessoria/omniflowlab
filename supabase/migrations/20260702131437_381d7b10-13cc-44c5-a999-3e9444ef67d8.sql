CREATE OR REPLACE FUNCTION public.trg_recalc_meta_self()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  PERFORM public.recalc_meta(NEW.id);
  RETURN NEW;
END;
$function$;