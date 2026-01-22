import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { Search, Plus, MoreVertical, Upload, Eye, Share2, CheckCircle, Trash2, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AlbumStatusBadge } from '@/components/admin/AlbumStatusBadge';
import { ShareLinkDialog } from '@/components/admin/ShareLinkDialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

type AlbumStatus = 'pending' | 'ready';

interface Album {
  id: string;
  title: string;
  description: string | null;
  status: AlbumStatus;
  created_at: string;
  ready_at: string | null;
  expires_at: string | null;
  client_id: string;
  clients: {
    id: string;
    event_name: string;
    profiles: {
      name: string;
    };
  };
  media: {
    id: string;
  }[];
}

interface ClientOption {
  id: string;
  event_name: string;
  profiles: {
    name: string;
  };
}

const AdminAlbums = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [albums, setAlbums] = useState<Album[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Create album dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumClientId, setNewAlbumClientId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Delete album state
  const [deleteAlbumId, setDeleteAlbumId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const clientFilter = searchParams.get('client');

  const fetchAlbums = async () => {
    try {
      let query = supabase
        .from('albums')
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          ready_at,
          expires_at,
          client_id,
          clients (
            id,
            event_name,
            user_id
          ),
          media(id)
        `)
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (clientFilter) {
        query = query.eq('client_id', clientFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch profiles for clients
      const userIds = (data || [])
        .map(a => a.clients?.user_id)
        .filter((id): id is string => !!id);
      
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);
        
        profilesData?.forEach(p => {
          profilesMap[p.user_id] = p.name;
        });
      }

      // Add profiles to albums
      const albumsWithProfiles = (data || []).map(album => ({
        ...album,
        clients: {
          ...album.clients,
          profiles: { name: profilesMap[album.clients?.user_id || ''] || 'Unknown' },
        },
      }));

      setAlbums(albumsWithProfiles as unknown as Album[]);
    } catch (error) {
      console.error('Error fetching albums:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClients = async () => {
    const { data: clientsData } = await supabase
      .from('clients')
      .select('id, event_name, user_id')
      .order('created_at', { ascending: false });
    
    if (clientsData && clientsData.length > 0) {
      const userIds = clientsData.map(c => c.user_id).filter(Boolean);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);
      
      const profilesMap: Record<string, string> = {};
      profilesData?.forEach(p => {
        profilesMap[p.user_id] = p.name;
      });

      const clientsWithProfiles = clientsData.map(c => ({
        ...c,
        profiles: { name: profilesMap[c.user_id] || 'Unknown' },
      }));
      
      setClients(clientsWithProfiles as unknown as ClientOption[]);
    } else {
      setClients([]);
    }
  };

  useEffect(() => {
    fetchAlbums();
    fetchClients();
  }, [clientFilter]);

  const handleCreateAlbum = async () => {
    if (!newAlbumTitle.trim() || !newAlbumClientId) return;
    
    setIsCreating(true);
    try {
      const { error } = await supabase.from('albums').insert({
        title: newAlbumTitle.trim(),
        client_id: newAlbumClientId,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Album created',
        description: 'The album has been created successfully',
      });

      setCreateDialogOpen(false);
      setNewAlbumTitle('');
      setNewAlbumClientId('');
      fetchAlbums();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create album',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateStatus = async (albumId: string, newStatus: AlbumStatus) => {
    try {
      const { error } = await supabase
        .from('albums')
        .update({ status: newStatus })
        .eq('id', albumId);

      if (error) throw error;

      toast({
        title: 'Status updated',
        description: `Album marked as ${newStatus}`,
      });

      fetchAlbums();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAlbum = async () => {
    if (!deleteAlbumId) return;
    const albumToDelete = albums.find(a => a.id === deleteAlbumId);
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('storage-cleanup', {
        body: { action: 'delete_album', albumId: deleteAlbumId },
      });
      if (error) throw error;
      toast({
        title: 'Album deleted',
        description: `"${albumToDelete?.title}" deleted. ${data?.mediaCount || 0} files removed.`,
      });
      setDeleteAlbumId(null);
      fetchAlbums();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to delete', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const getAlbumToDelete = () => albums.find(a => a.id === deleteAlbumId);

  const filteredAlbums = albums.filter((album) => {
    const matchesSearch = 
      album.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.clients.profiles.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.clients.event_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || album.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-light text-foreground">Albums</h1>
            <p className="text-muted-foreground mt-1">
              {clientFilter 
                ? `Showing albums for selected client`
                : 'Manage client photo galleries'
              }
            </p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gold">
                <Plus size={18} className="mr-2" />
                Create Album
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">Create New Album</DialogTitle>
                <DialogDescription>
                  Create a new photo album for a client
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={newAlbumClientId} onValueChange={setNewAlbumClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.profiles.name} - {client.event_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Album Title</Label>
                  <Input
                    placeholder="Wedding Day Photos"
                    value={newAlbumTitle}
                    onChange={(e) => setNewAlbumTitle(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setCreateDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateAlbum}
                    disabled={isCreating || !newAlbumTitle.trim() || !newAlbumClientId}
                    className="flex-1 btn-gold"
                  >
                    Create Album
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search albums..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>
          {clientFilter && (
            <Button variant="outline" onClick={() => navigate('/admin/albums')}>
              Clear filter
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Album</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Media</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading albums...
                  </TableCell>
                </TableRow>
              ) : filteredAlbums.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery || statusFilter !== 'all' 
                      ? 'No albums found matching your criteria' 
                      : 'No albums yet'
                    }
                  </TableCell>
                </TableRow>
              ) : (
                filteredAlbums.map((album) => (
                  <TableRow key={album.id} className="hover:bg-muted/20">
                    <TableCell>
                      <p className="font-medium">{album.title}</p>
                      {album.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {album.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{album.clients.profiles.name}</p>
                        <p className="text-sm text-muted-foreground">{album.clients.event_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <AlbumStatusBadge status={album.status} />
                    </TableCell>
                    <TableCell>
                      {album.media.length} item{album.media.length !== 1 ? 's' : ''}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(album.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/admin/albums/${album.id}`)}>
                            <Upload size={16} className="mr-2" />
                            Upload Media
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/admin/albums/${album.id}`)}>
                            <Eye size={16} className="mr-2" />
                            View Album
                          </DropdownMenuItem>
                          <ShareLinkDialog 
                            albumId={album.id} 
                            albumTitle={album.title}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Share2 size={16} className="mr-2" />
                                Create Share Link
                              </DropdownMenuItem>
                            }
                          />
                          <DropdownMenuSeparator />
                          {album.status !== 'ready' && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(album.id, 'ready')}>
                              <CheckCircle size={16} className="mr-2" />
                              Mark as Ready
                            </DropdownMenuItem>
                          )}
                          {album.status === 'ready' && (
                            <DropdownMenuItem onClick={() => handleUpdateStatus(album.id, 'pending')}>
                              <CheckCircle size={16} className="mr-2" />
                              Mark as Pending
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteAlbumId(album.id)}
                          >
                            <Trash2 size={16} className="mr-2" />
                            Delete Album
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Delete Album Dialog */}
        <DeleteConfirmDialog
          title="Delete Album"
          description="This will permanently delete this album and all media from AWS S3 storage."
          entityName={getAlbumToDelete()?.title}
          warningItems={[
            'All photos and videos in this album',
            'All share links for this album',
            'Face detection data and favorites',
          ]}
          confirmText="DELETE"
          isDeleting={isDeleting}
          onConfirm={handleDeleteAlbum}
          open={!!deleteAlbumId}
          onOpenChange={(open) => !open && setDeleteAlbumId(null)}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminAlbums;
