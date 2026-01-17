import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Image, Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface Media {
  id: string;
  file_name: string;
  s3_key: string;
  s3_preview_key: string | null;
  type: 'photo' | 'video';
  width: number | null;
  height: number | null;
}

interface Album {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'ready';
}

const ClientAlbumView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const [album, setAlbum] = useState<Album | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  const fetchAlbumData = useCallback(async () => {
    if (!id || !user) return;

    setIsLoading(true);
    try {
      // Fetch album
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .select('id, title, description, status')
        .eq('id', id)
        .maybeSingle();

      if (albumError) {
        console.error('Error fetching album:', albumError);
        navigate('/client');
        return;
      }

      if (!albumData) {
        navigate('/client');
        return;
      }

      setAlbum(albumData);

      // Fetch media
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('id, file_name, s3_key, s3_preview_key, type, width, height')
        .eq('album_id', id)
        .order('sort_order', { ascending: true });

      if (mediaError) {
        console.error('Error fetching media:', mediaError);
      } else if (mediaData) {
        setMedia(mediaData);
        
        // Generate signed URLs for all media
        const urls: Record<string, string> = {};
        for (const item of mediaData) {
          const key = item.s3_preview_key || item.s3_key;
          try {
            const response = await supabase.functions.invoke('s3-signed-url', {
              body: { key, operation: 'get' },
            });
            if (response.data?.url) {
              urls[item.id] = response.data.url;
            }
          } catch (err) {
            console.error('Error getting signed URL:', err);
          }
        }
        setMediaUrls(urls);
      }
    } catch (error) {
      console.error('Error in fetchAlbumData:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id, user, navigate]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/login');
        return;
      }
      if (role && role !== 'client') {
        navigate('/admin');
        return;
      }
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (user && role === 'client') {
      fetchAlbumData();
    }
  }, [user, role, fetchAlbumData]);

  const handleDownload = async (item: Media) => {
    try {
      const response = await supabase.functions.invoke('s3-signed-url', {
        body: { key: item.s3_key, operation: 'get' },
      });
      
      if (response.data?.url) {
        const link = document.createElement('a');
        link.href = response.data.url;
        link.download = item.file_name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error downloading:', err);
    }
  };

  const navigateMedia = (direction: 'prev' | 'next') => {
    if (!selectedMedia) return;
    const currentIndex = media.findIndex(m => m.id === selectedMedia.id);
    const newIndex = direction === 'prev' 
      ? (currentIndex - 1 + media.length) % media.length
      : (currentIndex + 1) % media.length;
    setSelectedMedia(media[newIndex]);
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!album) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/client')}>
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 className="font-serif text-xl font-light text-foreground">{album.title}</h1>
                {album.description && (
                  <p className="text-sm text-muted-foreground">{album.description}</p>
                )}
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              {media.length} photo{media.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </header>

      {/* Gallery Grid */}
      <main className="container mx-auto px-6 py-8">
        {media.length === 0 ? (
          <div className="text-center py-16">
            <Image size={64} className="mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No photos in this album yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {media.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="aspect-square relative group cursor-pointer overflow-hidden rounded-lg bg-muted"
                onClick={() => setSelectedMedia(item)}
              >
                {mediaUrls[item.id] ? (
                  <img
                    src={mediaUrls[item.id]}
                    alt={item.file_name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-pulse w-full h-full bg-muted-foreground/10" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(item);
                    }}
                  >
                    <Download size={20} />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Lightbox */}
      {selectedMedia && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setSelectedMedia(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
            onClick={() => setSelectedMedia(null)}
          >
            <X size={24} />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              navigateMedia('prev');
            }}
          >
            <ChevronLeft size={32} />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              navigateMedia('next');
            }}
          >
            <ChevronRight size={32} />
          </Button>

          <div className="max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            {mediaUrls[selectedMedia.id] ? (
              <img
                src={mediaUrls[selectedMedia.id]}
                alt={selectedMedia.file_name}
                className="max-w-full max-h-[90vh] object-contain"
              />
            ) : (
              <div className="w-96 h-96 bg-muted flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <span className="text-white text-sm">
              {media.findIndex(m => m.id === selectedMedia.id) + 1} / {media.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="text-white border-white/30 hover:bg-white/10"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(selectedMedia);
              }}
            >
              <Download size={16} className="mr-2" />
              Download
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientAlbumView;