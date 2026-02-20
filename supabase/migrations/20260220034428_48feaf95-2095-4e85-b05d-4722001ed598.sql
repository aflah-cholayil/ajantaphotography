
-- Create services table
CREATE TABLE public.services (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text NOT NULL,
  full_description text,
  icon_name text NOT NULL DEFAULT 'Camera',
  category text NOT NULL DEFAULT 'wedding',
  price text,
  show_price boolean NOT NULL DEFAULT true,
  show_book_button boolean NOT NULL DEFAULT false,
  book_button_text text NOT NULL DEFAULT 'Book Now',
  estimated_delivery text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create service_features table
CREATE TABLE public.service_features (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  feature_text text NOT NULL,
  display_order integer NOT NULL DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_features ENABLE ROW LEVEL SECURITY;

-- Public can view active services
CREATE POLICY "Public can view active services"
ON public.services FOR SELECT
USING (is_active = true);

-- Staff can manage services
CREATE POLICY "Staff can manage services"
ON public.services FOR ALL
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

-- Public can view features of active services
CREATE POLICY "Public can view active service features"
ON public.service_features FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.services
  WHERE services.id = service_features.service_id
  AND services.is_active = true
));

-- Staff can manage service features
CREATE POLICY "Staff can manage service features"
ON public.service_features FOR ALL
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed existing hardcoded services
INSERT INTO public.services (title, slug, short_description, icon_name, category, price, show_price, show_book_button, is_active, display_order) VALUES
('Wedding Photography', 'wedding-photography', 'Full-day coverage capturing every precious moment from bridal preparation to reception.', 'Camera', 'wedding', 'From $3,500', true, false, true, 0),
('Cinematic Films', 'cinematic-films', 'Hollywood-style wedding films that tell your unique love story with emotion and artistry.', 'Video', 'wedding', 'From $4,500', true, false, true, 1),
('Pre-Wedding Shoots', 'pre-wedding-shoots', 'Romantic portrait sessions at stunning locations of your choice before the big day.', 'Heart', 'wedding', 'From $1,200', true, false, true, 2),
('Engagement Sessions', 'engagement-sessions', 'Celebrate your engagement with a beautiful photo session to announce your love.', 'Star', 'wedding', 'From $800', true, false, true, 3),
('Event Coverage', 'event-coverage', 'Professional photography for corporate events, parties, and special celebrations.', 'Users', 'event', 'From $500/hr', true, false, true, 4),
('Elopement Packages', 'elopement-packages', 'Intimate coverage for smaller ceremonies and destination elopements.', 'Clock', 'wedding', 'From $2,000', true, false, true, 5);

-- Seed features
INSERT INTO public.service_features (service_id, feature_text, display_order)
SELECT s.id, f.feature_text, f.display_order
FROM public.services s
CROSS JOIN LATERAL (VALUES
  ('Unlimited high-resolution photos', 0),
  ('Professional post-processing', 1),
  ('Online private gallery', 2),
  ('Print-ready files', 3),
  ('Same-day sneak peeks', 4),
  ('Second photographer option', 5)
) AS f(feature_text, display_order)
WHERE s.slug = 'wedding-photography';

INSERT INTO public.service_features (service_id, feature_text, display_order)
SELECT s.id, f.feature_text, f.display_order
FROM public.services s
CROSS JOIN LATERAL (VALUES
  ('4K Ultra HD quality', 0),
  ('Highlight reel (5-8 min)', 1),
  ('Full ceremony edit', 2),
  ('Drone aerial footage', 3),
  ('Same-day edit option', 4),
  ('Raw footage included', 5)
) AS f(feature_text, display_order)
WHERE s.slug = 'cinematic-films';

INSERT INTO public.service_features (service_id, feature_text, display_order)
SELECT s.id, f.feature_text, f.display_order
FROM public.services s
CROSS JOIN LATERAL (VALUES
  ('2-3 hour session', 0),
  ('Multiple outfit changes', 1),
  ('100+ edited photos', 2),
  ('Location scouting', 3),
  ('Professional styling tips', 4),
  ('Digital album included', 5)
) AS f(feature_text, display_order)
WHERE s.slug = 'pre-wedding-shoots';

INSERT INTO public.service_features (service_id, feature_text, display_order)
SELECT s.id, f.feature_text, f.display_order
FROM public.services s
CROSS JOIN LATERAL (VALUES
  ('1-2 hour session', 0),
  ('One location', 1),
  ('50+ edited photos', 2),
  ('Save-the-date images', 3),
  ('Social media optimized', 4),
  ('Quick turnaround', 5)
) AS f(feature_text, display_order)
WHERE s.slug = 'engagement-sessions';

INSERT INTO public.service_features (service_id, feature_text, display_order)
SELECT s.id, f.feature_text, f.display_order
FROM public.services s
CROSS JOIN LATERAL (VALUES
  ('Flexible hour packages', 0),
  ('On-site editing available', 1),
  ('Quick delivery', 2),
  ('Print options', 3),
  ('Group shots', 4),
  ('Candid coverage', 5)
) AS f(feature_text, display_order)
WHERE s.slug = 'event-coverage';

INSERT INTO public.service_features (service_id, feature_text, display_order)
SELECT s.id, f.feature_text, f.display_order
FROM public.services s
CROSS JOIN LATERAL (VALUES
  ('4 hours of coverage', 0),
  ('High-resolution photos', 1),
  ('Scenic location shoots', 2),
  ('Adventure photography', 3),
  ('Quick turnaround', 4),
  ('Travel available', 5)
) AS f(feature_text, display_order)
WHERE s.slug = 'elopement-packages';
