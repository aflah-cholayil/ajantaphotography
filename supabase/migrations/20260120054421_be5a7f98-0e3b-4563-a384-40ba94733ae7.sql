-- =====================================================
-- COMPREHENSIVE SECURITY FIX MIGRATION
-- =====================================================

-- 1. FIX: Recreate admin_users_view with security_invoker = on
-- This ensures the view respects RLS from underlying tables
DROP VIEW IF EXISTS public.admin_users_view;

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

-- Grant access to authenticated users (RLS will filter)
GRANT SELECT ON public.admin_users_view TO authenticated;

-- 2. FIX: Replace overly permissive INSERT policies

-- Fix bookings: Replace "true" with more restrictive policy
DROP POLICY IF EXISTS "Anyone can create a booking" ON public.bookings;
CREATE POLICY "Anyone can create a booking" 
ON public.bookings 
FOR INSERT 
TO anon, authenticated
WITH CHECK (
  -- Allow anyone to create a booking but validate required fields
  client_name IS NOT NULL AND 
  client_email IS NOT NULL AND 
  event_type IS NOT NULL
);

-- Fix contact_messages: Replace "true" with validation
DROP POLICY IF EXISTS "Anyone can submit contact message" ON public.contact_messages;
CREATE POLICY "Anyone can submit contact message" 
ON public.contact_messages 
FOR INSERT 
TO anon, authenticated
WITH CHECK (
  -- Validate required fields to prevent spam
  name IS NOT NULL AND 
  name != '' AND
  email IS NOT NULL AND 
  email != '' AND
  message IS NOT NULL AND 
  message != ''
);

-- Fix email_logs: Restrict to service role only (edge functions)
DROP POLICY IF EXISTS "Service role can insert email logs" ON public.email_logs;
-- Note: Service role bypasses RLS, so we don't need a replacement policy
-- Edge functions use service role key

-- 3. Create additional security helper functions

-- Function to check if user is staff (owner, admin, or editor)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin', 'editor')
  )
$$;

-- Function to check if user can view admin data
CREATE OR REPLACE FUNCTION public.can_view_admin_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;

-- 4. Add rate limiting support table for future implementation
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  action_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

-- Enable RLS on rate_limits
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Service role can manage rate limits (edge functions)
-- Note: No policies needed as service role bypasses RLS

-- Create index for efficient cleanup
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON public.rate_limits(expires_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup ON public.rate_limits(ip_address, action_type, created_at);

-- 5. Add function to clean up expired rate limits
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.rate_limits WHERE expires_at < now();
$$;