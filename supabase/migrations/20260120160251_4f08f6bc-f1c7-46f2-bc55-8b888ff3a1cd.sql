-- Create table for storing client photo selections/favorites
CREATE TABLE public.media_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint to prevent duplicate favorites
CREATE UNIQUE INDEX idx_media_favorites_unique ON public.media_favorites(media_id, user_id);

-- Create index for faster lookups
CREATE INDEX idx_media_favorites_album ON public.media_favorites(album_id);
CREATE INDEX idx_media_favorites_user ON public.media_favorites(user_id);

-- Enable Row Level Security
ALTER TABLE public.media_favorites ENABLE ROW LEVEL SECURITY;

-- Clients can view their own favorites
CREATE POLICY "Clients can view their own favorites"
ON public.media_favorites
FOR SELECT
USING (auth.uid() = user_id);

-- Clients can add favorites for their albums
CREATE POLICY "Clients can add favorites for their albums"
ON public.media_favorites
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM albums
    JOIN clients ON clients.id = albums.client_id
    WHERE albums.id = media_favorites.album_id
    AND clients.user_id = auth.uid()
  )
);

-- Clients can remove their own favorites
CREATE POLICY "Clients can remove their own favorites"
ON public.media_favorites
FOR DELETE
USING (auth.uid() = user_id);

-- Staff can view all favorites
CREATE POLICY "Staff can view all favorites"
ON public.media_favorites
FOR SELECT
USING (is_admin_user(auth.uid()));

-- Staff can manage all favorites
CREATE POLICY "Staff can manage all favorites"
ON public.media_favorites
FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));