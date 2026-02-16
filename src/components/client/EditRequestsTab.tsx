import { useState, useEffect, useCallback } from 'react';
import { Pencil, Loader2, Clock, Image } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface EditRequest {
  id: string;
  media_id: string;
  status: string;
  edit_notes: string | null;
  created_at: string;
  media?: {
    file_name: string;
    s3_key: string;
    s3_preview_key: string | null;
  };
}

interface EditRequestsTabProps {
  albumId: string;
}

// URL cache reuse
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const URL_CACHE_DURATION = 50 * 60 * 1000;

async function getSignedUrl(s3Key: string, albumId: string): Promise<string | null> {
  const cacheKey = `${albumId}:${s3Key}`;
  const cached = urlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  try {
    const { data, error } = await supabase.functions.invoke('s3-signed-url', {
      body: { s3Key, albumId },
    });
    if (error || !data?.url) return null;
    urlCache.set(cacheKey, { url: data.url, expiresAt: Date.now() + URL_CACHE_DURATION });
    return data.url;
  } catch {
    return null;
  }
}

export function EditRequestsTab({ albumId }: EditRequestsTabProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('edit_requests' as any)
        .select('id, media_id, status, edit_notes, created_at')
        .eq('album_id', albumId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const editRequests = (data || []) as unknown as EditRequest[];

      // Fetch media info for each request
      if (editRequests.length > 0) {
        const mediaIds = editRequests.map(r => r.media_id);
        const { data: mediaData } = await supabase
          .from('media')
          .select('id, file_name, s3_key, s3_preview_key')
          .in('id', mediaIds);

        const mediaMap = new Map((mediaData || []).map(m => [m.id, m]));
        editRequests.forEach(r => {
          r.media = mediaMap.get(r.media_id) as any;
        });

        // Fetch thumbnails
        const urls: Record<string, string> = {};
        for (const req of editRequests) {
          if (req.media) {
            const key = req.media.s3_preview_key || req.media.s3_key;
            const url = await getSignedUrl(key, albumId);
            if (url) urls[req.media_id] = url;
          }
        }
        setThumbnails(urls);
      }

      setRequests(editRequests);
    } catch (err) {
      console.error('Error fetching edit requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [albumId, user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <Pencil size={48} className="mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-muted-foreground">No edit requests yet.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Hover over a photo and click the edit icon to request edits.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {requests.map((req) => (
        <div key={req.id} className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="aspect-square bg-muted relative">
            {thumbnails[req.media_id] ? (
              <img
                src={thumbnails[req.media_id]}
                alt={req.media?.file_name || 'Photo'}
                className="w-full h-full object-cover"
                onError={() => setThumbnails(prev => { const u = { ...prev }; delete u[req.media_id]; return u; })}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Image size={24} className="text-muted-foreground" />
              </div>
            )}
            <div className="absolute top-2 right-2">
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Clock size={10} />
                Pending
              </Badge>
            </div>
          </div>
          <div className="p-3 space-y-1">
            <p className="text-xs text-muted-foreground truncate">{req.media?.file_name}</p>
            {req.edit_notes && (
              <p className="text-xs text-foreground line-clamp-2">{req.edit_notes}</p>
            )}
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(req.created_at), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
