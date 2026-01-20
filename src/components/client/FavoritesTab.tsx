import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Heart, Download, ZoomIn, Loader2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useMediaFavorites } from '@/hooks/useMediaFavorites';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Media {
  id: string;
  file_name: string;
  s3_key: string;
  s3_preview_key: string | null;
  type: 'photo' | 'video';
  width: number | null;
  height: number | null;
}

interface FavoritesTabProps {
  albumId: string;
  media: Media[];
  onMediaClick: (item: Media) => void;
  onDownload: (item: Media) => void;
}

// URL cache with expiry
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

interface FavoriteMediaItemProps {
  item: Media;
  albumId: string;
  index: number;
  onMediaClick: (item: Media) => void;
  onDownload: (item: Media) => void;
  onRemoveFavorite: (mediaId: string) => void;
}

const FavoriteMediaItem = memo(({ 
  item, 
  albumId, 
  index,
  onMediaClick, 
  onDownload,
  onRemoveFavorite
}: FavoriteMediaItemProps) => {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const fetchUrl = async () => {
      setIsLoading(true);
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
    const key = item.s3_preview_key || item.s3_key;
    urlCache.delete(`${albumId}:${key}`);
    setHasError(false);
    setIsLoading(true);
    setUrl(null);
    
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

  return (
    <motion.div
      ref={itemRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.3) }}
      className="aspect-square relative group cursor-pointer overflow-hidden rounded-lg bg-muted"
      onClick={() => onMediaClick(item)}
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

      {/* Image content */}
      {url && !hasError && (
        <img
          src={url}
          alt={item.file_name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onLoad={() => setIsLoading(false)}
        />
      )}

      {/* Heart badge - always visible */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemoveFavorite(item.id);
          }}
          className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
        >
          <Heart size={16} className="text-primary-foreground fill-current" />
        </button>
      </div>

      {/* Hover overlay */}
      {url && !hasError && (
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
          </div>
        </div>
      )}
    </motion.div>
  );
});

FavoriteMediaItem.displayName = 'FavoriteMediaItem';

export function FavoritesTab({ albumId, media, onMediaClick, onDownload }: FavoritesTabProps) {
  const { favorites, toggleFavorite, favoritesCount, clearAllFavorites, isLoading } = useMediaFavorites(albumId);
  
  // Filter media to only show favorites
  const favoritedMedia = media.filter(m => favorites.has(m.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (favoritedMedia.length === 0) {
    return (
      <div className="text-center py-12 sm:py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <Heart size={32} className="text-primary" />
        </div>
        <h3 className="font-serif text-xl font-light text-foreground mb-2">No selections yet</h3>
        <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
          Tap the heart icon on any photo to add it to your selections. Use this to mark your favorite shots for printing or sharing.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <Heart size={20} className="text-primary fill-current" />
          <span className="text-sm sm:text-base font-medium">
            {favoritesCount} {favoritesCount === 1 ? 'selection' : 'selections'}
          </span>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Trash2 size={14} />
              <span className="hidden sm:inline">Clear All</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all selections?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all {favoritesCount} photos from your selections. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={clearAllFavorites}>
                Clear All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Grid */}
      <div className="grid gap-2 sm:gap-3 lg:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {favoritedMedia.map((item, index) => (
          <FavoriteMediaItem
            key={item.id}
            item={item}
            albumId={albumId}
            index={index}
            onMediaClick={onMediaClick}
            onDownload={onDownload}
            onRemoveFavorite={toggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}

export default FavoritesTab;
