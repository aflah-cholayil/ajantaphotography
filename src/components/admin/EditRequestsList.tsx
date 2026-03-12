import { useState, useEffect, useCallback, useRef } from 'react';
import { Pencil, Loader2, Clock, Image, Users, Download, Upload, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface EditRequest {
  id: string;
  media_id: string;
  user_id: string;
  status: string;
  edit_notes: string | null;
  created_at: string;
  edited_s3_key: string | null;
  edited_at: string | null;
}

interface EditRequestsListProps {
  albumId: string;
  mediaUrls: Record<string, string>;
  onCountChange?: (count: number) => void;
}

export function EditRequestsList({ albumId, mediaUrls, onCountChange }: EditRequestsListProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mediaNames, setMediaNames] = useState<Record<string, string>>({});
  const [mediaS3Keys, setMediaS3Keys] = useState<Record<string, string>>({});
  const [clientProfiles, setClientProfiles] = useState<Record<string, { name: string; email: string }>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [editedThumbnails, setEditedThumbnails] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingEditRequestId = useRef<string | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('edit_requests' as any)
        .select('id, media_id, user_id, status, edit_notes, created_at, edited_s3_key, edited_at')
        .eq('album_id', albumId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const editRequests = (data || []) as unknown as EditRequest[];
      setRequests(editRequests);
      onCountChange?.(editRequests.length);

      if (editRequests.length > 0) {
        const mediaIds = [...new Set(editRequests.map(r => r.media_id))];
        const { data: mediaData } = await supabase
          .from('media')
          .select('id, file_name, s3_key')
          .in('id', mediaIds);
        
        const names: Record<string, string> = {};
        const keys: Record<string, string> = {};
        (mediaData || []).forEach(m => {
          names[m.id] = m.file_name;
          keys[m.id] = m.s3_key;
        });
        setMediaNames(names);
        setMediaS3Keys(keys);

        const userIds = [...new Set(editRequests.map(r => r.user_id))];
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, name, email')
          .in('user_id', userIds);

        const profiles: Record<string, { name: string; email: string }> = {};
        (profileData || []).forEach(p => { profiles[p.user_id] = { name: p.name, email: p.email }; });
        setClientProfiles(profiles);

        // Fetch edited thumbnails for completed requests
        const completedRequests = editRequests.filter(r => r.status === 'completed' && r.edited_s3_key);
        for (const req of completedRequests) {
          if (req.edited_s3_key && req.edited_s3_key !== 'undefined' && req.edited_s3_key !== 'null') {
            try {
              const { data: urlData } = await supabase.functions.invoke('s3-signed-url', {
                body: { key: req.edited_s3_key, s3Key: req.edited_s3_key, albumId },
              });
              if (urlData?.url) {
                setEditedThumbnails(prev => ({ ...prev, [req.id]: urlData.url }));
              }
            } catch { /* ignore */ }
          }
        }
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

  const handleDownloadOriginal = async (req: EditRequest) => {
    const s3Key = mediaS3Keys[req.media_id];
    if (!s3Key || s3Key === 'undefined' || s3Key === 'null') {
      toast.error('Original file not found');
      return;
    }

    setDownloadingId(req.id);
    try {
      toast.info('Preparing download...');
      const { data, error } = await supabase.functions.invoke('s3-signed-url', {
        body: { key: s3Key, s3Key, albumId },
      });
      if (error || !data?.url) throw new Error('Failed to get signed URL');

      const response = await fetch(data.url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = mediaNames[req.media_id] || 'original';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Downloaded original');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download original');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleUploadEdited = (editRequestId: string) => {
    pendingEditRequestId.current = editRequestId;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const editRequestId = pendingEditRequestId.current;
    if (!file || !editRequestId || !user) return;

    // Reset input
    e.target.value = '';

    setUploadingId(editRequestId);
    try {
      // 1. Get presigned URL
      const { data: uploadData, error: uploadError } = await supabase.functions.invoke('upload-edited-media', {
        body: {
          editRequestId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        },
      });

      if (uploadError || !uploadData?.presignedUrl) {
        throw new Error(uploadData?.error || 'Failed to get upload URL');
      }

      // 2. Upload file to R2
      const uploadResponse = await fetch(uploadData.presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      // 3. Update edit request record
      const { error: updateError } = await supabase
        .from('edit_requests' as any)
        .update({
          edited_s3_key: uploadData.s3Key,
          edited_at: new Date().toISOString(),
          edited_by: user.id,
          status: 'completed',
        } as any)
        .eq('id', editRequestId);

      if (updateError) throw updateError;

      toast.success('Edited version uploaded successfully');
      fetchRequests(); // Refresh
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload edited version');
    } finally {
      setUploadingId(null);
      pendingEditRequestId.current = null;
    }
  };

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
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={handleFileSelected}
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {requests.map((req) => {
          const profile = clientProfiles[req.user_id];
          const isCompleted = req.status === 'completed';
          const isUploading = uploadingId === req.id;
          const isDownloading = downloadingId === req.id;
          const thumbnailUrl = isCompleted && editedThumbnails[req.id]
            ? editedThumbnails[req.id]
            : mediaUrls[req.media_id];

          return (
            <div key={req.id} className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="aspect-square bg-muted relative">
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt={mediaNames[req.media_id] || 'Photo'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image size={24} className="text-muted-foreground" />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  {isCompleted ? (
                    <Badge className="text-[10px] gap-1 bg-green-600 hover:bg-green-700 text-white border-0">
                      <CheckCircle2 size={10} />
                      Completed
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-500/90 text-white border-0">
                      <Clock size={10} />
                      Pending
                    </Badge>
                  )}
                </div>
              </div>
              <div className="p-2 space-y-1.5">
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
                {/* Action buttons */}
                <div className="flex gap-1.5 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] flex-1 px-1.5"
                    onClick={() => handleDownloadOriginal(req)}
                    disabled={isDownloading}
                  >
                    {isDownloading ? <Loader2 size={10} className="animate-spin" /> : <Download size={10} />}
                    <span className="ml-1">Original</span>
                  </Button>
                  {!isCompleted && (
                    <Button
                      size="sm"
                      className="h-7 text-[10px] flex-1 px-1.5"
                      onClick={() => handleUploadEdited(req.id)}
                      disabled={isUploading}
                    >
                      {isUploading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                      <span className="ml-1">Upload Edit</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
