-- Step 3: Create helper function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'owner'
  )
$$;

-- Step 4: Create helper function to check if user has elevated admin role (owner, admin, editor, viewer)
CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin', 'editor', 'viewer')
  )
$$;

-- Step 5: Create a view for admin users (users with owner/admin/editor/viewer roles)
CREATE OR REPLACE VIEW public.admin_users_view
WITH (security_invoker=on) AS
SELECT 
  p.id,
  p.user_id,
  p.name,
  p.email,
  p.avatar_url,
  p.is_active,
  p.created_at,
  p.updated_at,
  p.last_login,
  ur.role
FROM public.profiles p
JOIN public.user_roles ur ON p.user_id = ur.user_id
WHERE ur.role IN ('owner', 'admin', 'editor', 'viewer');

-- Step 6: Create RLS policy for viewing admin users (owners only)
CREATE POLICY "Owners can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_owner(auth.uid()));

-- Step 7: Update existing admin user to owner role
UPDATE public.user_roles
SET role = 'owner'
WHERE role = 'admin'
  AND user_id = (
    SELECT user_id FROM public.user_roles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
  );

-- Step 8: Ensure user_roles allows owner to manage roles
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;
CREATE POLICY "Owners can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (is_owner(auth.uid()))
WITH CHECK (is_owner(auth.uid()));

-- Step 9: Allow owners to insert new profiles
CREATE POLICY "Owners can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (is_owner(auth.uid()));

-- Step 10: Update has_role function to also support new roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;