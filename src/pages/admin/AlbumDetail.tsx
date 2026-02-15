import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  ArrowLeft, Image, Video, Trash2, Eye, Share2, CheckCircle, MoreVertical, 
  Users, Loader2, ScanFace, RefreshCw, Heart, Download, CheckSquare, Square, X, AlertCircle
} from 'lucide-react';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminFavorites } from '@/hooks/useAdminFavorites';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { MediaUploader } from '@/components/admin/MediaUploader';
import { AlbumStatusBadge } from '@/components/admin/AlbumStatusBadge';
import { ShareLinkDialog } from '@/components/admin/ShareLinkDialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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

const PAGE_SIZE = 200;

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
  const [isDownloadingSelections, setIsDownloadingSelections] = useState(false);

  // Pagination state
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showLargeAlbumWarning, setShowLargeAlbumWarning] = useState(true);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState<{ current: number; total: number } | null>(null);
  
  // Admin favorites hook
  const { favorites, favoritesCount, isFavorited, favoritesByClient } = useAdminFavorites(id || '');

  // Debounced gallery refresh for incremental uploads
  const uploadCountRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFileUploaded = useCallback(() => {
    uploadCountRef.current += 1;
    if (uploadCountRef.current % 10 === 0) {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        fetchMedia();
      }, 2000);
    }
  }, []);

  const fetchAlbum = async () => {
    if (!id) return;
    try {
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .select(`
          id, title, description, status, created_at, ready_at, client_id, face_processing_status,
          clients!inner(id, event_name, event_date, user_id)
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
        if (profileData) clientProfile = profileData;
      }
      setAlbum({ ...albumData, clientProfile } as unknown as Album);
      setFaceProcessingStatus(albumData?.face_processing_status || 'pending');
    } catch (error) {
      console.error('Error fetching album:', error);
      toast({ title: 'Error', description: 'Failed to load album', variant: 'destructive' });
    }
  };

  const fetchTotalCount = async () => {
    if (!id) return;
    const { count, error } = await supabase
      .from('media')
      .select('id', { count: 'exact', head: true })
      .eq('album_id', id);
    if (!error && count !== null) {
      setTotalCount(count);
    }
  };

  const fetchMedia = async (page = 0, append = false) => {
    if (!id) return;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    try {
      const { data, error } = await supabase
        .from('media')
        .select('*')
        .eq('album_id', id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      const newMedia = (data as Media[]) || [];
      if (append) {
        setMedia(prev => [...prev, ...newMedia]);
      } else {
        setMedia(newMedia);
      }
      setHasMore(newMedia.length === PAGE_SIZE);
      setCurrentPage(page);

      // Fetch signed URLs for new items
      const urls: Record<string, string> = {};
      for (const item of newMedia) {
        try {
          const { data: urlData } = await supabase.functions.invoke('s3-signed-url', {
            body: { s3Key: item.s3_key },
          });
          if (urlData?.url) urls[item.id] = urlData.url;
        } catch (e) {
          console.error('Error getting signed URL:', e);
        }
      }
      setMediaUrls(prev => append ? { ...prev, ...urls } : urls);
    } catch (error) {
      console.error('Error fetching media:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    fetchMedia(currentPage + 1, true).finally(() => setIsLoadingMore(false));
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
    fetchTotalCount();
    fetchPeople();
  }, [id]);

  useEffect(() => {
    if (faceProcessingStatus === 'processing') {
      const interval = setInterval(() => { fetchPeople(); }, 5000);
      return () => clearInterval(interval);
    }
  }, [faceProcessingStatus, id]);

  const handleUpdateStatus = async (newStatus: AlbumStatus) => {
    if (!id) return;
    try {
      const { error } = await supabase.from('albums').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast({ title: 'Status updated', description: `Album marked as ${newStatus}` });
      if (newStatus === 'ready') {
        toast({ title: 'Starting face detection', description: 'Analyzing photos for faces in the background...' });
        supabase.functions.invoke('face-detection', {
          body: { action: 'process_album', albumId: id },
        }).then(() => setFaceProcessingStatus('processing')).catch((err) => console.error('Error starting face detection:', err));
      }
      fetchAlbum();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleScanFaces = async () => {
    if (!id) return;
    setIsProcessingFaces(true);
    try {
      const { error } = await supabase.functions.invoke('face-detection', {
        body: { action: 'process_album', albumId: id },
      });
      if (error) throw error;
      toast({ title: 'Face detection started', description: 'Analyzing photos for faces in the background...' });
      setFaceProcessingStatus('processing');
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to start face detection', variant: 'destructive' });
    } finally {
      setIsProcessingFaces(false);
    }
  };

  const handleDeleteMedia = async () => {
    if (!deleteMediaId) return;
    try {
      const { error } = await supabase.functions.invoke('storage-cleanup', {
        body: { action: 'delete_media', mediaId: deleteMediaId },
      });
      if (error) throw error;
      toast({ title: 'Media deleted', description: 'The file has been removed from the album and S3 storage' });
      setDeleteMediaId(null);
      fetchMedia();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete media', variant: 'destructive' });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const handleDownloadSelections = async () => {
    if (favorites.length === 0) return;
    setIsDownloadingSelections(true);
    try {
      const zip = new JSZip();
      const uniqueMediaIds = [...new Set(favorites.map(f => f.media_id))];
      const selectedMedia = media.filter(m => uniqueMediaIds.includes(m.id));
      let downloadedCount = 0;
      for (const item of selectedMedia) {
        try {
          const { data: urlData } = await supabase.functions.invoke('s3-signed-url', { body: { s3Key: item.s3_key } });
          if (urlData?.url) {
            const response = await fetch(urlData.url);
            const blob = await response.blob();
            zip.file(item.file_name, blob);
            downloadedCount++;
          }
        } catch (err) {
          console.error(`Error downloading ${item.file_name}:`, err);
        }
      }
      if (downloadedCount > 0) {
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${album?.title || 'selections'}-client-picks.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: 'Download complete', description: `Downloaded ${downloadedCount} selected photos` });
      } else {
        toast({ title: 'No files downloaded', description: 'Could not download any of the selected files', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error creating ZIP:', error);
      toast({ title: 'Download failed', description: 'Failed to create ZIP file', variant: 'destructive' });
    } finally {
      setIsDownloadingSelections(false);
    }
  };

  const getFaceStatusBadge = () => {
    switch (faceProcessingStatus) {
      case 'processing':
        return (<Badge variant="secondary" className="gap-1"><Loader2 size={12} className="animate-spin" />Scanning Faces...</Badge>);
      case 'completed':
        return (<Badge variant="default" className="gap-1 bg-green-600"><Users size={12} />{people.length} People Found</Badge>);
      case 'failed':
        return (<Badge variant="destructive" className="gap-1">Failed</Badge>);
      default:
        return (<Badge variant="outline" className="gap-1">Not Scanned</Badge>);
    }
  };

  // Selection handlers
  const toggleSelection = (mediaId: string, index: number, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (shiftKey && lastClickedIndex !== null) {
        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);
        for (let i = start; i <= end; i++) {
          next.add(media[i].id);
        }
      } else {
        if (next.has(mediaId)) {
          next.delete(mediaId);
        } else {
          next.add(mediaId);
        }
      }
      return next;
    });
    setLastClickedIndex(index);
  };

  const selectAll = () => {
    setSelectedIds(new Set(media.map(m => m.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setLastClickedIndex(null);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    clearSelection();
  };

  const handleBulkDelete = async () => {
    if (!id || selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    setBulkDeleteProgress({ current: 0, total: selectedIds.size });

    try {
      const ids = Array.from(selectedIds);
      const { data, error } = await supabase.functions.invoke('storage-cleanup', {
        body: { action: 'bulk_delete_media', mediaIds: ids, albumId: id },
      });

      if (error) throw error;

      setBulkDeleteProgress({ current: selectedIds.size, total: selectedIds.size });

      toast({
        title: `${data.deletedCount} files deleted`,
        description: `Removed ${formatFileSize(data.totalSize)} from storage${data.peopleRemoved > 0 ? `. ${data.peopleRemoved} empty person groups removed.` : ''}`,
      });

      exitSelectionMode();
      setShowBulkDeleteConfirm(false);
      fetchMedia();
      fetchPeople();
    } catch (error: unknown) {
      toast({
        title: 'Bulk delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete selected files',
        variant: 'destructive',
      });
    } finally {
      setIsBulkDeleting(false);
      setBulkDeleteProgress(null);
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

  const selectedSize = media.filter(m => selectedIds.has(m.id)).reduce((sum, m) => sum + m.size, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/albums')}>
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
            {album && <ShareLinkDialog albumId={album.id} albumTitle={album.title} />}
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
                  <p className="text-2xl font-light">{totalCount || media.filter(m => m.type === 'photo').length}</p>
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
                  <p className="text-2xl font-light">{media.filter(m => m.type === 'video').length}</p>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-xl font-light flex items-center gap-2">
                <Heart size={20} className="text-rose-500" />
                Client Selections ({favoritesCount} photos)
              </CardTitle>
              <Button onClick={handleDownloadSelections} disabled={isDownloadingSelections} className="gap-2">
                {isDownloadingSelections ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Download All
              </Button>
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
                      <Badge variant="secondary" className="ml-auto">{mediaIds.length} selections</Badge>
                    </div>
                    <div className="grid grid-cols-6 md:grid-cols-10 gap-2">
                      {mediaIds.slice(0, 10).map((mediaId) => (
                        <div key={mediaId} className="aspect-square rounded-md overflow-hidden bg-muted relative">
                          {mediaUrls[mediaId] ? (
                            <img src={mediaUrls[mediaId]} alt="Selected" className="w-full h-full object-cover" />
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

        {/* People Section */}
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
                  <div key={person.id} className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
                      <Users size={24} className="text-primary" />
                    </div>
                    <span className="text-sm font-medium">{person.name}</span>
                    <span className="text-xs text-muted-foreground">{person.photo_count} photos</span>
                    {person.is_hidden && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Large Album Warning */}
        {totalCount > 3000 && showLargeAlbumWarning && (
          <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border border-border">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Large album detected ({totalCount.toLocaleString()} items). Performance may be reduced for very large albums.
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowLargeAlbumWarning(false)}>
              <X size={14} />
            </Button>
          </div>
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
                onUploadComplete={() => { uploadCountRef.current = 0; fetchMedia(); fetchTotalCount(); }}
                onTriggerFaceDetection={() => {
                  if (album?.status === 'ready') {
                    supabase.functions.invoke('face-detection', {
                      body: { action: 'process_album', albumId: id },
                    }).then(() => setFaceProcessingStatus('processing')).catch((err) => console.error('Error starting face detection:', err));
                  }
                }}
                onFileUploaded={handleFileUploaded}
              />
            )}
          </CardContent>
        </Card>

        {/* Media Grid */}
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="font-serif text-xl font-light">
                Gallery ({totalCount || media.length} items)
              </CardTitle>

              {media.length > 0 && (
                <div className="flex items-center gap-2">
                  {selectionMode ? (
                    <>
                      <span className="text-sm font-medium text-amber-600">
                        {selectedIds.size} selected
                        {selectedIds.size > 0 && (
                          <span className="text-muted-foreground font-normal ml-1">
                            ({formatFileSize(selectedSize)})
                          </span>
                        )}
                      </span>
                      <Button variant="outline" size="sm" onClick={selectAll}>
                        <CheckSquare size={14} className="mr-1" />
                        Select All
                      </Button>
                      <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedIds.size === 0}>
                        Clear
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBulkDeleteConfirm(true)}
                        disabled={selectedIds.size === 0}
                      >
                        <Trash2 size={14} className="mr-1" />
                        Delete Selected
                      </Button>
                      <Button variant="ghost" size="sm" onClick={exitSelectionMode}>
                        <X size={14} className="mr-1" />
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)}>
                      <CheckSquare size={14} className="mr-1" />
                      Select
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Bulk delete progress */}
            {isBulkDeleting && bulkDeleteProgress && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    Deleting {bulkDeleteProgress.total} files...
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round((bulkDeleteProgress.current / bulkDeleteProgress.total) * 100)}%
                  </span>
                </div>
                <Progress value={(bulkDeleteProgress.current / bulkDeleteProgress.total) * 100} />
              </div>
            )}
          </CardHeader>
          <CardContent>
            {media.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Image size={48} className="mx-auto mb-4 opacity-50" />
                <p>No media uploaded yet</p>
                <p className="text-sm mt-1">Drag and drop files above to get started</p>
              </div>
            ) : (
              <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {media.map((item, index) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <div 
                      key={item.id} 
                      className={`group relative aspect-square bg-muted rounded-lg overflow-hidden cursor-pointer transition-all duration-150 ${
                        isSelected ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-background' : ''
                      }`}
                      onClick={(e) => {
                        if (selectionMode) {
                          toggleSelection(item.id, index, e.shiftKey);
                        }
                      }}
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
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Video size={24} className="text-muted-foreground" />
                        </div>
                      )}

                      {/* Selection checkbox */}
                      {selectionMode && (
                        <div className="absolute top-2 left-2 z-20">
                          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected 
                              ? 'bg-amber-500 border-amber-500' 
                              : 'bg-black/40 border-white/80 hover:border-white'
                          }`}>
                            {isSelected && <CheckCircle size={16} className="text-white" />}
                          </div>
                        </div>
                      )}

                      {/* Client Selection Indicator */}
                      {isFavorited(item.id) && (
                        <div className={`absolute ${selectionMode ? 'top-2 left-10' : 'top-2 left-2'} z-10`}>
                          <div className="bg-rose-500 text-white p-1 rounded-full shadow-lg">
                            <Heart size={12} className="fill-white" />
                          </div>
                        </div>
                      )}
                      
                      {/* Hover overlay (only when NOT in selection mode) */}
                      {!selectionMode && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:text-destructive hover:bg-destructive/20"
                            onClick={(e) => { e.stopPropagation(); setDeleteMediaId(item.id); }}
                          >
                            <Trash2 size={18} />
                          </Button>
                        </div>
                      )}

                      {/* Info */}
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-xs truncate">{item.file_name}</p>
                        <p className="text-white/70 text-xs">{formatFileSize(item.size)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Load More button */}
              {hasMore && (
                <div className="flex justify-center pt-6">
                  <Button
                    variant="outline"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="gap-2"
                  >
                    {isLoadingMore ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : null}
                    {isLoadingMore ? 'Loading...' : `Load More (${media.length} of ${totalCount})`}
                  </Button>
                </div>
              )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Single Delete Confirmation */}
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

      {/* Bulk Delete Confirmation */}
      <DeleteConfirmDialog
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        title={`Delete ${selectedIds.size} Files`}
        description={`You are about to permanently delete ${selectedIds.size} files (${formatFileSize(selectedSize)}) from this album.`}
        warningItems={[
          'All original files from AWS S3 storage',
          'All preview/thumbnail versions',
          'Face detection data for these files',
          'Client selections (favorites) for these files',
        ]}
        confirmText="DELETE"
        isDeleting={isBulkDeleting}
        onConfirm={handleBulkDelete}
      />
    </AdminLayout>
  );
};

export default AdminAlbumDetail;
