ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS event_dates text[] DEFAULT '{}';

-- Migrate existing event_date values into event_dates array
UPDATE public.quotations 
SET event_dates = ARRAY[event_date::text] 
WHERE event_date IS NOT NULL AND (event_dates IS NULL OR event_dates = '{}');