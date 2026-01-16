-- Deny anonymous access to bookings table
CREATE POLICY "Deny anonymous access to bookings"
ON public.bookings
FOR SELECT
TO anon
USING (false);