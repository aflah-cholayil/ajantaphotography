-- Create enum for work types
CREATE TYPE public.work_type AS ENUM ('photo', 'video');

-- Create enum for work status
CREATE TYPE public.work_status AS ENUM ('active', 'hidden');

-- Create enum for work categories
CREATE TYPE public.work_category AS ENUM ('wedding', 'pre-wedding', 'event', 'candid', 'other');

-- Create works table
CREATE TABLE public.works (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  category public.work_category NOT NULL DEFAULT 'wedding',
  type public.work_type NOT NULL DEFAULT 'photo',
  s3_key text NOT NULL,
  s3_preview_key text,
  width integer,
  height integer,
  size bigint,
  mime_type text,
  show_on_home boolean NOT NULL DEFAULT false,
  show_on_gallery boolean NOT NULL DEFAULT true,
  status public.work_status NOT NULL DEFAULT 'active',
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.works ENABLE ROW LEVEL SECURITY;

-- Create trigger for updated_at
CREATE TRIGGER update_works_updated_at
BEFORE UPDATE ON public.works
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Admins can manage all works
CREATE POLICY "Admins can manage works"
ON public.works
FOR ALL
TO authenticated
USING (is_admin_user(auth.uid()))
WITH CHECK (is_admin_user(auth.uid()));

-- Public can view active works
CREATE POLICY "Public can view active works"
ON public.works
FOR SELECT
TO anon, authenticated
USING (status = 'active');

-- Create index for common queries
CREATE INDEX idx_works_status_home ON public.works(status, show_on_home) WHERE status = 'active' AND show_on_home = true;
CREATE INDEX idx_works_status_gallery ON public.works(status, show_on_gallery) WHERE status = 'active' AND show_on_gallery = true;
CREATE INDEX idx_works_category ON public.works(category);
CREATE INDEX idx_works_type ON public.works(type);