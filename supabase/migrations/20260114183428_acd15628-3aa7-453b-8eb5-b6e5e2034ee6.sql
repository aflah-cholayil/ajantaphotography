-- Add policy to deny anonymous access to bookings table
CREATE POLICY "Deny anonymous access to bookings"
ON public.bookings
FOR SELECT
TO anon
USING (false);

-- Add policy to deny anonymous access to user_roles table
CREATE POLICY "Deny anonymous access to user_roles"
ON public.user_roles
FOR SELECT
TO anon
USING (false);