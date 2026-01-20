import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, ChevronLeft, X, Download, ZoomIn, ZoomOut, ChevronRight,
  Loader2, RefreshCw, User, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Person {
  id: string;
  name: string;
  face_thumbnail_key: string | null;
  photo_count: number;
  is_hidden: boolean;
}

interface Media {
  id: string;
  file_name: string;
  s3_key: string;
  s3_preview_key: string | null;
  type: 'photo' | 'video';
  width: number | null;
  height: number | null;
}

interface PeopleTabProps {
  albumId: string;
  onDownload: (item: Media) => void;
}

// Cache for signed URLs
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const URL_CACHE_DURATION = 50 * 60 * 1000;

async function getSignedUrl(s3Key: string, albumId: string): Promise<string | null> {
  const cacheKey = `${albumId}:${s3Key}`;
  const cached = urlCache.get(cacheKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const response = await supabase.functions.invoke('s3-signed-url', {
      body: { s3Key, albumId },
    });

    if (response.data?.url) {
      urlCache.set(cacheKey, {
        url: response.data.url,
        expiresAt: Date.now() + URL_CACHE_DURATION,
      });
      return response.data.url;
    }
  } catch (err) {
    console.error('Error getting signed URL:', err);
  }
  return null;
}

type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed';

export function PeopleTab({ albumId, onDownload }: PeopleTabProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>('pending');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [personPhotos, setPersonPhotos] = useState<Media[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Fetch people for this album
  const fetchPeople = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('face-detection', {
        body: { action: 'get_people', albumId },
      });

      if (error) {
        console.error('Error fetching people:', error);
        toast.error('Failed to load people');
        return;
      }

      setPeople(data?.people || []);
      setProcessingStatus(data?.processingStatus || 'pending');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  // Poll for processing status while processing
  useEffect(() => {
    if (processingStatus === 'processing') {
      const interval = setInterval(fetchPeople, 5000);
      return () => clearInterval(interval);
    }
  }, [processingStatus, fetchPeople]);

  // Fetch photos for a selected person
  const handlePersonClick = useCallback(async (person: Person) => {
    setSelectedPerson(person);
    setIsLoadingPhotos(true);
    setPersonPhotos([]);
    setPhotoUrls({});

    try {
      const { data, error } = await supabase.functions.invoke('face-detection', {
        body: { action: 'get_person_photos', personId: person.id },
      });

      if (error) {
        console.error('Error fetching person photos:', error);
        toast.error('Failed to load photos');
        return;
      }

      const photos: Media[] = data?.media || [];
      setPersonPhotos(photos);

      // Fetch signed URLs for all photos
      const urls: Record<string, string> = {};
      for (const photo of photos) {
        const key = photo.s3_preview_key || photo.s3_key;
        const url = await getSignedUrl(key, albumId);
        if (url) {
          urls[photo.id] = url;
        }
      }
      setPhotoUrls(urls);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoadingPhotos(false);
    }
  }, [albumId]);

  const handleBack = () => {
    setSelectedPerson(null);
    setPersonPhotos([]);
    setPhotoUrls({});
  };

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  const navigateMedia = (direction: 'prev' | 'next') => {
    if (!selectedMedia) return;
    const currentIndex = personPhotos.findIndex(m => m.id === selectedMedia.id);
    const newIndex = direction === 'prev' 
      ? (currentIndex - 1 + personPhotos.length) % personPhotos.length
      : (currentIndex + 1) % personPhotos.length;
    setSelectedMedia(personPhotos[newIndex]);
    setZoomLevel(1);
  };

  // Processing status display
  const getStatusMessage = () => {
    switch (processingStatus) {
      case 'processing':
        return (
          <div className="flex items-center gap-2 text-primary">
            <Loader2 size={16} className="animate-spin" />
            <span>Scanning photos for faces...</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle size={16} />
            <span>Face detection failed. Please try again.</span>
          </div>
        );
      case 'completed':
        return null;
      default:
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users size={16} />
            <span>Face detection not yet started.</span>
          </div>
        );
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state - with status message
  if (people.length === 0) {
    return (
      <div className="text-center py-12 sm:py-16">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
          {processingStatus === 'processing' ? (
            <Loader2 size={40} className="text-primary animate-spin" />
          ) : (
            <Users size={40} className="text-muted-foreground" />
          )}
        </div>
        <h3 className="font-serif text-xl font-light text-foreground mb-2">
          {processingStatus === 'processing' 
            ? 'Scanning Photos...' 
            : processingStatus === 'completed'
              ? 'No Faces Detected'
              : 'No People Detected Yet'}
        </h3>
        <p className="text-muted-foreground text-sm max-w-md mx-auto mb-4">
          {processingStatus === 'processing'
            ? 'We\'re analyzing your photos to find and group people. This may take a few minutes.'
            : processingStatus === 'completed'
              ? 'No faces were found in the photos. This can happen with landscape or object photos.'
              : 'Face recognition will run automatically when photos are uploaded. Check back soon to see people grouped by their photos.'}
        </p>
        {processingStatus === 'processing' && (
          <Badge variant="secondary" className="gap-2">
            <Loader2 size={12} className="animate-spin" />
            Processing in background...
          </Badge>
        )}
      </div>
    );
  }

  // Person photos view
  if (selectedPerson) {
    return (
      <div>
        {/* Header with back button */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft size={20} />
          </Button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
            <User size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{selectedPerson.name}</h3>
            <p className="text-xs text-muted-foreground">{selectedPerson.photo_count} photos</p>
          </div>
        </div>

        {/* Loading photos */}
        {isLoadingPhotos ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : personPhotos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No photos found for this person.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
            {personPhotos.map((photo, index) => (
              <motion.div
                key={photo.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
                className="aspect-square relative group cursor-pointer overflow-hidden rounded-lg bg-muted"
                onClick={() => setSelectedMedia(photo)}
              >
                {photoUrls[photo.id] ? (
                  <img
                    src={photoUrls[photo.id]}
                    alt={photo.file_name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
                        setSelectedMedia(photo);
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
                        onDownload(photo);
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

              {/* Zoom controls */}
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

              {/* Image */}
              <div 
                className="max-w-[90vw] max-h-[90vh] overflow-auto" 
                onClick={(e) => e.stopPropagation()}
              >
                {photoUrls[selectedMedia.id] ? (
                  <img
                    src={photoUrls[selectedMedia.id]}
                    alt={selectedMedia.file_name}
                    className="max-w-full max-h-[90vh] object-contain transition-transform duration-300"
                    style={{ transform: `scale(${zoomLevel})` }}
                  />
                ) : (
                  <div className="w-96 h-96 bg-muted flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
              </div>

              {/* Bottom controls */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 z-10">
                <span className="text-white text-sm">
                  {personPhotos.findIndex(m => m.id === selectedMedia.id) + 1} / {personPhotos.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-white border-white/30 hover:bg-white/10 bg-black/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(selectedMedia);
                  }}
                >
                  <Download size={16} className="mr-2" />
                  Download
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // People grid (main view)
  return (
    <div>
      {/* Status message if processing */}
      {getStatusMessage() && (
        <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
          {getStatusMessage()}
        </div>
      )}
      
      <p className="text-sm text-muted-foreground mb-4">
        Tap a person to see all photos featuring them.
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4 sm:gap-6">
        {people.map((person, index) => (
          <motion.button
            key={person.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex flex-col items-center gap-2 group"
            onClick={() => handlePersonClick(person)}
          >
            {/* Face thumbnail circle */}
            <div className="relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center overflow-hidden ring-2 ring-transparent group-hover:ring-primary transition-all duration-300 group-hover:scale-105">
                {person.face_thumbnail_key ? (
                  <img 
                    src={person.face_thumbnail_key} 
                    alt={person.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User size={28} className="text-primary" />
                )}
              </div>
              {/* Photo count badge */}
              <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                {person.photo_count}
              </div>
            </div>
            {/* Person name */}
            <span className="text-xs sm:text-sm font-medium text-foreground truncate max-w-full group-hover:text-primary transition-colors">
              {person.name}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export default PeopleTab;
