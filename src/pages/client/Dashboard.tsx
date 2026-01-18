import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Image, Calendar, LogOut, User, FolderOpen, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlbumStatusBadge } from '@/components/admin/AlbumStatusBadge';

interface ClientData {
  id: string;
  event_name: string;
  event_date: string | null;
  notes: string | null;
}

interface Album {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'ready';
  created_at: string;
  ready_at: string | null;
  cover_image_key: string | null;
  media_count: number;
}

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { user, session, isLoading: authLoading, signOut, role } = useAuth();
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profileName, setProfileName] = useState<string>('');

  const fetchClientData = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Fetch client record
      const { data: clientRecord, error: clientError } = await supabase
        .from('clients')
        .select('id, event_name, event_date, notes')
        .eq('user_id', user.id)
        .maybeSingle();

      if (clientError) {
        console.error('Error fetching client:', clientError);
      }

      if (clientRecord) {
        setClientData(clientRecord);

        // Fetch albums for this client
        const { data: albumsData, error: albumsError } = await supabase
          .from('albums')
          .select('id, title, description, status, created_at, ready_at, cover_image_key')
          .eq('client_id', clientRecord.id)
          .order('created_at', { ascending: false });

        if (albumsError) {
          console.error('Error fetching albums:', albumsError);
        } else if (albumsData) {
          // Get media counts for each album
          const albumsWithCounts = await Promise.all(
            albumsData.map(async (album) => {
              const { count } = await supabase
                .from('media')
                .select('*', { count: 'exact', head: true })
                .eq('album_id', album.id);
              
              return {
                ...album,
                media_count: count || 0,
              };
            })
          );
          setAlbums(albumsWithCounts);
        }
      }

      // Fetch profile name
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileData) {
        setProfileName(profileData.name);
      }
    } catch (error) {
      console.error('Error in fetchClientData:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Redirect if not authenticated or not a client
    if (!authLoading) {
      if (!user) {
        navigate('/login');
        return;
      }
      // If user is admin, redirect to admin
      if (role && role !== 'client') {
        navigate('/admin');
        return;
      }
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (user && role === 'client') {
      fetchClientData();
    }
  }, [user, role, fetchClientData]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || role !== 'client') {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="block flex-shrink-0">
              <span className="font-serif text-xl sm:text-2xl font-light tracking-wider text-foreground">
                Ajanta
              </span>
              <span className="block text-[8px] sm:text-[9px] uppercase tracking-[0.2em] sm:tracking-[0.3em] text-primary font-sans font-medium">
                Client Portal
              </span>
            </Link>
            
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                <User size={16} />
                <span className="max-w-[150px] truncate">{profileName || user.email}</span>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/client/settings')}
                className="px-2 sm:px-3"
              >
                <Settings size={16} className="sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="px-2 sm:px-3">
                <LogOut size={16} className="sm:mr-2" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Welcome Section */}
          <div className="mb-6 sm:mb-8">
            <h1 className="font-serif text-2xl sm:text-3xl font-light text-foreground mb-1 sm:mb-2">
              Welcome, {profileName || 'Client'}!
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              View and access your photo galleries below.
            </p>
          </div>

          {/* Event Info Card */}
          {clientData && (
            <Card className="mb-6 sm:mb-8 bg-card border-border">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="font-serif text-lg sm:text-xl font-light flex items-center gap-2">
                  <Calendar className="text-primary" size={18} />
                  Your Event
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider mb-1">Event Name</p>
                    <p className="text-foreground font-medium text-sm sm:text-base">{clientData.event_name}</p>
                  </div>
                  {clientData.event_date && (
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider mb-1">Event Date</p>
                      <p className="text-foreground font-medium text-sm sm:text-base">
                        {format(new Date(clientData.event_date), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  )}
                </div>
                {clientData.notes && (
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-border">
                    <p className="text-xs sm:text-sm text-muted-foreground">{clientData.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Albums Section */}
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-light text-foreground mb-3 sm:mb-4 flex items-center gap-2">
              <FolderOpen className="text-primary" size={20} />
              Your Albums
            </h2>

            {albums.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-10 sm:py-12 text-center px-4">
                  <Image size={40} className="mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground text-sm sm:text-base">
                    No albums available yet. Your photos will appear here once they're ready.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {albums.map((album) => (
                  <motion.div
                    key={album.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card className="bg-card border-border hover:border-primary/50 transition-colors overflow-hidden">
                      {/* Album Cover */}
                      <div className="aspect-video bg-muted relative">
                        {album.cover_image_key ? (
                          <img
                            src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/s3-signed-url?key=${album.cover_image_key}`}
                            alt={album.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Image size={40} className="text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                          <AlbumStatusBadge status={album.status} />
                        </div>
                      </div>
                      
                      <CardHeader className="pb-2 p-3 sm:p-4">
                        <CardTitle className="font-serif text-base sm:text-lg font-light">{album.title}</CardTitle>
                        {album.description && (
                          <CardDescription className="line-clamp-2 text-xs sm:text-sm">{album.description}</CardDescription>
                        )}
                      </CardHeader>
                      
                      <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">
                            {album.media_count} photo{album.media_count !== 1 ? 's' : ''}
                          </span>
                          {album.ready_at && (
                            <span className="text-muted-foreground">
                              Ready {format(new Date(album.ready_at), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                        
                        {album.status === 'ready' && album.media_count > 0 && (
                          <Button 
                            className="w-full mt-3 sm:mt-4 btn-gold text-xs sm:text-sm py-2 sm:py-4" 
                            onClick={() => navigate(`/client/album/${album.id}`)}
                          >
                            View Gallery
                          </Button>
                        )}
                        
                        {album.status === 'pending' && (
                          <p className="text-xs sm:text-sm text-muted-foreground mt-3 sm:mt-4 text-center">
                            Your photos are being prepared...
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-8 sm:mt-12">
        <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6 text-center text-xs sm:text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Ajanta Photography. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default ClientDashboard;