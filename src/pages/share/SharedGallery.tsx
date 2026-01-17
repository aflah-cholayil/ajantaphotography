import { useState, useEffect, useCallback } from 'react';
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
import { toast } from 'sonner';

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
}

interface ShareLink {
  id: string;
  album_id: string;
  allow_download: boolean;
  expires_at: string | null;
  password_hash: string | null;
  view_count: number;
  download_count: number;
}

const SharedGallery = () => {
  const { token } = useParams<{ token: string }>();
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [album, setAlbum] = useState<Album | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeTab, setActiveTab] = useState('photos');

  const photos = media.filter(m => m.type === 'photo');
  const videos = media.filter(m => m.type === 'video');

  const verifyShareLink = useCallback(async () => {
    if (!token) {
      setError('Invalid share link');
      setIsLoading(false);
      return;
    }

    try {
      // Fetch share link details
      const { data: shareLinkData, error: shareLinkError } = await supabase
        .from('share_links')
        .select('*')
        .eq('token', token)
        .maybeSingle();

      if (shareLinkError || !shareLinkData) {
        setError('This share link is invalid or has been removed');
        setIsLoading(false);
        return;
      }

      // Check expiry
      if (shareLinkData.expires_at && new Date(shareLinkData.expires_at) < new Date()) {
        setError('This share link has expired');
        setIsLoading(false);
        return;
      }

      setShareLink(shareLinkData);

      // Check if password is required
      if (shareLinkData.password_hash) {
        setRequiresPassword(true);
        setIsLoading(false);
        return;
      }

      // No password required, load the gallery
      await loadGallery(shareLinkData);
    } catch (err) {
      console.error('Error verifying share link:', err);
      setError('An error occurred while loading the gallery');
      setIsLoading(false);
    }
  }, [token]);

  const loadGallery = async (link: ShareLink, providedPassword?: string) => {
    setIsLoading(true);
    try {
      // Fetch album
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .select('id, title, description')
        .eq('id', link.album_id)
        .maybeSingle();

      if (albumError || !albumData) {
        setError('Gallery not found');
        setIsLoading(false);
        return;
      }

      setAlbum(albumData);

      // Fetch media
      const { data: mediaData, error: mediaError } = await supabase
        .from('media')
        .select('id, file_name, s3_key, s3_preview_key, type, width, height')
        .eq('album_id', link.album_id)
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
              body: { 
                s3Key: key, 
                albumId: link.album_id,
                shareToken: token,
                sharePassword: providedPassword,
              },
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

      // Increment view count
      await supabase
        .from('share_links')
        .update({ view_count: link.view_count + 1 })
        .eq('id', link.id);

      setIsAuthenticated(true);
    } catch (err) {
      console.error('Error loading gallery:', err);
      setError('An error occurred while loading the gallery');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareLink || !password) return;

    setIsLoading(true);
    try {
      // Verify password via edge function
      const { data, error } = await supabase.functions.invoke('verify-share-password', {
        body: { token, password },
      });

      if (error || !data?.valid) {
        toast.error('Incorrect password');
        setIsLoading(false);
        return;
      }

      // Password verified, load gallery
      await loadGallery(shareLink, password);
    } catch (err) {
      console.error('Error verifying password:', err);
      toast.error('Failed to verify password');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    verifyShareLink();
  }, [verifyShareLink]);

  const handleDownload = async (item: Media) => {
    if (!shareLink?.allow_download) {
      toast.error('Downloads are disabled for this gallery');
      return;
    }

    try {
      toast.info('Preparing download...');
      const response = await supabase.functions.invoke('s3-signed-url', {
        body: { 
          s3Key: item.s3_key, 
          albumId: shareLink.album_id,
          shareToken: token,
          sharePassword: password,
        },
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

        // Increment download count
        await supabase
          .from('share_links')
          .update({ download_count: (shareLink.download_count || 0) + 1 })
          .eq('id', shareLink.id);
      }
    } catch (err) {
      console.error('Error downloading:', err);
      toast.error('Failed to download file');
    }
  };

  const handleDownloadAll = async () => {
    if (!shareLink?.allow_download || !album) {
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
          const urlResponse = await supabase.functions.invoke('s3-signed-url', {
            body: { 
              s3Key: item.s3_key, 
              albumId: shareLink.album_id,
              shareToken: token,
              sharePassword: password,
            },
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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading gallery...</p>
        </div>
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
              {shareLink?.allow_download && media.length > 0 && (
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
              Photos ({photos.length})
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    className="aspect-square relative group cursor-pointer overflow-hidden rounded-lg bg-muted"
                    onClick={() => setSelectedMedia(item)}
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
                        {shareLink?.allow_download && (
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
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {videos.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    className="aspect-video relative group cursor-pointer overflow-hidden rounded-lg bg-muted"
                    onClick={() => setSelectedMedia(item)}
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
                    
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-primary transition-colors">
                        <Play size={24} className="text-white ml-1" />
                      </div>
                    </div>

                    {shareLink?.allow_download && (
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
                    )}
                  </motion.div>
                ))}
              </div>
            )}
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
            }}
          >
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
                  />
                ) : (
                  <div className="w-96 h-96 bg-muted flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )
              )}
            </div>

            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
              <span className="text-white text-sm">
                {(selectedMedia.type === 'photo' ? photos : videos).findIndex(m => m.id === selectedMedia.id) + 1} / {selectedMedia.type === 'photo' ? photos.length : videos.length}
              </span>
              {shareLink?.allow_download && (
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
              )}
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

export default SharedGallery;
