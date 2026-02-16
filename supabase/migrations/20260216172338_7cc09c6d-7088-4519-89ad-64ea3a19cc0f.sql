
ALTER TABLE public.edit_requests ADD COLUMN edited_s3_key TEXT NULL;
ALTER TABLE public.edit_requests ADD COLUMN edited_at TIMESTAMPTZ NULL;
ALTER TABLE public.edit_requests ADD COLUMN edited_by UUID NULL;
