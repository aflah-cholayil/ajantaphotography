ALTER TABLE public.media ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'aws';
ALTER TABLE public.works ADD COLUMN storage_provider TEXT NOT NULL DEFAULT 'aws';