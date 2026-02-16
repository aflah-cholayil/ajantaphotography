import { useState, useEffect, useCallback } from 'react';
import { Pencil, Loader2, Clock, Image, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface EditRequest {
  id: string;
  media_id: string;
  user_id: string;
  status: string;
  edit_notes: string | null;
  created_at: string;
}

interface EditRequestsListProps {
  albumId: string;
  mediaUrls: Record<string, string>;
  onCountChange?: (count: number) => void;
}

export function EditRequestsList({ albumId, mediaUrls, onCountChange }: EditRequestsListProps) {
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mediaNames, setMediaNames] = useState<Record<string, string>>({});
  const [clientProfiles, setClientProfiles] = useState<Record<string, { name: string; email: string }>>({});

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('edit_requests' as any)
        .select('id, media_id, user_id, status, edit_notes, created_at')
        .eq('album_id', albumId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const editRequests = (data || []) as unknown as EditRequest[];
      setRequests(editRequests);
      onCountChange?.(editRequests.length);

      if (editRequests.length > 0) {
        // Fetch media file names
        const mediaIds = [...new Set(editRequests.map(r => r.media_id))];
        const { data: mediaData } = await supabase
          .from('media')
          .select('id, file_name')
          .in('id', mediaIds);
        
        const names: Record<string, string> = {};
        (mediaData || []).forEach(m => { names[m.id] = m.file_name; });
        setMediaNames(names);

        // Fetch client profiles
        const userIds = [...new Set(editRequests.map(r => r.user_id))];
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, name, email')
          .in('user_id', userIds);

        const profiles: Record<string, { name: string; email: string }> = {};
        (profileData || []).forEach(p => { profiles[p.user_id] = { name: p.name, email: p.email }; });
        setClientProfiles(profiles);
      }
    } catch (err) {
      console.error('Error fetching edit requests:', err);
    } finally {
      setIsLoading(false);
    }
  }, [albumId, onCountChange]);

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
        <p className="text-muted-foreground">No edit requests from clients yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {requests.map((req) => {
        const profile = clientProfiles[req.user_id];
        return (
          <div key={req.id} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="aspect-square bg-muted relative">
              {mediaUrls[req.media_id] ? (
                <img
                  src={mediaUrls[req.media_id]}
                  alt={mediaNames[req.media_id] || 'Photo'}
                  className="w-full h-full object-cover"
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
            <div className="p-2 space-y-1">
              {profile && (
                <div className="flex items-center gap-1">
                  <Users size={10} className="text-muted-foreground flex-shrink-0" />
                  <p className="text-xs font-medium truncate">{profile.name}</p>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground truncate">{mediaNames[req.media_id]}</p>
              {req.edit_notes && (
                <p className="text-xs text-foreground line-clamp-2">{req.edit_notes}</p>
              )}
              <p className="text-[10px] text-muted-foreground">
                {format(new Date(req.created_at), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
