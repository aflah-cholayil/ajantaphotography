import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Image, Video, Trash2, Eye, Share2, CheckCircle, MoreVertical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { MediaUploader } from '@/components/admin/MediaUploader';
import { AlbumStatusBadge } from '@/components/admin/AlbumStatusBadge';
import { ShareLinkDialog } from '@/components/admin/ShareLinkDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type AlbumStatus = 'pending' | 'ready';

interface Album {
  id: string;
  title: string;
  description: string | null;
  status: AlbumStatus;
  created_at: string;
  ready_at: string | null;
  clients: {
    id: string;
    event_name: string;
    event_date: string | null;
    profiles: {
      name: string;
      email: string;
    };
  };
}

interface Media {
  id: string;
  file_name: string;
  mime_type: string;
  size: number;
  type: 'photo' | 'video';
  width: number | null;
  height: number | null;
  duration: number | null;
  s3_key: string;
  created_at: string;
}

const AdminAlbumDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [album, setAlbum] = useState<Album | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteMediaId, setDeleteMediaId] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});

  const fetchAlbum = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('albums')
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          ready_at,
          clients!inner(
            id,
            event_name,
            event_date,
            profiles!inner(name, email)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setAlbum(data as unknown as Album);
    } catch (error) {
      console.error('Error fetching album:', error);
      toast({
        title: 'Error',
        description: 'Failed to load album',
        variant: 'destructive',
      });
    }
  };

  const fetchMedia = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('album_id', id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMedia((data as Media[]) || []);
      
      // Fetch signed URLs for media
      const urls: Record<string, string> = {};
      for (const item of data || []) {
        try {
          const { data: urlData } = await supabase.functions.invoke('s3-signed-url', {
            body: { s3Key: item.s3_key },
          });
          if (urlData?.url) {
            urls[item.id] = urlData.url;
          }
        } catch (e) {
          console.error('Error getting signed URL:', e);
        }
      }
      setMediaUrls(urls);
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlbum();
    fetchMedia();
  }, [id]);

  const handleUpdateStatus = async (newStatus: AlbumStatus) => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from('albums')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Status updated',
        description: `Album marked as ${newStatus}`,
      });

      fetchAlbum();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMedia = async () => {
    if (!deleteMediaId) return;

    try {
      const { error } = await supabase
        .from('media')
        .delete()
        .eq('id', deleteMediaId);

      if (error) throw error;

      toast({
        title: 'Media deleted',
        description: 'The file has been removed from the album',
      });

      setDeleteMediaId(null);
      fetchMedia();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete media',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (!album && !isLoading) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Album not found</p>
          <Button variant="outline" onClick={() => navigate('/admin/albums')} className="mt-4">
            Back to Albums
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin/albums')}
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-3xl font-light text-foreground">
                  {album?.title || 'Loading...'}
                </h1>
                {album && <AlbumStatusBadge status={album.status} />}
              </div>
              {album && (
                <div className="mt-2 space-y-1">
                  <p className="text-muted-foreground">
                    {album.clients.profiles.name} • {album.clients.event_name}
                  </p>
                  {album.clients.event_date && (
                    <p className="text-sm text-muted-foreground">
                      Event: {format(new Date(album.clients.event_date), 'MMMM d, yyyy')}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {album && (
              <ShareLinkDialog albumId={album.id} albumTitle={album.title} />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreVertical size={16} className="mr-2" />
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {album?.status !== 'ready' && (
                  <DropdownMenuItem onClick={() => handleUpdateStatus('ready')}>
                    <CheckCircle size={16} className="mr-2" />
                    Mark as Ready
                  </DropdownMenuItem>
                )}
                {album?.status !== 'delivered' && (
                  <DropdownMenuItem onClick={() => handleUpdateStatus('delivered')}>
                    <CheckCircle size={16} className="mr-2" />
                    Mark as Delivered
                  </DropdownMenuItem>
                )}
                {album?.status !== 'pending' && (
                  <DropdownMenuItem onClick={() => handleUpdateStatus('pending')}>
                    <CheckCircle size={16} className="mr-2" />
                    Mark as Pending
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Image className="h-8 w-8 text-primary opacity-80" />
                <div>
                  <p className="text-2xl font-light">
                    {media.filter(m => m.type === 'photo').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Photos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Video className="h-8 w-8 text-blue-500 opacity-80" />
                <div>
                  <p className="text-2xl font-light">
                    {media.filter(m => m.type === 'video').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Videos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Eye className="h-8 w-8 text-green-500 opacity-80" />
                <div>
                  <p className="text-2xl font-light">0</p>
                  <p className="text-sm text-muted-foreground">Views</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Share2 className="h-8 w-8 text-purple-500 opacity-80" />
                <div>
                  <p className="text-2xl font-light">0</p>
                  <p className="text-sm text-muted-foreground">Share Links</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif text-xl font-light">Upload Media</CardTitle>
          </CardHeader>
          <CardContent>
            {id && <MediaUploader albumId={id} onUploadComplete={fetchMedia} />}
          </CardContent>
        </Card>

        {/* Media Grid */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif text-xl font-light">
              Gallery ({media.length} items)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {media.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Image size={48} className="mx-auto mb-4 opacity-50" />
                <p>No media uploaded yet</p>
                <p className="text-sm mt-1">Drag and drop files above to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {media.map((item) => (
                  <div 
                    key={item.id} 
                    className="group relative aspect-square bg-muted rounded-lg overflow-hidden"
                  >
                    {item.type === 'photo' ? (
                      mediaUrls[item.id] ? (
                        <img 
                          src={mediaUrls[item.id]} 
                          alt={item.file_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image size={24} className="text-muted-foreground" />
                        </div>
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video size={24} className="text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:text-destructive hover:bg-destructive/20"
                        onClick={() => setDeleteMediaId(item.id)}
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>

                    {/* Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-xs truncate">{item.file_name}</p>
                      <p className="text-white/70 text-xs">{formatFileSize(item.size)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteMediaId} onOpenChange={() => setDeleteMediaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Media</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this file? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMedia} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminAlbumDetail;
