-- Add RLS to admin_users_view
-- Views need security_invoker to use the caller's permissions
DROP VIEW IF EXISTS public.admin_users_view;

CREATE VIEW public.admin_users_view
WITH (security_invoker = on)
AS
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
LEFT JOIN public.user_roles ur ON p.user_id = ur.user_id
WHERE ur.role IN ('owner', 'admin', 'editor', 'viewer');