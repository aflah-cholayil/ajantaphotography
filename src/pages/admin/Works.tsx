import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  Image,
  Video,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Home,
  LayoutGrid,
  Loader2,
  MoreVertical,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UploadWorkDialog } from '@/components/admin/UploadWorkDialog';
import { EditWorkDialog } from '@/components/admin/EditWorkDialog';
import { Database } from '@/integrations/supabase/types';
import { format } from 'date-fns';

type Work = Database['public']['Tables']['works']['Row'];

const categoryLabels: Record<string, string> = {
  'wedding': 'Wedding',
  'pre-wedding': 'Pre-Wedding',
  'event': 'Event',
  'candid': 'Candid',
  'other': 'Other',
};

const Works = () => {
  const { isAdmin, isOwner, role } = useAuth();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<Work | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workToDelete, setWorkToDelete] = useState<Work | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const canEdit = role === 'owner' || role === 'admin' || role === 'editor';

  const fetchWorks = async () => {
    try {
      const { data, error } = await supabase
        .from('works')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorks(data || []);

      // Fetch signed URLs in parallel (first 20)
      const session = await supabase.auth.getSession();
      if (session.data.session && data) {
        const entries = await Promise.all(
          data.slice(0, 20).map(async (work) => {
            try {
              const response = await fetch(
                `${supabaseUrl}/functions/v1/manage-work?action=signed-url&key=${encodeURIComponent(work.s3_key)}`,
                {
                  headers: {
                    'Authorization': `Bearer ${session.data.session!.access_token}`,
                  },
                }
              );
              if (response.ok) {
                const { url } = await response.json();
                return [work.id, url] as const;
              }
            } catch { /* skip */ }
            return null;
          })
        );
        const urls: Record<string, string> = {};
        for (const entry of entries) {
          if (entry) urls[entry[0]] = entry[1];
        }
        setImageUrls(urls);
      }
    } catch (error) {
      console.error('Error fetching works:', error);
      toast.error('Failed to load works');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorks();
  }, []);

  const handleEdit = (work: Work) => {
    setSelectedWork(work);
    setEditDialogOpen(true);
  };

  const handleToggleStatus = async (work: Work) => {
    const newStatus = work.status === 'active' ? 'hidden' : 'active';
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/manage-work?action=update&id=${work.id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) throw new Error('Failed to update status');

      toast.success(`Work ${newStatus === 'active' ? 'shown' : 'hidden'}`);
      fetchWorks();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteClick = (work: Work) => {
    setWorkToDelete(work);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!workToDelete) return;

    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/manage-work?action=delete&id=${workToDelete.id}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Failed to delete work');

      toast.success('Work deleted successfully');
      setDeleteDialogOpen(false);
      setWorkToDelete(null);
      fetchWorks();
    } catch (error) {
      toast.error('Failed to delete work');
    } finally {
      setDeleting(false);
    }
  };

  // Filter works
  const filteredWorks = works.filter((work) => {
    const matchesSearch = work.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || work.category === categoryFilter;
    const matchesType = typeFilter === 'all' || work.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || work.status === statusFilter;
    return matchesSearch && matchesCategory && matchesType && matchesStatus;
  });

  if (!isAdmin && !isOwner) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">You don't have access to this page.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Works / Portfolio</h1>
          <p className="text-muted-foreground mt-1">Manage your portfolio gallery</p>
        </div>
        {canEdit && (
          <Button onClick={() => setUploadDialogOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="mr-2 h-4 w-4" />
            Upload New Work
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search works..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="wedding">Wedding</SelectItem>
            <SelectItem value="pre-wedding">Pre-Wedding</SelectItem>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="candid">Candid</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="photo">Photo</SelectItem>
            <SelectItem value="video">Video</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-32">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Works Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredWorks.length === 0 ? (
        <div className="text-center py-16">
          <Image className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No works found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || categoryFilter !== 'all' || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Upload your first work to get started'}
          </p>
          {canEdit && !searchQuery && categoryFilter === 'all' && (
            <Button onClick={() => setUploadDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Upload Work
            </Button>
          )}
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredWorks.map((work) => (
              <motion.div
                key={work.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={`group relative rounded-lg overflow-hidden bg-card border border-border ${
                  work.status === 'hidden' ? 'opacity-60' : ''
                }`}
              >
                {/* Thumbnail */}
                <div className="aspect-[4/3] bg-muted relative">
                  {imageUrls[work.id] ? (
                    work.type === 'video' ? (
                      <video
                        src={imageUrls[work.id]}
                        className="w-full h-full object-cover"
                        muted
                      />
                    ) : (
                      <img
                        src={imageUrls[work.id]}
                        alt={work.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {work.type === 'video' ? (
                        <Video className="h-12 w-12 text-muted-foreground/50" />
                      ) : (
                        <Image className="h-12 w-12 text-muted-foreground/50" />
                      )}
                    </div>
                  )}

                  {/* Type badge */}
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-xs">
                      {work.type === 'video' ? <Video className="h-3 w-3 mr-1" /> : <Image className="h-3 w-3 mr-1" />}
                      {work.type}
                    </Badge>
                  </div>

                  {/* Visibility indicators */}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {work.show_on_home && (
                      <Badge variant="outline" className="text-xs bg-background/80">
                        <Home className="h-3 w-3" />
                      </Badge>
                    )}
                    {work.show_on_gallery && (
                      <Badge variant="outline" className="text-xs bg-background/80">
                        <LayoutGrid className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>

                  {/* Actions overlay */}
                  {canEdit && (
                    <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => handleEdit(work)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleToggleStatus(work)}>
                        {work.status === 'active' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteClick(work)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="font-medium text-foreground truncate">{work.title}</h3>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">
                      {categoryLabels[work.category] || work.category}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(work.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={work.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {work.status}
                    </Badge>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Upload Dialog */}
      <UploadWorkDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={fetchWorks}
      />

      {/* Edit Dialog */}
      <EditWorkDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        work={selectedWork}
        onSuccess={fetchWorks}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Work</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete "{workToDelete?.title}"? This will remove the file from storage and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default Works;
