import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface FavoriteItem {
  id: string;
  media_id: string;
  album_id: string;
  user_id: string;
  created_at: string;
}

export function useMediaFavorites(albumId: string) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Fetch favorites for this album
  const fetchFavorites = useCallback(async () => {
    if (!user || !albumId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('media_favorites')
        .select('media_id')
        .eq('album_id', albumId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching favorites:', error);
      } else if (data) {
        setFavorites(new Set(data.map(f => f.media_id)));
      }
    } catch (err) {
      console.error('Error in fetchFavorites:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, albumId]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Toggle favorite status
  const toggleFavorite = useCallback(async (mediaId: string) => {
    if (!user || !albumId) return;

    const isFavorited = favorites.has(mediaId);

    // Optimistic update
    const newFavorites = new Set(favorites);
    if (isFavorited) {
      newFavorites.delete(mediaId);
    } else {
      newFavorites.add(mediaId);
    }
    setFavorites(newFavorites);

    try {
      if (isFavorited) {
        // Remove favorite
        const { error } = await supabase
          .from('media_favorites')
          .delete()
          .eq('media_id', mediaId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Add favorite
        const { error } = await supabase
          .from('media_favorites')
          .insert({
            media_id: mediaId,
            album_id: albumId,
            user_id: user.id,
          });

        if (error) throw error;
        toast.success('Added to selections');
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
      // Revert optimistic update on error
      setFavorites(favorites);
      toast.error('Failed to update selection');
    }
  }, [user, albumId, favorites]);

  // Check if a media item is favorited
  const isFavorited = useCallback((mediaId: string) => {
    return favorites.has(mediaId);
  }, [favorites]);

  // Get count of favorites
  const favoritesCount = favorites.size;

  // Clear all favorites for this album
  const clearAllFavorites = useCallback(async () => {
    if (!user || !albumId || favorites.size === 0) return;

    const previousFavorites = new Set(favorites);
    setFavorites(new Set());

    try {
      const { error } = await supabase
        .from('media_favorites')
        .delete()
        .eq('album_id', albumId)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('All selections cleared');
    } catch (err) {
      console.error('Error clearing favorites:', err);
      setFavorites(previousFavorites);
      toast.error('Failed to clear selections');
    }
  }, [user, albumId, favorites]);

  return {
    favorites,
    isLoading,
    toggleFavorite,
    isFavorited,
    favoritesCount,
    clearAllFavorites,
    refetch: fetchFavorites,
  };
}
