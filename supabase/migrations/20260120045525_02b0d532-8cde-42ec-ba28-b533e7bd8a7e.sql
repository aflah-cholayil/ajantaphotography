-- Create table for grouped people FIRST
CREATE TABLE public.people (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Unknown Person',
  face_thumbnail_key TEXT,
  is_hidden BOOLEAN DEFAULT false,
  photo_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for detected faces in media (references people)
CREATE TABLE public.detected_faces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  face_id TEXT,
  external_image_id TEXT,
  bounding_box JSONB,
  confidence NUMERIC(5,2),
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_detected_faces_album_id ON public.detected_faces(album_id);
CREATE INDEX idx_detected_faces_person_id ON public.detected_faces(person_id);
CREATE INDEX idx_detected_faces_media_id ON public.detected_faces(media_id);
CREATE INDEX idx_people_album_id ON public.people(album_id);

-- Enable RLS
ALTER TABLE public.detected_faces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

-- RLS policies for detected_faces
CREATE POLICY "Staff can manage detected_faces"
ON public.detected_faces FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Clients can view their album faces"
ON public.detected_faces FOR SELECT
USING (EXISTS (
  SELECT 1 FROM albums
  JOIN clients ON clients.id = albums.client_id
  WHERE albums.id = detected_faces.album_id AND clients.user_id = auth.uid()
));

-- RLS policies for people
CREATE POLICY "Staff can manage people"
ON public.people FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Clients can view their album people"
ON public.people FOR SELECT
USING (
  is_hidden = false AND 
  EXISTS (
    SELECT 1 FROM albums
    JOIN clients ON clients.id = albums.client_id
    WHERE albums.id = people.album_id AND clients.user_id = auth.uid()
  )
);

-- Create trigger to update updated_at
CREATE TRIGGER update_people_updated_at
BEFORE UPDATE ON public.people
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Track face processing status on albums
ALTER TABLE public.albums ADD COLUMN face_processing_status TEXT DEFAULT 'pending';
ALTER TABLE public.albums ADD COLUMN face_processing_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.albums ADD COLUMN face_processing_completed_at TIMESTAMP WITH TIME ZONE;