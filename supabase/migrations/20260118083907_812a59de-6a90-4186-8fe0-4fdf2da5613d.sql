-- Add client_id to email_logs for better tracking
ALTER TABLE public.email_logs 
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Add index for faster lookups by client
CREATE INDEX IF NOT EXISTS idx_email_logs_client_id ON public.email_logs(client_id);

-- Add index for faster lookups by to_email and template_type
CREATE INDEX IF NOT EXISTS idx_email_logs_to_email_template ON public.email_logs(to_email, template_type);