-- 1. Create deletion audit log table
CREATE TABLE public.deletion_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deleted_by UUID NOT NULL,
  entity_type TEXT NOT NULL, -- 'client', 'album', 'media'
  entity_id UUID NOT NULL,
  entity_name TEXT,
  parent_entity_id UUID, -- for media -> album, album -> client reference
  parent_entity_name TEXT,
  s3_keys_deleted TEXT[], -- list of S3 keys that were deleted
  files_count INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.deletion_logs ENABLE ROW LEVEL SECURITY;

-- Only staff can view deletion logs
CREATE POLICY "Staff can view deletion logs" 
ON public.deletion_logs 
FOR SELECT 
USING (is_admin_user(auth.uid()));

-- Service role can insert logs (via edge function)
-- No direct insert policy for regular users

-- 2. Add expires_at column to albums with trigger for auto-calculation
ALTER TABLE public.albums 
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN is_deleted BOOLEAN DEFAULT false,
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN expiry_notified BOOLEAN DEFAULT false;

-- 3. Add soft delete columns to clients
ALTER TABLE public.clients 
ADD COLUMN is_deleted BOOLEAN DEFAULT false,
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

-- 4. Create index for expired albums query
CREATE INDEX idx_albums_expires_at ON public.albums (expires_at) WHERE expires_at IS NOT NULL AND is_deleted = false;
CREATE INDEX idx_albums_is_deleted ON public.albums (is_deleted) WHERE is_deleted = true;
CREATE INDEX idx_clients_is_deleted ON public.clients (is_deleted) WHERE is_deleted = true;

-- 5. Function to calculate album expiry date based on ready_at and settings
CREATE OR REPLACE FUNCTION public.calculate_album_expiry()
RETURNS TRIGGER AS $$
DECLARE
  expiry_days INTEGER;
BEGIN
  -- Only set expiry when album becomes ready
  IF NEW.status = 'ready' AND (OLD.status IS NULL OR OLD.status != 'ready') THEN
    -- Get expiry days from studio_settings
    SELECT COALESCE(setting_value::INTEGER, 90)
    INTO expiry_days
    FROM public.studio_settings
    WHERE setting_key = 'album_expiry_days';
    
    -- Default to 90 days if not set
    IF expiry_days IS NULL THEN
      expiry_days := 90;
    END IF;
    
    -- Only set expiry if expiry_days > 0 (0 means no expiry)
    IF expiry_days > 0 THEN
      NEW.expires_at := COALESCE(NEW.ready_at, now()) + (expiry_days || ' days')::INTERVAL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Create trigger for album expiry calculation
CREATE TRIGGER calculate_album_expiry_trigger
BEFORE INSERT OR UPDATE ON public.albums
FOR EACH ROW
EXECUTE FUNCTION public.calculate_album_expiry();

-- 7. Insert default album expiry setting (90 days)
INSERT INTO public.studio_settings (setting_key, setting_value)
VALUES ('album_expiry_days', '90')
ON CONFLICT (setting_key) DO NOTHING;