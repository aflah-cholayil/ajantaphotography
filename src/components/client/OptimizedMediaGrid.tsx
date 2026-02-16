import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Image, Video, Download, ZoomIn, Play, Loader2, AlertCircle, RefreshCw, Heart, Pencil, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

interface Media {
  id: string;
  file_name: string;
  s3_key: string;
  s3_preview_key: string | null;
  type: 'photo' | 'video';
  width: number | null;
  height: number | null;
}

interface OptimizedMediaGridProps {
  media: Media[];
  albumId: string;
  isSelectionMode: boolean;
  selectedItems: Set<string>;
  onToggleSelection: (id: string) => void;
  onMediaClick: (item: Media) => void;
  onDownload: (item: Media) => void;
  type: 'photo' | 'video';
  favorites?: Set<string>;
  onToggleFavorite?: (id: string) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  editRequests?: Set<string>;
  onRequestEdit?: (item: Media) => void;
  completedEdits?: Set<string>;
}

interface MediaItemProps {
  item: Media;
  albumId: string;
  index: number;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onMediaClick: (item: Media) => void;
  onDownload: (item: Media) => void;
  isFavorited?: boolean;
  onToggleFavorite?: (id: string) => void;
  isEditRequested?: boolean;
  onRequestEdit?: (item: Media) => void;
  hasCompletedEdit?: boolean;
}

// Cache for signed URLs with expiry tracking
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const URL_CACHE_DURATION = 50 * 60 * 1000; // 50 minutes (URL expires in 1 hour)

async function getSignedUrl(s3Key: string, albumId: string, retryCount = 0): Promise<string | null> {
  const cacheKey = `${albumId}:${s3Key}`;
  const cached = urlCache.get(cacheKey);
  
  // Check if cached and not expired
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const response = await supabase.functions.invoke('s3-signed-url', {
      body: { s3Key, albumId },
    });

    // Don't retry on auth/access errors (403)
    if (response.error) {
      const status = (response.error as any)?.context?.status;
      if (status === 403 || status === 401) {
        console.warn('Access denied for signed URL:', s3Key);
        return null;
      }
      // Retry transient errors
      if (retryCount < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return getSignedUrl(s3Key, albumId, retryCount + 1);
      }
      return null;
    }

    if (response.data?.url) {
      urlCache.set(cacheKey, {
        url: response.data.url,
        expiresAt: Date.now() + URL_CACHE_DURATION,
      });
      return response.data.url;
    }
  } catch (err) {
    console.error('Error getting signed URL:', err);
    if (retryCount < 2) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return getSignedUrl(s3Key, albumId, retryCount + 1);
    }
  }
  return null;
}

