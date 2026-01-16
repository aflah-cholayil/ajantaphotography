-- Drop existing policies on share_links
DROP POLICY IF EXISTS "Deny anonymous access to share_links" ON public.share_links;
DROP POLICY IF EXISTS "Admins can manage share links" ON public.share_links;
DROP POLICY IF EXISTS "Admins can view all share links" ON public.share_links;
DROP POLICY IF EXISTS "Clients can create share links for their albums" ON public.share_links;
DROP POLICY IF EXISTS "Clients can view share links for their albums" ON public.share_links;

-- Create PERMISSIVE policies for proper access control
-- Admins can do everything with share_links
CREATE POLICY "Admins can manage share links"
ON public.share_links
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Clients can view share links for their own albums
CREATE POLICY "Clients can view their album share links"
ON public.share_links
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM albums
    JOIN clients ON clients.id = albums.client_id
    WHERE albums.id = share_links.album_id
    AND clients.user_id = auth.uid()
  )
);

-- Clients can create share links for their own albums
CREATE POLICY "Clients can create their album share links"
ON public.share_links
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM albums
    JOIN clients ON clients.id = albums.client_id
    WHERE albums.id = share_links.album_id
    AND clients.user_id = auth.uid()
  )
);