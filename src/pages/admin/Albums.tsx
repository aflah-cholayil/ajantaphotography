import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Search, Plus, MoreVertical, Upload, Eye, Share2, CheckCircle, Trash2, FolderUp, ChevronDown, Calendar, Image, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AlbumStatusBadge } from '@/components/admin/AlbumStatusBadge';
import { ShareLinkDialog } from '@/components/admin/ShareLinkDialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { FolderUploadDialog } from '@/components/admin/FolderUploadDialog';
import { UploadEngine, type UploadEngineState } from '@/lib/uploadEngine';
import { UploadProgressPanel } from '@/components/admin/UploadProgressPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
    event_date: string | null;
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

interface ClientGroup {
  clientId: string;
  clientName: string;
  eventName: string;
  eventDate: string | null;
  albums: Album[];
  totalMedia: number;
  overallStatus: 'ready' | 'pending';
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
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [albumToMove, setAlbumToMove] = useState<Album | null>(null);
  const [targetClientId, setTargetClientId] = useState('');
  const [isMoving, setIsMoving] = useState(false);

  // Folder upload state
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState('');
  const [uploadState, setUploadState] = useState<UploadEngineState | null>(null);
  const engineRef = useRef<UploadEngine | null>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Collapsible open state
  const [openClients, setOpenClients] = useState<Record<string, boolean>>({});

