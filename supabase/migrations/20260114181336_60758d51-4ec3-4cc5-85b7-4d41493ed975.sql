-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'client');

-- Create enum for album status
CREATE TYPE public.album_status AS ENUM ('pending', 'ready');

-- Create enum for booking status
CREATE TYPE public.booking_status AS ENUM ('new', 'contacted', 'confirmed', 'cancelled');

-- Create enum for media type
CREATE TYPE public.media_type AS ENUM ('photo', 'video');

-- Create enum for email status
CREATE TYPE public.email_status AS ENUM ('sent', 'failed', 'pending');

-- =====================
-- PROFILES TABLE (linked to auth.users)
-- =====================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  must_change_password BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login TIMESTAMPTZ
);

-- Create index on email
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);

-- =====================
-- USER ROLES TABLE (separate for security)
-- =====================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- =====================
-- CLIENTS TABLE
-- =====================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_user_id ON public.clients(user_id);

-- =====================
-- ALBUMS TABLE
-- =====================
CREATE TABLE public.albums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_key TEXT,
  status album_status NOT NULL DEFAULT 'pending',
  ready_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_albums_client_id ON public.albums(client_id);
CREATE INDEX idx_albums_status ON public.albums(status);

-- =====================
-- MEDIA TABLE
-- =====================
CREATE TABLE public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  type media_type NOT NULL DEFAULT 'photo',
  s3_key TEXT NOT NULL,
  s3_preview_key TEXT,
  file_name TEXT NOT NULL,
  size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_media_album_id ON public.media(album_id);
CREATE INDEX idx_media_s3_key ON public.media(s3_key);

-- =====================
-- SHARE LINKS TABLE
-- =====================
CREATE TABLE public.share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  password_hash TEXT,
  allow_download BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  view_count INTEGER NOT NULL DEFAULT 0,
  download_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_share_links_token ON public.share_links(token);
CREATE INDEX idx_share_links_album_id ON public.share_links(album_id);

-- =====================
-- BOOKINGS TABLE
-- =====================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  phone TEXT,
  event_type TEXT NOT NULL,
  event_date DATE,
  message TEXT,
  status booking_status NOT NULL DEFAULT 'new',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_email ON public.bookings(client_email);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_created_at ON public.bookings(created_at DESC);

-- =====================
-- EMAIL LOGS TABLE
-- =====================
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_type TEXT NOT NULL,
  status email_status NOT NULL DEFAULT 'pending',
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_logs_to_email ON public.email_logs(to_email);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);

-- =====================
-- SECURITY DEFINER FUNCTION FOR ROLE CHECKING
-- =====================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
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

-- Function to get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- =====================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_albums_updated_at
  BEFORE UPDATE ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- TRIGGER: Auto-create profile on signup
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'must_change_password')::boolean, false)
  );
  
  -- Default role is client unless specified
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data ->> 'role')::app_role, 'client')
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- TRIGGER: Set ready_at when album marked ready
-- =====================
CREATE OR REPLACE FUNCTION public.handle_album_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ready' AND OLD.status = 'pending' THEN
    NEW.ready_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_album_ready
  BEFORE UPDATE ON public.albums
  FOR EACH ROW EXECUTE FUNCTION public.handle_album_ready();

-- =====================
-- VALIDATION TRIGGER: Share link expiry
-- =====================
CREATE OR REPLACE FUNCTION public.validate_share_link_expiry()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.expires_at IS NOT NULL AND NEW.expires_at <= now() THEN
    RAISE EXCEPTION 'Expiry date must be in the future';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_share_link_expiry_trigger
  BEFORE INSERT OR UPDATE ON public.share_links
  FOR EACH ROW EXECUTE FUNCTION public.validate_share_link_expiry();

-- =====================
-- ENABLE RLS ON ALL TABLES
-- =====================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- =====================
-- RLS POLICIES: Profiles
-- =====================
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- RLS POLICIES: User Roles
-- =====================
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- RLS POLICIES: Clients
-- =====================
CREATE POLICY "Clients can view their own record"
  ON public.clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all clients"
  ON public.clients FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create clients"
  ON public.clients FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update clients"
  ON public.clients FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete clients"
  ON public.clients FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- RLS POLICIES: Albums
-- =====================
CREATE POLICY "Clients can view their albums"
  ON public.albums FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients 
      WHERE clients.id = albums.client_id 
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all albums"
  ON public.albums FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage albums"
  ON public.albums FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- RLS POLICIES: Media
-- =====================
CREATE POLICY "Clients can view their album media"
  ON public.media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.albums
      JOIN public.clients ON clients.id = albums.client_id
      WHERE albums.id = media.album_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all media"
  ON public.media FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage media"
  ON public.media FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- RLS POLICIES: Share Links
-- =====================
CREATE POLICY "Clients can view share links for their albums"
  ON public.share_links FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.albums
      JOIN public.clients ON clients.id = albums.client_id
      WHERE albums.id = share_links.album_id
      AND clients.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all share links"
  ON public.share_links FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage share links"
  ON public.share_links FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clients can create share links for their albums"
  ON public.share_links FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.albums
      JOIN public.clients ON clients.id = albums.client_id
      WHERE albums.id = album_id
      AND clients.user_id = auth.uid()
    )
  );

-- =====================
-- RLS POLICIES: Bookings (public insert, admin manage)
-- =====================
CREATE POLICY "Anyone can create a booking"
  ON public.bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all bookings"
  ON public.bookings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bookings"
  ON public.bookings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bookings"
  ON public.bookings FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- RLS POLICIES: Email Logs (admin only)
-- =====================
CREATE POLICY "Admins can view email logs"
  ON public.email_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can insert email logs"
  ON public.email_logs FOR INSERT
  WITH CHECK (true);