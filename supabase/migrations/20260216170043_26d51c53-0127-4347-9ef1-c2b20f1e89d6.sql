
-- Create edit_requests table
CREATE TABLE public.edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  edit_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(media_id, user_id)
);

-- Enable RLS
ALTER TABLE public.edit_requests ENABLE ROW LEVEL SECURITY;

-- Clients can INSERT for their own albums
CREATE POLICY "Clients can create edit requests for their albums"
ON public.edit_requests
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM albums
    JOIN clients ON clients.id = albums.client_id
    WHERE albums.id = edit_requests.album_id
    AND clients.user_id = auth.uid()
  )
);

-- Clients can SELECT their own requests
CREATE POLICY "Clients can view their own edit requests"
ON public.edit_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Staff can SELECT all requests
CREATE POLICY "Staff can view all edit requests"
ON public.edit_requests
FOR SELECT
USING (is_admin_user(auth.uid()));

-- Staff can UPDATE all requests
CREATE POLICY "Staff can update edit requests"
ON public.edit_requests
FOR UPDATE
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

-- Staff can DELETE all requests
CREATE POLICY "Staff can delete edit requests"
ON public.edit_requests
FOR DELETE
USING (is_staff(auth.uid()));

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to edit_requests"
ON public.edit_requests
FOR SELECT
USING (false);

-- Trigger for updated_at
CREATE TRIGGER update_edit_requests_updated_at
BEFORE UPDATE ON public.edit_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
