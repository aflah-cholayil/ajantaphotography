-- Create enum for questionnaire status
CREATE TYPE public.questionnaire_status AS ENUM ('not_sent', 'sent', 'completed');

-- Create event_questionnaires table
CREATE TABLE public.event_questionnaires (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  status questionnaire_status NOT NULL DEFAULT 'not_sent',
  is_locked BOOLEAN NOT NULL DEFAULT false,
  is_editable BOOLEAN NOT NULL DEFAULT true,
  
  -- Event Details
  event_type TEXT,
  event_date DATE,
  venue_name TEXT,
  venue_location TEXT,
  event_start_time TIME,
  event_end_time TIME,
  
  -- Coverage Requirements
  photography_required BOOLEAN DEFAULT true,
  videography_required BOOLEAN DEFAULT false,
  drone_coverage BOOLEAN DEFAULT false,
  number_of_days INTEGER DEFAULT 1,
  
  -- Style Preferences
  photography_style TEXT[], -- Traditional, Candid, Cinematic, Documentary
  reference_links TEXT[],
  must_capture_moments TEXT,
  
  -- People Information
  primary_contact_names TEXT,
  important_family_members TEXT,
  vip_focus_list TEXT,
  
  -- Deliverables
  album_required BOOLEAN DEFAULT false,
  video_types TEXT[], -- Highlight, Full, Reels
  expected_delivery_timeline TEXT,
  
  -- Special Instructions
  venue_rules TEXT,
  cultural_notes TEXT,
  additional_instructions TEXT,
  
  -- Confirmation
  confirmed BOOLEAN DEFAULT false,
  submitted_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for token lookup
CREATE INDEX idx_questionnaires_token ON public.event_questionnaires(token);
CREATE INDEX idx_questionnaires_booking_id ON public.event_questionnaires(booking_id);

-- Enable RLS
ALTER TABLE public.event_questionnaires ENABLE ROW LEVEL SECURITY;

-- Public can view/update their own questionnaire via token (handled by edge function)
-- Staff can manage all questionnaires
CREATE POLICY "Staff can manage questionnaires"
ON public.event_questionnaires
FOR ALL
USING (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
WITH CHECK (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Staff can view all questionnaires"
ON public.event_questionnaires
FOR SELECT
USING (is_admin_user(auth.uid()));

-- Deny anonymous access
CREATE POLICY "Deny anonymous access to questionnaires"
ON public.event_questionnaires
FOR SELECT
USING (false);

-- Create trigger for updated_at
CREATE TRIGGER update_questionnaires_updated_at
BEFORE UPDATE ON public.event_questionnaires
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();