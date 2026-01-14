-- Add policy to explicitly deny anonymous access to clients table
CREATE POLICY "Deny anonymous access to clients"
ON public.clients
FOR SELECT
TO anon
USING (false);

-- Add similar protection for email_logs table
CREATE POLICY "Deny anonymous access to email_logs"
ON public.email_logs
FOR SELECT
TO anon
USING (false);