import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

type Work = Database['public']['Tables']['works']['Row'];

interface EditWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  work: Work | null;
  onSuccess: () => void;
}

const categories = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'pre-wedding', label: 'Pre-Wedding' },
  { value: 'event', label: 'Event' },
  { value: 'candid', label: 'Candid' },
  { value: 'other', label: 'Other' },
];

export const EditWorkDialog = ({ open, onOpenChange, work, onSuccess }: EditWorkDialogProps) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('wedding');
  const [showOnHome, setShowOnHome] = useState(false);
  const [showOnGallery, setShowOnGallery] = useState(true);
  const [status, setStatus] = useState<'active' | 'hidden'>('active');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (work) {
      setTitle(work.title);
      setDescription(work.description || '');
      setCategory(work.category);
      setShowOnHome(work.show_on_home);
      setShowOnGallery(work.show_on_gallery);
      setStatus(work.status);
    }
  }, [work]);

  const handleSave = async () => {
    if (!work || !title.trim()) {
      toast.error('Please provide a title');
      return;
    }

    setSaving(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in');
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/manage-work?action=update&id=${work.id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || null,
            category,
            show_on_home: showOnHome,
            show_on_gallery: showOnGallery,
            status,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update work');
      }

      toast.success('Work updated successfully!');
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Update error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update work');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Edit Work</DialogTitle>
          <DialogDescription>
            Update the details for this portfolio item
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title *</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter work title"
              disabled={saving}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              disabled={saving}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory} disabled={saving}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'hidden')} disabled={saving}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Visibility Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Show on Home Page</Label>
                <p className="text-sm text-muted-foreground">
                  Display in the featured gallery
                </p>
              </div>
              <Switch
                checked={showOnHome}
                onCheckedChange={setShowOnHome}
                disabled={saving}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Show on Gallery Page</Label>
                <p className="text-sm text-muted-foreground">
                  Display in the full portfolio
                </p>
              </div>
              <Switch
                checked={showOnGallery}
                onCheckedChange={setShowOnGallery}
                disabled={saving}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || saving}
              className="bg-primary hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
