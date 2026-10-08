-- Revoke EXECUTE from PUBLIC (which includes anon and authenticated)
-- for the security definer function validate_operational_date_permissions
REVOKE EXECUTE ON FUNCTION public.validate_operational_date_permissions() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_operational_date_permissions() FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_operational_date_permissions() FROM authenticated;

-- Grant EXECUTE to service_role (so the database engine can run it as trigger)
GRANT EXECUTE ON FUNCTION public.validate_operational_date_permissions() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_operational_date_permissions() TO postgres;
