import { useState, useEffect } from 'react';
import { FolderUp, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatBytes } from '@/lib/uploadEngine';

interface ClientOption {
  id: string;
  event_name: string;
  profiles: { name: string };
}

interface FolderUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  files: File[];
  folderName: string;
  onConfirm: (albumId: string, scanFaces: boolean) => void;
}

export const FolderUploadDialog = ({
  open,
  onOpenChange,
  files,
  folderName,
  onConfirm,
}: FolderUploadDialogProps) => {
  const { toast } = useToast();
  const [albumTitle, setAlbumTitle] = useState(folderName);
  const [clientId, setClientId] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [scanFaces, setScanFaces] = useState(true);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setAlbumTitle(folderName);
  }, [folderName]);

  useEffect(() => {
    if (open) {
      fetchClients();
    }
  }, [open]);

  const fetchClients = async () => {
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, event_name, user_id')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (clientsData && clientsData.length > 0) {
      const userIds = clientsData.map(c => c.user_id).filter(Boolean);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const profilesMap: Record<string, string> = {};
      profilesData?.forEach(p => { profilesMap[p.user_id] = p.name; });

      setClients(clientsData.map(c => ({
        ...c,
        profiles: { name: profilesMap[c.user_id] || 'Unknown' },
      })) as ClientOption[]);
    }
  };

  const photoCount = files.filter(f => f.type.startsWith('image/')).length;
  const videoCount = files.filter(f => f.type.startsWith('video/')).length;
  const totalSize = files.reduce((s, f) => s + f.size, 0);

  const handleCreate = async () => {
    if (!albumTitle.trim() || !clientId) return;

    setIsCreating(true);
    try {
      const { data, error } = await supabase.from('albums').insert({
        title: albumTitle.trim(),
        client_id: clientId,
        status: 'pending',
      }).select('id').single();

      if (error) throw error;

      toast({
        title: 'Album created',
        description: `Starting upload of ${files.length} files...`,
      });

      onOpenChange(false);
      onConfirm(data.id, scanFaces);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create album',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl flex items-center gap-2">
            <FolderUp size={24} className="text-primary" />
            Create Album from Folder
          </DialogTitle>
          <DialogDescription>
            {photoCount > 0 && `${photoCount} photos`}
            {photoCount > 0 && videoCount > 0 && ', '}
            {videoCount > 0 && `${videoCount} videos`}
            {' • '}{formatBytes(totalSize)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.profiles.name} — {c.event_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Album Title *</Label>
            <Input
              value={albumTitle}
              onChange={(e) => setAlbumTitle(e.target.value)}
              placeholder="Wedding Day Photos"
            />
          </div>

          <div className="space-y-2">
            <Label>Event Date (optional)</Label>
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Auto Scan Faces</Label>
            <Switch checked={scanFaces} onCheckedChange={setScanFaces} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !albumTitle.trim() || !clientId}
            className="btn-gold"
          >
            {isCreating ? 'Creating...' : 'Create & Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
