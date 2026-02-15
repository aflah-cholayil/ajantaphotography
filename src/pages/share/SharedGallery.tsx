import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Image, Video, Download, X, ChevronLeft, ChevronRight, 
  FolderDown, Loader2, Lock, ZoomIn, ZoomOut, Play, AlertCircle
} from 'lucide-react';
import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface Media {
  id: string;
  file_name: string;
  s3_key: string;
  s3_preview_key: string | null;
  type: 'photo' | 'video';
  width: number | null;
  height: number | null;
  signedUrl?: string | null;
}

interface Album {
  id: string;
  title: string;
  description: string | null;
}

interface ShareLinkInfo {
  id: string;
  allowDownload: boolean;
  viewCount: number;
  downloadCount: number;
}

const PAGE_SIZE = 200;

const SharedGallery = () => {
  const { token } = useParams<{ token: string }>();
  const [album, setAlbum] = useState<Album | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [shareLink, setShareLink] = useState<ShareLinkInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeTab, setActiveTab] = useState('photos');
  const [retryCount, setRetryCount] = useState(0);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const photos = media.filter(m => m.type === 'photo');
  const videos = media.filter(m => m.type === 'video');

  // Verify share link exists and check password requirement
  const verifyShareLink = useCallback(async () => {
    if (!token) {
      setError('Invalid share link');
      setIsLoading(false);
      setIsVerifying(false);
      return;
    }

    const normalizedToken = token.trim();
    console.log('Verifying share link:', normalizedToken.substring(0, 8) + '...');

    try {
      const { data, error: funcError } = await supabase.functions.invoke('get-share-gallery', {
        body: { 
          token: normalizedToken, 
          action: 'verify' 
        },
      });

      if (funcError) {
        console.error('Function error:', funcError);
        if (retryCount < 2) {
          setRetryCount(prev => prev + 1);
          setTimeout(verifyShareLink, 1000);
          return;
        }
        setError('Unable to load gallery. Please try again.');
        setIsLoading(false);
        setIsVerifying(false);
        return;
      }

      if (data?.error) {
        console.log('Share link verification failed:', data.error);
        setError(data.error);
        setIsLoading(false);
        setIsVerifying(false);
        return;
      }

      if (data?.valid) {
        console.log('Share link valid, password required:', data.requiresPassword);
        if (data.requiresPassword) {
          setRequiresPassword(true);
          setIsLoading(false);
          setIsVerifying(false);
        } else {
          // No password required, load gallery directly
          await loadGallery();
        }
      } else {
        setError('This share link is invalid or has been removed');
        setIsLoading(false);
        setIsVerifying(false);
      }
    } catch (err) {
      console.error('Error verifying share link:', err);
      if (retryCount < 2) {
        setRetryCount(prev => prev + 1);
        setTimeout(verifyShareLink, 1000);
        return;
      }
      setError('Unable to load gallery. Please try again.');
      setIsLoading(false);
      setIsVerifying(false);
    }
  }, [token, retryCount]);

  // Load gallery data
  const loadGallery = async (providedPassword?: string, page = 0) => {
    if (!token) return;

    if (page === 0) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    const normalizedToken = token.trim();

    try {
      const { data, error: funcError } = await supabase.functions.invoke('get-share-gallery', {
        body: { 
          token: normalizedToken, 
          password: providedPassword || password,
          action: 'load',
          page,
          pageSize: PAGE_SIZE,
        },
      });

      if (funcError) {
        console.error('Load gallery error:', funcError);
        setError('An error occurred while loading the gallery');
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      if (data?.error) {
        if (data.requiresPassword) {
          setRequiresPassword(true);
          setIsLoading(false);
          setIsLoadingMore(false);
          return;
        }
        console.log('Load gallery failed:', data.error);
        setError(data.error);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      if (data?.album) {
        setAlbum(data.album);
        if (page === 0) {
          setMedia(data.media || []);
        } else {
          setMedia(prev => [...prev, ...(data.media || [])]);
        }
        setShareLink(data.shareLink);
        setTotalCount(data.totalCount || 0);
        setHasMore(data.hasMore || false);
        setCurrentPage(page);
        setIsAuthenticated(true);
        setIsVerifying(false);
        console.log('Gallery loaded successfully:', data.album.title, `page ${page}, total ${data.totalCount}`);
      } else {
        setError('This gallery does not exist');
      }
    } catch (err) {
      console.error('Error loading gallery:', err);
      setError('An error occurred while loading the gallery');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsVerifying(false);
    }
  };

  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    loadGallery(password, currentPage + 1);
  }, [isLoadingMore, hasMore, password, currentPage]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsLoading(true);
    await loadGallery(password);
  };

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          handleLoadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, handleLoadMore]);

  useEffect(() => {
    verifyShareLink();
  }, [verifyShareLink]);

  const handleDownload = async (item: Media) => {
    if (!shareLink?.allowDownload) {
      toast.error('Downloads are disabled for this gallery');
      return;
    }

    if (!token) return;

    try {
      toast.info('Preparing download...');
      const { data, error } = await supabase.functions.invoke('get-share-gallery', {
        body: { 
          token: token.trim(), 
          password,
          action: 'get-signed-url',
          s3Key: item.s3_key,
        },
      });
      
      if (data?.url) {
        const response = await fetch(data.url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = item.file_name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);
        toast.success(`Downloading ${item.file_name}`);
      } else {
        toast.error('Failed to generate download link');
      }
    } catch (err) {
      console.error('Error downloading:', err);
      toast.error('Failed to download file');
    }
  };

  const handleDownloadAll = async () => {
    if (!shareLink?.allowDownload || !album || !token) {
      toast.error('Downloads are disabled for this gallery');
      return;
    }

    setIsDownloadingAll(true);
    setDownloadProgress(0);

    try {
      const zip = new JSZip();
      const folder = zip.folder(album.title.replace(/[^a-zA-Z0-9]/g, '_'));
      
      if (!folder) throw new Error('Failed to create ZIP folder');

      let completed = 0;
      const total = media.length;

      for (const item of media) {
        try {
          const { data } = await supabase.functions.invoke('get-share-gallery', {
            body: { 
              token: token.trim(), 
              password,
              action: 'get-signed-url',
              s3Key: item.s3_key,
            },
          });

          if (data?.url) {
            const fileResponse = await fetch(data.url);
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
      });

      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${album.title.replace(/[^a-zA-Z0-9]/g, '_')}_gallery.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Downloaded ${media.length} files as ZIP`);
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

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  // Loading skeleton for gallery
  const GallerySkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  );

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-card border-border">
          <CardContent className="pt-6 text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-destructive" />
            <h1 className="font-serif text-2xl font-light text-foreground mb-2">
              Gallery Unavailable
            </h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link to="/">
              <Button variant="outline">Return to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password required state
  if (requiresPassword && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-card border-border">
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock size={32} className="text-primary" />
            </div>
            <CardTitle className="font-serif text-2xl font-light">Protected Gallery</CardTitle>
            <CardDescription>
              Enter the password to view this gallery
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="bg-muted/50 border-border"
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full btn-gold" disabled={isLoading || !password}>
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'View Gallery'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Initial loading state with skeleton
  if (isVerifying || (isLoading && !album)) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-4">
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="container mx-auto px-6 py-8">
          <div className="flex gap-4 mb-6">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          <GallerySkeleton />
        </main>
      </div>
    );
  }

  if (!album) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link to="/" className="block mb-2">
                <span className="font-serif text-xl font-light tracking-wider text-foreground">
                  Ajanta
                </span>
                <span className="text-[8px] uppercase tracking-[0.2em] text-primary font-sans font-medium ml-2">
                  Photography
                </span>
              </Link>
              <h1 className="font-serif text-lg font-light text-foreground">{album.title}</h1>
              {album.description && (
                <p className="text-sm text-muted-foreground">{album.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {shareLink?.allowDownload && media.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadAll}
                  disabled={isDownloadingAll}
                  className="gap-2"
                >
                  {isDownloadingAll ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span className="hidden sm:inline">Downloading...</span>
                    </>
                  ) : (
                    <>
                      <FolderDown size={16} />
                      <span className="hidden sm:inline">Download All</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Download Progress */}
      {isDownloadingAll && (
        <div className="container mx-auto px-6 py-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Preparing download...</span>
              <span className="text-sm text-muted-foreground">{downloadProgress}%</span>
            </div>
            <Progress value={downloadProgress} className="h-2" />
          </div>
        </div>
      )}

      {/* Gallery */}
      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 bg-card border border-border">
            <TabsTrigger value="photos" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Image size={16} />
              Photos ({totalCount > 0 ? photos.length + (hasMore ? '+' : '') : photos.length})
            </TabsTrigger>
            <TabsTrigger value="videos" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Video size={16} />
              Videos ({videos.length})
            </TabsTrigger>
          </TabsList>

          {/* Photos Tab */}
          <TabsContent value="photos">
            {photos.length === 0 ? (
              <div className="text-center py-16">
                <Image size={64} className="mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">No photos in this gallery.</p>
              </div>
            ) : (
              <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
                    className="aspect-square relative group cursor-pointer overflow-hidden rounded-lg bg-muted"
                    onClick={() => setSelectedMedia(item)}
                  >
                    {item.signedUrl ? (
                      <img
                        src={item.signedUrl}
                        alt={item.file_name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <Skeleton className="w-full h-full" />
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                    {shareLink?.allowDownload && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(item);
                        }}
                        className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                      >
                        <Download size={16} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
              {/* Sentinel for infinite scroll */}
              {hasMore && (
                <div ref={sentinelRef} className="flex justify-center py-6">
                  {isLoadingMore && (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}
              </>
            )}
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos">
            {videos.length === 0 ? (
              <div className="text-center py-16">
                <Video size={64} className="mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">No videos in this gallery.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="aspect-video relative group cursor-pointer overflow-hidden rounded-lg bg-muted"
                    onClick={() => setSelectedMedia(item)}
                  >
                    {item.signedUrl ? (
                      <video
                        src={item.signedUrl}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                      />
                    ) : (
                      <Skeleton className="w-full h-full" />
                    )}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play size={24} className="text-black ml-1" />
                      </div>
                    </div>
                    {shareLink?.allowDownload && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(item);
                        }}
                        className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                      >
                        <Download size={16} />
                      </button>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                      <p className="text-white text-sm truncate">{item.file_name}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-6 mt-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Ajanta Photography. All rights reserved.
          </p>
        </div>
      </footer>

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
            }}
          >
            {/* Close button */}
            <button
              onClick={() => {
                setSelectedMedia(null);
                setZoomLevel(1);
              }}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            >
              <X size={24} />
            </button>

            {/* Navigation */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateMedia('prev');
              }}
              className="absolute left-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            >
              <ChevronLeft size={32} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigateMedia('next');
              }}
              className="absolute right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            >
              <ChevronRight size={32} />
            </button>

            {/* Zoom controls for photos */}
            {selectedMedia.type === 'photo' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoom(-0.25);
                  }}
                  className="p-1 text-white hover:bg-white/20 rounded"
                >
                  <ZoomOut size={20} />
                </button>
                <span className="text-white text-sm w-16 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoom(0.25);
                  }}
                  className="p-1 text-white hover:bg-white/20 rounded"
                >
                  <ZoomIn size={20} />
                </button>
                {shareLink?.allowDownload && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(selectedMedia);
                    }}
                    className="p-1 text-white hover:bg-white/20 rounded ml-2"
                  >
                    <Download size={20} />
                  </button>
                )}
              </div>
            )}

            {/* Download button for videos */}
            {selectedMedia.type === 'video' && shareLink?.allowDownload && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(selectedMedia);
                  }}
                  className="gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <Download size={16} />
                  Download
                </Button>
              </div>
            )}

            {/* Media display */}
            <div
              className="max-w-[90vw] max-h-[85vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedMedia.type === 'photo' ? (
                <motion.img
                  key={selectedMedia.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={selectedMedia.signedUrl || ''}
                  alt={selectedMedia.file_name}
                  className="max-w-full max-h-[85vh] object-contain transition-transform duration-200"
                  style={{ transform: `scale(${zoomLevel})` }}
                />
              ) : (
                <motion.video
                  key={selectedMedia.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={selectedMedia.signedUrl || ''}
                  controls
                  autoPlay
                  className="max-w-full max-h-[85vh]"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SharedGallery;
