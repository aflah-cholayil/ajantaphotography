import { useState, useMemo } from 'react';
import { Pencil, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface BulkEditRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaIds: string[];
  albumId: string;
  existingEditRequests: Set<string>;
  onSuccess: (newMediaIds: string[]) => void;
}

export function BulkEditRequestDialog({
  open,
  onOpenChange,
  mediaIds,
  albumId,
  existingEditRequests,
  onSuccess,
}: BulkEditRequestDialogProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const eligibleIds = useMemo(
    () => mediaIds.filter((id) => !existingEditRequests.has(id)),
    [mediaIds, existingEditRequests]
  );

  const handleSubmit = async () => {
    if (!user || eligibleIds.length === 0) return;
    setIsSubmitting(true);

    try {
      const rows = eligibleIds.map((mediaId) => ({
        media_id: mediaId,
        album_id: albumId,
        user_id: user.id,
        edit_notes: notes.trim() || null,
      }));

      const { error } = await supabase
        .from('edit_requests' as any)
        .insert(rows);

      if (error) throw error;

      toast.success(`Edit requests submitted for ${eligibleIds.length} photo${eligibleIds.length > 1 ? 's' : ''}`);
      onSuccess(eligibleIds);
      setNotes('');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error submitting bulk edit requests:', err);
      toast.error('Failed to submit edit requests');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil size={18} />
            Bulk Edit Request
          </DialogTitle>
          <DialogDescription>
            Requesting edits for {eligibleIds.length} of {mediaIds.length} selected photo{mediaIds.length > 1 ? 's' : ''}.
            {mediaIds.length > eligibleIds.length && (
              <span className="block mt-1 text-xs">
                ({mediaIds.length - eligibleIds.length} already requested — skipped)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            placeholder="Describe what edits you'd like for these photos (optional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || eligibleIds.length === 0}>
            {isSubmitting ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Pencil size={16} className="mr-2" />
            )}
            Submit {eligibleIds.length} Request{eligibleIds.length > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
