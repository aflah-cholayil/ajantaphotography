import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, Image, Video, Trash2, Eye, Share2, CheckCircle, MoreVertical, 
  Users, Loader2, ScanFace, RefreshCw, Heart 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminFavorites } from '@/hooks/useAdminFavorites';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { MediaUploader } from '@/components/admin/MediaUploader';
import { AlbumStatusBadge } from '@/components/admin/AlbumStatusBadge';
import { ShareLinkDialog } from '@/components/admin/ShareLinkDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  client_id: string;
  face_processing_status?: string;
  clients: {
    id: string;
    event_name: string;
    event_date: string | null;
    user_id: string;
  };
  clientProfile?: {
    name: string;
    email: string;
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

interface Person {
  id: string;
  name: string;
  photo_count: number;
  is_hidden: boolean;
}

const AdminAlbumDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [album, setAlbum] = useState<Album | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteMediaId, setDeleteMediaId] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [isProcessingFaces, setIsProcessingFaces] = useState(false);
  const [faceProcessingStatus, setFaceProcessingStatus] = useState<string>('pending');
  
  // Admin favorites hook
  const { favorites, favoritesCount, isFavorited, favoritesByClient } = useAdminFavorites(id || '');

  const fetchAlbum = async () => {
    if (!id) return;

    try {
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          ready_at,
          client_id,
          face_processing_status,
          clients!inner(
            id,
            event_name,
            event_date,
            user_id
          )
        `)
        .eq('id', id)
        .single();

      if (albumError) throw albumError;

      let clientProfile = { name: 'Unknown', email: '' };
      if (albumData?.clients?.user_id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, email')
          .eq('user_id', albumData.clients.user_id)
          .single();
        
        if (profileData) {
          clientProfile = profileData;
        }
      }

      setAlbum({
        ...albumData,
        clientProfile,
      } as unknown as Album);
      
      setFaceProcessingStatus(albumData?.face_processing_status || 'pending');
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

  const fetchPeople = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase.functions.invoke('face-detection', {
        body: { action: 'get_people', albumId: id },
      });

      if (error) throw error;
      setPeople(data?.people || []);
      setFaceProcessingStatus(data?.processingStatus || 'pending');
    } catch (error) {
      console.error('Error fetching people:', error);
    }
  };

  useEffect(() => {
    fetchAlbum();
    fetchMedia();
    fetchPeople();
  }, [id]);

  // Poll for processing status while processing
  useEffect(() => {
    if (faceProcessingStatus === 'processing') {
      const interval = setInterval(() => {
        fetchPeople();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [faceProcessingStatus, id]);

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

      // Auto-trigger face detection when marked as ready
      if (newStatus === 'ready') {
        toast({
          title: 'Starting face detection',
          description: 'Analyzing photos for faces in the background...',
        });
        
        // Trigger face detection in background
        supabase.functions.invoke('face-detection', {
          body: { action: 'process_album', albumId: id },
        }).then(() => {
          setFaceProcessingStatus('processing');
        }).catch((err) => {
          console.error('Error starting face detection:', err);
        });
      }

      fetchAlbum();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleScanFaces = async () => {
    if (!id) return;

    setIsProcessingFaces(true);
    try {
      const { data, error } = await supabase.functions.invoke('face-detection', {
        body: { action: 'process_album', albumId: id },
      });

      if (error) throw error;

      toast({
        title: 'Face detection started',
        description: 'Analyzing photos for faces in the background...',
      });
      
      setFaceProcessingStatus('processing');
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start face detection',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingFaces(false);
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

  const getFaceStatusBadge = () => {
    switch (faceProcessingStatus) {
      case 'processing':
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 size={12} className="animate-spin" />
            Scanning Faces...
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <Users size={12} />
            {people.length} People Found
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1">
            Not Scanned
          </Badge>
        );
    }
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
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin/albums')}
            >
              <ArrowLeft size={20} />
            </Button>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-serif text-3xl font-light text-foreground">
                  {album?.title || 'Loading...'}
                </h1>
                {album && <AlbumStatusBadge status={album.status} />}
                {getFaceStatusBadge()}
              </div>
              {album && (
                <div className="mt-2 space-y-1">
                  <p className="text-muted-foreground">
                    {album.clientProfile?.name || 'Unknown'} • {album.clients.event_name}
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

          <div className="flex items-center gap-2 flex-wrap">
            {/* Face Scan Button */}
            <Button
              variant="outline"
              onClick={handleScanFaces}
              disabled={isProcessingFaces || faceProcessingStatus === 'processing'}
            >
              {isProcessingFaces || faceProcessingStatus === 'processing' ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : faceProcessingStatus === 'completed' ? (
                <RefreshCw size={16} className="mr-2" />
              ) : (
                <ScanFace size={16} className="mr-2" />
              )}
              {faceProcessingStatus === 'completed' ? 'Rescan Faces' : 'Scan for Faces'}
            </Button>

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
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
                <Users className="h-8 w-8 text-purple-500 opacity-80" />
                <div>
                  <p className="text-2xl font-light">{people.length}</p>
                  <p className="text-sm text-muted-foreground">People</p>
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
                <Heart className="h-8 w-8 text-rose-500 opacity-80" />
                <div>
                  <p className="text-2xl font-light">{favoritesCount}</p>
                  <p className="text-sm text-muted-foreground">Selections</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Share2 className="h-8 w-8 text-orange-500 opacity-80" />
                <div>
                  <p className="text-2xl font-light">0</p>
                  <p className="text-sm text-muted-foreground">Share Links</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client Selections Section */}
        {favoritesCount > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-xl font-light flex items-center gap-2">
                <Heart size={20} className="text-rose-500" />
                Client Selections ({favoritesCount} photos)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(favoritesByClient).map(([userId, { profile, mediaIds }]) => (
                  <div key={userId} className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Users size={16} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{profile?.name || 'Unknown Client'}</p>
                        <p className="text-xs text-muted-foreground">{profile?.email}</p>
                      </div>
                      <Badge variant="secondary" className="ml-auto">
                        {mediaIds.length} selections
                      </Badge>
                    </div>
                    <div className="grid grid-cols-6 md:grid-cols-10 gap-2">
                      {mediaIds.slice(0, 10).map((mediaId) => (
                        <div 
                          key={mediaId} 
                          className="aspect-square rounded-md overflow-hidden bg-muted relative"
                        >
                          {mediaUrls[mediaId] ? (
                            <img 
                              src={mediaUrls[mediaId]} 
                              alt="Selected"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Image size={14} className="text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute top-0.5 right-0.5">
                            <Heart size={10} className="text-rose-500 fill-rose-500" />
                          </div>
                        </div>
                      ))}
                      {mediaIds.length > 10 && (
                        <div className="aspect-square rounded-md bg-muted flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">+{mediaIds.length - 10}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* People Section (if any detected) */}
        {people.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-serif text-xl font-light flex items-center gap-2">
                <Users size={20} />
                Detected People ({people.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {people.map((person) => (
                  <div 
                    key={person.id} 
                    className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                      <Users size={24} className="text-primary" />
                    </div>
                    <span className="text-sm font-medium">{person.name}</span>
                    <span className="text-xs text-muted-foreground">{person.photo_count} photos</span>
                    {person.is_hidden && (
                      <Badge variant="secondary" className="text-xs">Hidden</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-serif text-xl font-light">Upload Media</CardTitle>
          </CardHeader>
          <CardContent>
            {id && (
              <MediaUploader 
                albumId={id} 
                onUploadComplete={fetchMedia}
                onTriggerFaceDetection={() => {
                  // Auto-trigger face detection after uploads
                  if (album?.status === 'ready') {
                    supabase.functions.invoke('face-detection', {
                      body: { action: 'process_album', albumId: id },
                    }).then(() => {
                      setFaceProcessingStatus('processing');
                    }).catch((err) => {
                      console.error('Error starting face detection:', err);
                    });
                  }
                }}
              />
            )}
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
                    
                    {/* Client Selection Indicator */}
                    {isFavorited(item.id) && (
                      <div className="absolute top-2 left-2 z-10">
                        <div className="bg-rose-500 text-white p-1 rounded-full shadow-lg">
                          <Heart size={12} className="fill-white" />
                        </div>
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