  const isMediaFile = (file: File) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/x-msvideo'];
    return validTypes.includes(file.type) || /\.(jpg|jpeg|png|webp|heic|mp4|mov|avi)$/i.test(file.name);
  };

  const handleFolderSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(isMediaFile);
    if (files.length === 0) return;

    const firstPath = files[0]?.webkitRelativePath || '';
    const name = firstPath.split('/')[0] || 'Untitled Album';

    setFolderFiles(files);
    setFolderName(name);
    setFolderDialogOpen(true);
    e.target.value = '';
  }, []);

  const handleFolderUploadConfirm = useCallback((albumId: string, scanFaces: boolean) => {
    const engine = new UploadEngine(albumId, folderFiles, (state) => {
      setUploadState({ ...state });
    });
    engineRef.current = engine;

    engine.start().then(() => {
      fetchAlbums();
      if (scanFaces) {
        supabase.functions.invoke('face-detection', {
          body: { action: 'process_album', albumId },
        }).catch(err => console.error('Face detection error:', err));
      }
    });
  }, [folderFiles]);

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
            event_date,
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

  const openMoveDialog = (album: Album) => {
    setAlbumToMove(album);
    setTargetClientId(album.client_id);
    setMoveDialogOpen(true);
  };

  const handleMoveAlbum = async () => {
    if (!albumToMove || !targetClientId || targetClientId === albumToMove.client_id) return;

    setIsMoving(true);
    try {
      const { error } = await supabase
        .from('albums')
        .update({ client_id: targetClientId })
        .eq('id', albumToMove.id);

      if (error) throw error;

      toast({
        title: 'Album moved',
        description: `"${albumToMove.title}" was moved to the selected client.`,
      });

      setMoveDialogOpen(false);
      setAlbumToMove(null);
      setTargetClientId('');
      fetchAlbums();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to move album',
        variant: 'destructive',
      });
    } finally {
      setIsMoving(false);
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

  // Group filtered albums by client
  const clientGroups = useMemo<ClientGroup[]>(() => {
    const map: Record<string, ClientGroup> = {};
    
    filteredAlbums.forEach((album) => {
      const key = album.client_id;
      if (!map[key]) {
        map[key] = {
          clientId: key,
          clientName: album.clients.profiles.name,
          eventName: album.clients.event_name,
          eventDate: album.clients.event_date,
          albums: [],
          totalMedia: 0,
          overallStatus: 'ready',
        };
      }
      map[key].albums.push(album);
      map[key].totalMedia += album.media.length;
      if (album.status === 'pending') {
        map[key].overallStatus = 'pending';
      }
    });

    return Object.values(map);
  }, [filteredAlbums]);

  const handleCreateForClient = (clientId: string) => {
    setNewAlbumClientId(clientId);
    setNewAlbumTitle('');
    setCreateDialogOpen(true);
  };

  const toggleClient = (clientId: string) => {
    setOpenClients(prev => ({ ...prev, [clientId]: !prev[clientId] }));
  };

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
          <div className="flex gap-2">
            <input
              ref={folderInputRef}
              type="file"
              // @ts-ignore
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={handleFolderSelect}
            />
            <Button
              variant="outline"
              onClick={() => folderInputRef.current?.click()}
              disabled={uploadState?.isUploading}
              className="gap-2"
            >
              <FolderUp size={18} />
              Upload Folder
            </Button>
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
            </SelectContent>
          </Select>
          {clientFilter && (
            <Button variant="outline" onClick={() => navigate('/admin/albums')}>
              Clear filter
            </Button>
          )}
        </div>

        {/* Client-grouped cards */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading albums...</div>
        ) : clientGroups.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery || statusFilter !== 'all'
              ? 'No albums found matching your criteria'
              : 'No albums yet'}
          </div>
        ) : (
          <div className="space-y-4">
            {clientGroups.map((group) => (
              <Card key={group.clientId} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-foreground">{group.clientName}</h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{group.eventName}</span>
                        {group.eventDate && (
                          <>
                            <span className="text-border">•</span>
                            <span className="flex items-center gap-1">
                              <Calendar size={13} />
                              {format(new Date(group.eventDate), 'MMM d, yyyy')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <AlbumStatusBadge status={group.overallStatus} />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <Badge variant="secondary" className="text-xs">
                      {group.albums.length} Album{group.albums.length !== 1 ? 's' : ''}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Image size={12} className="mr-1" />
                      {group.totalMedia} Media
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <Collapsible
                    open={openClients[group.clientId] ?? false}
                    onOpenChange={() => toggleClient(group.clientId)}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground mb-2">
                        <span className="text-sm font-medium">Albums</span>
                        <ChevronDown
                          size={16}
                          className={`transition-transform duration-200 ${
                            openClients[group.clientId] ? 'rotate-180' : ''
                          }`}
                        />
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="space-y-1 mb-3">
                        {group.albums.map((album) => (
                          <div
                            key={album.id}
                            className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-muted/40 transition-colors group"
                          >
                            <button
                              onClick={() => navigate(`/admin/albums/${album.id}`)}
                              className="flex-1 text-left flex items-center gap-4 min-w-0"
                            >
                              <span className="font-medium text-sm text-foreground truncate">
                                {album.title}
                              </span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {album.media.length} item{album.media.length !== 1 ? 's' : ''}
                              </span>
                              <span className="text-xs text-muted-foreground shrink-0 hidden sm:inline">
                                {format(new Date(album.created_at), 'MMM d, yyyy')}
                              </span>
                              <AlbumStatusBadge status={album.status} />
                            </button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                >
                                  <MoreVertical size={14} />
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
                                <DropdownMenuItem onClick={() => openMoveDialog(album)}>
                                  <ArrowRightLeft size={16} className="mr-2" />
                                  Move to Client
                                </DropdownMenuItem>
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
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-1"
                    onClick={() => handleCreateForClient(group.clientId)}
                  >
                    <Plus size={14} className="mr-1.5" />
                    Create Album
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

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

        {/* Move Album Dialog */}
        <Dialog
          open={moveDialogOpen}
          onOpenChange={(open) => {
            setMoveDialogOpen(open);
            if (!open) {
              setAlbumToMove(null);
              setTargetClientId('');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Move Album to Client</DialogTitle>
              <DialogDescription>
                Select a different client for this album. Media files will remain linked to this album.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {albumToMove && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{albumToMove.title}</p>
                  <p className="text-muted-foreground text-xs mt-1">
                    Current: {albumToMove.clients.profiles.name} - {albumToMove.clients.event_name}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Target Client</Label>
                <Select value={targetClientId} onValueChange={setTargetClientId}>
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
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMoveDialogOpen(false)}
                  disabled={isMoving}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 btn-gold"
                  onClick={handleMoveAlbum}
                  disabled={
                    isMoving ||
                    !albumToMove ||
                    !targetClientId ||
                    targetClientId === albumToMove.client_id
                  }
                >
                  {isMoving ? 'Moving...' : 'Move Album'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Folder Upload Dialog */}
        <FolderUploadDialog
          open={folderDialogOpen}
          onOpenChange={setFolderDialogOpen}
          files={folderFiles}
          folderName={folderName}
          onConfirm={handleFolderUploadConfirm}
        />

        {/* Upload Progress */}
        {uploadState && uploadState.files.length > 0 && (
          <UploadProgressPanel
            state={uploadState}
            onCancel={() => engineRef.current?.cancel()}
            onRetryFailed={() => engineRef.current?.retryFailed()}
            onClear={() => setUploadState(null)}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAlbums;
