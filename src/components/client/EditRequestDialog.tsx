import { useState } from 'react';
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

interface EditRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaId: string;
  albumId: string;
  thumbnailUrl?: string | null;
  fileName: string;
  onSuccess: (mediaId: string) => void;
}

export function EditRequestDialog({
  open,
  onOpenChange,
  mediaId,
  albumId,
  thumbnailUrl,
  fileName,
  onSuccess,
}: EditRequestDialogProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('edit_requests' as any).insert({
        media_id: mediaId,
        album_id: albumId,
        user_id: user.id,
        edit_notes: notes.trim() || null,
      });

      if (error) throw error;

      toast.success('Edit request submitted');
      onSuccess(mediaId);
      setNotes('');
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error submitting edit request:', err);
      if (err?.code === '23505') {
        toast.error('You already requested an edit for this photo');
      } else {
        toast.error('Failed to submit edit request');
      }
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
            Request Edit
          </DialogTitle>
          <DialogDescription>
            Request edits for this photo. Add optional notes for the editor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Thumbnail */}
          <div className="aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt={fileName} className="w-full h-full object-contain" />
            ) : (
              <p className="text-sm text-muted-foreground">{fileName}</p>
            )}
          </div>

          {/* Notes */}
          <Textarea
            placeholder="Describe what edits you'd like (optional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Pencil size={16} className="mr-2" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
