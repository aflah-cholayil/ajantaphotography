-- Drop the problematic policies
DROP POLICY IF EXISTS "Deny anonymous access to bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;

-- Create a proper PERMISSIVE policy for admin SELECT access
-- With only this PERMISSIVE policy, non-admins (including anonymous) are denied by default
CREATE POLICY "Admins can view all bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));