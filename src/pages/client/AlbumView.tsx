import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Image, Video, Download, X, ChevronLeft, ChevronRight, 
  FolderDown, Loader2, Check, ZoomIn, ZoomOut, Share2, Play, Pause
} from 'lucide-react';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ShareGalleryTab } from '@/components/client/ShareGalleryTab';

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
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('photos');

  const photos = media.filter(m => m.type === 'photo');
  const videos = media.filter(m => m.type === 'video');

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
              body: { s3Key: key, albumId: id },
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
      toast.info('Preparing download...');
      const response = await supabase.functions.invoke('s3-signed-url', {
        body: { s3Key: item.s3_key, albumId: id },
      });
      
      if (response.data?.url) {
        const link = document.createElement('a');
        link.href = response.data.url;
        link.download = item.file_name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Downloading ${item.file_name}`);
      }
    } catch (err) {
      console.error('Error downloading:', err);
      toast.error('Failed to download file');
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedItems.size === 0) {
      toast.error('No items selected');
      return;
    }

    const selectedMedia = media.filter(m => selectedItems.has(m.id));
    await downloadMultiple(selectedMedia);
    setSelectedItems(new Set());
    setIsSelectionMode(false);
  };

  const handleDownloadAll = async () => {
    if (media.length === 0 || !album) return;
    await downloadMultiple(media);
  };

  const downloadMultiple = async (items: Media[]) => {
    if (!album) return;

    setIsDownloadingAll(true);
    setDownloadProgress(0);

    try {
      const zip = new JSZip();
      const folder = zip.folder(album.title.replace(/[^a-zA-Z0-9]/g, '_'));
      
      if (!folder) {
        throw new Error('Failed to create ZIP folder');
      }

      let completed = 0;
      const total = items.length;

      for (const item of items) {
        try {
          const urlResponse = await supabase.functions.invoke('s3-signed-url', {
            body: { s3Key: item.s3_key, albumId: id },
          });

          if (urlResponse.data?.url) {
            const fileResponse = await fetch(urlResponse.data.url);
            if (fileResponse.ok) {
              const blob = await fileResponse.blob();
              folder.file(item.file_name, blob);
            }
          }
        } catch (err) {
          console.error(`Error downloading ${item.file_name}:`, err);
        }

        completed++;
        setDownloadProgress(Math.round((completed / total) * 100));
      }

      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      }, (metadata) => {
        if (metadata.percent) {
          setDownloadProgress(Math.round(metadata.percent));
        }
      });

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${album.title.replace(/[^a-zA-Z0-9]/g, '_')}_gallery.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${items.length} files as ZIP`);
    } catch (err) {
      console.error('Error creating ZIP:', err);
      toast.error('Failed to create ZIP file');
    } finally {
      setIsDownloadingAll(false);
      setDownloadProgress(0);
    }
  };

  const navigateMedia = (direction: 'prev' | 'next') => {
    if (!selectedMedia) return;
    const currentList = selectedMedia.type === 'photo' ? photos : videos;
    const currentIndex = currentList.findIndex(m => m.id === selectedMedia.id);
    const newIndex = direction === 'prev' 
      ? (currentIndex - 1 + currentList.length) % currentList.length
      : (currentIndex + 1) % currentList.length;
    setSelectedMedia(currentList[newIndex]);
    setZoomLevel(1);
  };

  const toggleSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = (type: 'photo' | 'video') => {
    const items = type === 'photo' ? photos : videos;
    const newSelected = new Set(selectedItems);
    items.forEach(item => newSelected.add(item.id));
    setSelectedItems(newSelected);
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setIsSelectionMode(false);
  };

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + delta)));
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

  // Show pending message if album is not ready
  if (album.status === 'pending') {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card sticky top-0 z-40">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/client')}>
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 className="font-serif text-xl font-light text-foreground">{album.title}</h1>
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-6 py-16">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Image size={40} className="text-primary" />
            </div>
            <h2 className="font-serif text-2xl font-light text-foreground mb-4">
              Your photos are being prepared...
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              We're carefully editing and curating your gallery. You'll receive a notification when your photos are ready to view.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <Button variant="ghost" size="icon" onClick={() => navigate('/client')} className="flex-shrink-0">
                <ArrowLeft size={20} />
              </Button>
              <div className="min-w-0">
                <h1 className="font-serif text-base sm:text-xl font-light text-foreground truncate">{album.title}</h1>
                {album.description && (
                  <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">{album.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {isSelectionMode && selectedItems.size > 0 && (
                <>
                  <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
                    {selectedItems.size} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadSelected}
                    className="gap-1 sm:gap-2 px-2 sm:px-3"
                  >
                    <Download size={14} />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearSelection} className="px-2 sm:px-3">
                    <X size={14} className="sm:hidden" />
                    <span className="hidden sm:inline">Clear</span>
                  </Button>
                </>
              )}
              {!isSelectionMode && media.length > 0 && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setIsSelectionMode(true)} className="px-2 sm:px-3">
                    <Check size={14} className="sm:mr-2" />
                    <span className="hidden sm:inline">Select</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadAll}
                    disabled={isDownloadingAll}
                    className="gap-1 sm:gap-2 px-2 sm:px-3"
                  >
                    {isDownloadingAll ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <FolderDown size={14} />
                    )}
                    <span className="hidden sm:inline">{isDownloadingAll ? 'Downloading...' : 'Download All'}</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Download Progress */}
      {isDownloadingAll && (
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="bg-card border border-border rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium">Preparing download...</span>
              <span className="text-xs sm:text-sm text-muted-foreground">{downloadProgress}%</span>
            </div>
            <Progress value={downloadProgress} className="h-2" />
          </div>
        </div>
      )}

      {/* Tabs */}
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 sm:mb-6 bg-card border border-border w-full sm:w-auto overflow-x-auto flex-nowrap">
            <TabsTrigger value="photos" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Image size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Photos</span> ({photos.length})
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Video size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Videos</span> ({videos.length})
            </TabsTrigger>
            <TabsTrigger value="share" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Share2 size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Share</span>
            </TabsTrigger>
          </TabsList>

          {/* Photos Tab */}
          <TabsContent value="photos">
            {isSelectionMode && photos.length > 0 && (
              <div className="flex items-center gap-4 mb-4">
                <Button variant="outline" size="sm" onClick={() => selectAll('photo')}>
                  Select All Photos
                </Button>
              </div>
            )}
            {photos.length === 0 ? (
              <div className="text-center py-12 sm:py-16">
                <Image size={48} className="mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm sm:text-base">No photos in this album yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                {photos.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    className="aspect-square relative group cursor-pointer overflow-hidden rounded-lg bg-muted"
                    onClick={() => !isSelectionMode && setSelectedMedia(item)}
                  >
                    {mediaUrls[item.id] ? (
                      <img
                        src={mediaUrls[item.id]}
                        alt={item.file_name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="animate-pulse w-full h-full bg-muted-foreground/10" />
                      </div>
                    )}
                    
                    {/* Selection checkbox */}
                    {isSelectionMode && (
                      <div 
                        className="absolute top-3 left-3 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(item.id);
                        }}
                      >
                        <Checkbox 
                          checked={selectedItems.has(item.id)}
                          className="h-6 w-6 border-2 border-white bg-black/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white hover:bg-white/20 backdrop-blur-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMedia(item);
                          }}
                        >
                          <ZoomIn size={20} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white hover:bg-white/20 backdrop-blur-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(item);
                          }}
                        >
                          <Download size={20} />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos">
            {isSelectionMode && videos.length > 0 && (
              <div className="flex items-center gap-4 mb-4">
                <Button variant="outline" size="sm" onClick={() => selectAll('video')}>
                  Select All Videos
                </Button>
              </div>
            )}
            {videos.length === 0 ? (
              <div className="text-center py-16">
                <Video size={64} className="mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">No videos in this album yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {videos.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    className="aspect-video relative group cursor-pointer overflow-hidden rounded-lg bg-muted"
                    onClick={() => !isSelectionMode && setSelectedMedia(item)}
                  >
                    {mediaUrls[item.id] ? (
                      <video
                        src={mediaUrls[item.id]}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video size={32} className="text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Play icon overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-primary transition-colors">
                        <Play size={24} className="text-white ml-1" />
                      </div>
                    </div>

                    {/* Selection checkbox */}
                    {isSelectionMode && (
                      <div 
                        className="absolute top-3 left-3 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(item.id);
                        }}
                      >
                        <Checkbox 
                          checked={selectedItems.has(item.id)}
                          className="h-6 w-6 border-2 border-white bg-black/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300">
                      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white hover:bg-white/20 backdrop-blur-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(item);
                          }}
                        >
                          <Download size={20} />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Share Gallery Tab */}
          <TabsContent value="share">
            <ShareGalleryTab albumId={album.id} albumTitle={album.title} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedMedia && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => {
              setSelectedMedia(null);
              setZoomLevel(1);
              setIsVideoPlaying(false);
            }}
          >
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 text-white hover:bg-white/10 z-10"
              onClick={() => {
                setSelectedMedia(null);
                setZoomLevel(1);
              }}
            >
              <X size={24} />
            </Button>

            {/* Zoom controls for photos */}
            {selectedMedia.type === 'photo' && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoom(-0.5);
                  }}
                >
                  <ZoomOut size={20} />
                </Button>
                <span className="text-white text-sm min-w-[60px] text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoom(0.5);
                  }}
                >
                  <ZoomIn size={20} />
                </Button>
              </div>
            )}
            
            {/* Navigation arrows */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-10"
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
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 z-10"
              onClick={(e) => {
                e.stopPropagation();
                navigateMedia('next');
              }}
            >
              <ChevronRight size={32} />
            </Button>

            {/* Media content */}
            <div 
              className="max-w-[90vw] max-h-[90vh] overflow-auto" 
              onClick={(e) => e.stopPropagation()}
            >
              {selectedMedia.type === 'photo' ? (
                mediaUrls[selectedMedia.id] ? (
                  <img
                    src={mediaUrls[selectedMedia.id]}
                    alt={selectedMedia.file_name}
                    className="max-w-full max-h-[90vh] object-contain transition-transform duration-300"
                    style={{ transform: `scale(${zoomLevel})` }}
                  />
                ) : (
                  <div className="w-96 h-96 bg-muted flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )
              ) : (
                mediaUrls[selectedMedia.id] ? (
                  <video
                    src={mediaUrls[selectedMedia.id]}
                    className="max-w-full max-h-[90vh]"
                    controls
                    autoPlay
                    onPlay={() => setIsVideoPlaying(true)}
                    onPause={() => setIsVideoPlaying(false)}
                  />
                ) : (
                  <div className="w-96 h-96 bg-muted flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )
              )}
            </div>

            {/* Bottom controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
              <span className="text-white text-sm">
                {(selectedMedia.type === 'photo' ? photos : videos).findIndex(m => m.id === selectedMedia.id) + 1} / {selectedMedia.type === 'photo' ? photos.length : videos.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="text-white border-white/30 hover:bg-white/10 bg-black/50"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(selectedMedia);
                }}
              >
                <Download size={16} className="mr-2" />
                Download
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="container mx-auto px-6 py-6 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Ajanta Photography. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default ClientAlbumView;
