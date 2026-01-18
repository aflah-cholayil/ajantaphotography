-- Create contact_messages table for storing contact form submissions
CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  phone TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Only admin users can view messages
CREATE POLICY "Admin users can view messages"
ON public.contact_messages
FOR SELECT
TO authenticated
USING (is_admin_user(auth.uid()));

-- Only admin users can update messages (mark as read/unread)
CREATE POLICY "Admin users can update messages"
ON public.contact_messages
FOR UPDATE
TO authenticated
USING (is_admin_user(auth.uid()));

-- Only admin users can delete messages
CREATE POLICY "Admin users can delete messages"
ON public.contact_messages
FOR DELETE
TO authenticated
USING (is_admin_user(auth.uid()));

-- Anyone can submit a contact message (public contact form)
CREATE POLICY "Anyone can submit contact message"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Enable realtime for bookings table to show new bookings instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

-- Enable realtime for contact_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_messages;