-- Fix function search path for validate_share_link_expiry
CREATE OR REPLACE FUNCTION public.validate_share_link_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'Expiry date must be in the future';
  END IF;
  RETURN NEW;
END;
$$;

-- Fix get_user_role to ensure it has proper search_path (already set, but re-confirming)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;