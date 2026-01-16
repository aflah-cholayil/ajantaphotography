-- Create studio_settings table for editable business details
CREATE TABLE public.studio_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.studio_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (public data)
CREATE POLICY "Anyone can view studio settings" 
ON public.studio_settings 
FOR SELECT 
USING (true);

-- Only admins/owners can update settings
CREATE POLICY "Admins can update studio settings" 
ON public.studio_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- Only admins/owners can insert settings
CREATE POLICY "Admins can insert studio settings" 
ON public.studio_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'owner')
  )
);

-- Insert default values from studio config
INSERT INTO public.studio_settings (setting_key, setting_value) VALUES
('phones', '+91 94435 68486, +91 76398 88486'),
('primary_phone', '+91 94435 68486'),
('whatsapp', '+91 94435 68486'),
('email', 'ajantastudiopandalur@gmail.com'),
('landline', '04262 296411'),
('instagram', '@ajanta.photography'),
('instagram_url', 'https://instagram.com/ajanta.photography'),
('facebook', 'Ajanta Photography'),
('facebook_url', '#'),
('address_line1', 'GHSS School Junction'),
('address_line2', 'Pandalur, The Nilgiris'),
('pincode', '643233'),
('google_maps_url', 'https://maps.google.com/?q=GHSS+School+Junction+Pandalur+Nilgiris'),
('hours_weekdays', '9:00 AM - 7:00 PM'),
('hours_saturday', '9:00 AM - 7:00 PM'),
('hours_sunday', 'By appointment only');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_studio_settings_updated_at
BEFORE UPDATE ON public.studio_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();