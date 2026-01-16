-- Deny anonymous access to profiles table
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Deny anonymous access to share_links table
CREATE POLICY "Deny anonymous access to share_links"
ON public.share_links
FOR SELECT
TO anon
USING (false);

-- Deny anonymous access to user_roles table (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_roles' 
    AND policyname = 'Deny anonymous access to user_roles'
  ) THEN
    CREATE POLICY "Deny anonymous access to user_roles"
    ON public.user_roles
    FOR SELECT
    TO anon
    USING (false);
  END IF;
END $$;

-- Deny anonymous access to clients table (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'clients' 
    AND policyname = 'Deny anonymous access to clients'
  ) THEN
    CREATE POLICY "Deny anonymous access to clients"
    ON public.clients
    FOR SELECT
    TO anon
    USING (false);
  END IF;
END $$;

-- Deny anonymous access to albums table (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'albums' 
    AND policyname = 'Deny anonymous access to albums'
  ) THEN
    CREATE POLICY "Deny anonymous access to albums"
    ON public.albums
    FOR SELECT
    TO anon
    USING (false);
  END IF;
END $$;

-- Deny anonymous access to media table (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'media' 
    AND policyname = 'Deny anonymous access to media'
  ) THEN
    CREATE POLICY "Deny anonymous access to media"
    ON public.media
    FOR SELECT
    TO anon
    USING (false);
  END IF;
END $$;