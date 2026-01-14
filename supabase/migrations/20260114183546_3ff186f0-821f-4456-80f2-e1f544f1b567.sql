-- Add policy to deny anonymous access to profiles table
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Add policies to deny anonymous access to remaining tables
CREATE POLICY "Deny anonymous access to albums"
ON public.albums
FOR SELECT
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to media"
ON public.media
FOR SELECT
TO anon
USING (false);

CREATE POLICY "Deny anonymous access to share_links"
ON public.share_links
FOR SELECT
TO anon
USING (false);

-- Note: The "Anyone can create a booking" policy with WITH CHECK (true) 
-- is intentionally permissive to allow public booking form submissions.
-- The "Service role can insert email logs" policy is intentionally permissive
-- for edge functions to log emails using service role key.