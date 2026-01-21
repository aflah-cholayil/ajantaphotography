import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FavoriteWithProfile {
  id: string;
  media_id: string;
  user_id: string;
  created_at: string;
  profile?: {
    name: string;
    email: string;
  };
}

export function useAdminFavorites(albumId: string) {
  const [favorites, setFavorites] = useState<FavoriteWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!albumId) {
      setIsLoading(false);
      return;
    }

    try {
      // Fetch all favorites for this album
      const { data, error } = await supabase
        .from('media_favorites')
        .select('id, media_id, user_id, created_at')
        .eq('album_id', albumId);

      if (error) {
        console.error('Error fetching favorites:', error);
        setIsLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setFavorites([]);
        setIsLoading(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(data.map(f => f.user_id))];

      // Fetch profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);

      // Map profiles to favorites
      const profileMap = new Map(profiles?.map(p => [p.user_id, { name: p.name, email: p.email }]) || []);

      const favoritesWithProfiles = data.map(f => ({
        ...f,
        profile: profileMap.get(f.user_id),
      }));

      setFavorites(favoritesWithProfiles);
    } catch (err) {
      console.error('Error in fetchFavorites:', err);
    } finally {
      setIsLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Get count of unique favorited media
  const favoritedMediaIds = new Set(favorites.map(f => f.media_id));
  const favoritesCount = favoritedMediaIds.size;

  // Check if a media item is favorited by any client
  const isFavorited = useCallback((mediaId: string) => {
    return favoritedMediaIds.has(mediaId);
  }, [favorites]);

  // Get favorites grouped by client
  const favoritesByClient = favorites.reduce((acc, f) => {
    const key = f.user_id;
    if (!acc[key]) {
      acc[key] = {
        profile: f.profile,
        mediaIds: [],
      };
    }
    acc[key].mediaIds.push(f.media_id);
    return acc;
  }, {} as Record<string, { profile?: { name: string; email: string }; mediaIds: string[] }>);

  return {
    favorites,
    isLoading,
    favoritesCount,
    isFavorited,
    favoritesByClient,
    refetch: fetchFavorites,
  };
}
