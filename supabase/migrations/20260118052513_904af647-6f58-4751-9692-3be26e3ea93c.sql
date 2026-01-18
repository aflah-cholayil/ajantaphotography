-- Fix: Add RLS to admin_users_view
-- Views inherit RLS from underlying tables when using security_invoker
-- But we need to recreate the view with security_invoker=on

-- First drop the existing view
DROP VIEW IF EXISTS public.admin_users_view;

-- Recreate the view with security_invoker enabled
-- This ensures RLS policies on the underlying tables are respected
CREATE VIEW public.admin_users_view
WITH (security_invoker=on) AS
SELECT 
  p.id,
  p.user_id,
  p.name,
  p.email,
  p.avatar_url,
  p.is_active,
  p.last_login,
  p.created_at,
  p.updated_at,
  ur.role
FROM public.profiles p
JOIN public.user_roles ur ON p.user_id = ur.user_id
WHERE ur.role IN ('owner', 'admin', 'editor', 'viewer');

-- Grant select to authenticated users (RLS on underlying tables will filter)
GRANT SELECT ON public.admin_users_view TO authenticated;