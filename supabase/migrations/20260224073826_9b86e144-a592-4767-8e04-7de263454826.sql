
-- Create quotations table
CREATE TABLE public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number text UNIQUE NOT NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  event_type text,
  event_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_percentage numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  valid_until date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create quotation_items table
CREATE TABLE public.quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  description text,
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  display_order integer DEFAULT 0
);

-- Auto-generate quotation number function
CREATE OR REPLACE FUNCTION public.generate_quotation_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_year text;
  next_seq integer;
BEGIN
  current_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CASE 
      WHEN quotation_number LIKE 'AJ-' || current_year || '-%' 
      THEN CAST(split_part(quotation_number, '-', 3) AS integer)
      ELSE 0 
    END
  ), 0) + 1 INTO next_seq FROM public.quotations;
  
  NEW.quotation_number := 'AJ-' || current_year || '-' || lpad(next_seq::text, 4, '0');
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate quotation number on insert
CREATE TRIGGER set_quotation_number
  BEFORE INSERT ON public.quotations
  FOR EACH ROW
  WHEN (NEW.quotation_number IS NULL OR NEW.quotation_number = '')
  EXECUTE FUNCTION public.generate_quotation_number();

-- Trigger to update updated_at
CREATE TRIGGER update_quotations_updated_at
  BEFORE UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for quotations
CREATE POLICY "Staff can manage quotations"
  ON public.quotations FOR ALL
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Staff can view all quotations"
  ON public.quotations FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Deny anonymous access to quotations"
  ON public.quotations FOR SELECT
  USING (false);

-- RLS policies for quotation_items
CREATE POLICY "Staff can manage quotation items"
  ON public.quotation_items FOR ALL
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Staff can view all quotation items"
  ON public.quotation_items FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Deny anonymous access to quotation_items"
  ON public.quotation_items FOR SELECT
  USING (false);