// Individual media item component with lazy loading
const MediaItem = memo(({ 
  item, 
  albumId, 
  index, 
  isSelectionMode, 
  isSelected,
  onToggleSelection, 
  onMediaClick, 
  onDownload,
  isFavorited,
  onToggleFavorite,
  isEditRequested,
  onRequestEdit,
  hasCompletedEdit
}: MediaItemProps) => {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  // Intersection observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Start loading 100px before visible
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => {
      observer.disconnect();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Fetch URL when visible
  useEffect(() => {
    if (!isVisible) return;

    const fetchUrl = async () => {
      setIsLoading(true);
      setHasError(false);
      
      const key = item.s3_preview_key || item.s3_key;
      const signedUrl = await getSignedUrl(key, albumId);
      
      if (signedUrl) {
        setUrl(signedUrl);
      } else {
        setHasError(true);
      }
      setIsLoading(false);
    };

    fetchUrl();
  }, [isVisible, item.s3_key, item.s3_preview_key, albumId]);

  const handleRetry = useCallback(() => {
    // Clear cache for this item
    const key = item.s3_preview_key || item.s3_key;
    urlCache.delete(`${albumId}:${key}`);
    
    setHasError(false);
    setIsLoading(true);
    setUrl(null);
    
    // Re-fetch
    const fetchUrl = async () => {
      const signedUrl = await getSignedUrl(key, albumId);
      if (signedUrl) {
        setUrl(signedUrl);
      } else {
        setHasError(true);
      }
      setIsLoading(false);
    };
    
    fetchUrl();
  }, [item.s3_preview_key, item.s3_key, albumId]);

  const handleImageError = useCallback(() => {
    console.warn(`Image failed to load: ${item.id}`);
    // Auto-retry once after a delay
    if (!retryTimeoutRef.current) {
      retryTimeoutRef.current = setTimeout(() => {
        handleRetry();
        retryTimeoutRef.current = undefined;
      }, 2000);
    }
  }, [item.id, handleRetry]);

  const isPhoto = item.type === 'photo';
  const aspectClass = isPhoto ? 'aspect-square' : 'aspect-video';

  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3) }}
      className={`${aspectClass} relative group cursor-pointer overflow-hidden rounded-lg bg-muted`}
      onClick={() => !isSelectionMode && onMediaClick(item)}
    >
      {/* Loading skeleton */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="w-full h-full absolute inset-0" />
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground z-10" />
        </div>
      )}

      {/* Error state */}
      {hasError && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
          <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              handleRetry();
            }}
            className="text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Image/Video content */}
      {url && !hasError && (
        <>
          {isPhoto ? (
            <img
              src={url}
              alt={item.file_name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
              onError={handleImageError}
              onLoad={() => setIsLoading(false)}
            />
          ) : (
            <>
              <video
                src={url}
                className="w-full h-full object-cover"
                muted
                playsInline
                preload="auto"
                onError={handleImageError}
                onLoadedData={() => setIsLoading(false)}
              />
              {/* Play overlay for videos */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-primary transition-colors">
                  <Play size={20} className="text-white ml-0.5 sm:ml-1" />
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Selection checkbox */}
      {isSelectionMode && (
        <div 
          className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelection(item.id);
          }}
        >
          <Checkbox 
            checked={isSelected}
            className="h-5 w-5 sm:h-6 sm:w-6 border-2 border-white bg-black/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
          />
        </div>
      )}

      {/* Favorite heart button - for photos only */}
      {isPhoto && onToggleFavorite && !isSelectionMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.id);
          }}
          className={`absolute top-2 right-2 sm:top-3 sm:right-3 z-10 w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
            isFavorited 
              ? 'bg-primary text-primary-foreground shadow-lg scale-100' 
              : 'bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-primary hover:text-primary-foreground'
          }`}
          aria-label={isFavorited ? 'Remove from selections' : 'Add to selections'}
        >
          <Heart 
            size={16} 
            className={`transition-transform ${isFavorited ? 'fill-current scale-110' : ''}`} 
          />
        </button>
      )}

      {/* Edit requested badge */}
      {isEditRequested && !isSelectionMode && (
        <div className="absolute bottom-2 left-2 z-10">
          {hasCompletedEdit ? (
            <div className="bg-green-600 text-white px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1">
              <Sparkles size={10} />
              Edited
            </div>
          ) : (
            <div className="bg-amber-500 text-white px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1">
              <Pencil size={10} />
              Requested
            </div>
          )}
        </div>
      )}

      {/* Hover overlay */}
      {url && !hasError && !isSelectionMode && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 backdrop-blur-sm h-8 w-8 sm:h-10 sm:w-10"
              onClick={(e) => {
                e.stopPropagation();
                onMediaClick(item);
              }}
            >
              <ZoomIn size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 backdrop-blur-sm h-8 w-8 sm:h-10 sm:w-10"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(item);
              }}
            >
              <Download size={18} />
            </Button>
            {item.type === 'photo' && onRequestEdit && !isEditRequested && (
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-amber-500/80 backdrop-blur-sm h-8 w-8 sm:h-10 sm:w-10"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestEdit(item);
                }}
              >
                <Pencil size={18} />
              </Button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
});

MediaItem.displayName = 'MediaItem';

export function OptimizedMediaGrid({
  media,
  albumId,
  isSelectionMode,
  selectedItems,
  onToggleSelection,
  onMediaClick,
  onDownload,
  type,
  favorites,
  onToggleFavorite,
  hasMore,
  isLoadingMore,
  onLoadMore,
  editRequests,
  onRequestEdit,
  completedEdits,
}: OptimizedMediaGridProps) {
  const filteredMedia = media.filter(m => m.type === type);
  const isPhoto = type === 'photo';
  const sentinelRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!hasMore || !onLoadMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (filteredMedia.length === 0) {
    return (
      <div className="text-center py-12 sm:py-16">
        {isPhoto ? (
          <Image size={48} className="mx-auto mb-4 text-muted-foreground/30" />
        ) : (
          <Video size={48} className="mx-auto mb-4 text-muted-foreground/30" />
        )}
        <p className="text-muted-foreground text-sm sm:text-base">
          No {isPhoto ? 'photos' : 'videos'} in this album yet.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`grid gap-2 sm:gap-3 lg:gap-4 ${
        isPhoto 
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' 
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      }`}>
        {filteredMedia.map((item, index) => (
          <MediaItem
            key={item.id}
            item={item}
            albumId={albumId}
            index={index}
            isSelectionMode={isSelectionMode}
            isSelected={selectedItems.has(item.id)}
            onToggleSelection={onToggleSelection}
            onMediaClick={onMediaClick}
            onDownload={onDownload}
            isFavorited={favorites?.has(item.id)}
            onToggleFavorite={onToggleFavorite}
            isEditRequested={editRequests?.has(item.id)}
            onRequestEdit={onRequestEdit}
            hasCompletedEdit={completedEdits?.has(item.id)}
          />
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
  );
}

export default OptimizedMediaGrid;
