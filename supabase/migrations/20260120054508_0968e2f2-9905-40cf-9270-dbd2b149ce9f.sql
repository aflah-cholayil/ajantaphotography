-- Fix rate_limits table - add a deny all policy for security
-- This table is only accessed by service role from edge functions

-- Add explicit deny policy for rate_limits (service role bypasses RLS)
CREATE POLICY "Deny direct access to rate_limits" 
ON public.rate_limits 
FOR ALL 
TO anon, authenticated
USING (false)
WITH CHECK (false);