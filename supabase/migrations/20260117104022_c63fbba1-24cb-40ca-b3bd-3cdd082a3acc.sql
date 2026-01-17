-- Fix Issue 1: admin_users_view needs RLS protection
-- Views in PostgreSQL inherit RLS from their base tables when created with security_invoker
-- We need to recreate the view with proper security settings

-- Drop the existing view
DROP VIEW IF EXISTS public.admin_users_view;

-- Recreate the view with security_invoker enabled so it respects RLS of underlying tables
CREATE VIEW public.admin_users_view
WITH (security_invoker = on) AS
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

-- Add a comment explaining the view's purpose
COMMENT ON VIEW public.admin_users_view IS 'Displays admin user information. Protected by RLS on profiles and user_roles tables.';