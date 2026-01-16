-- Drop all existing policies on bookings
DROP POLICY IF EXISTS "Admins can delete bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can create a booking" ON public.bookings;

-- Create PERMISSIVE policies for proper access control

-- Only admins can view bookings (blocks anonymous SELECT)
CREATE POLICY "Admins can view all bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update bookings
CREATE POLICY "Admins can update bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete bookings
CREATE POLICY "Admins can delete bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone can create a booking (needed for public contact form)
-- This is intentional for the booking form to work without login
CREATE POLICY "Anyone can create a booking"
ON public.bookings
FOR INSERT
TO anon, authenticated
WITH CHECK (true);