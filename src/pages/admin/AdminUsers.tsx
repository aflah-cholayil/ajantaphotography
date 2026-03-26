import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  UserPlus, 
  Pencil, 
  Trash2, 
  UserX, 
  UserCheck,
  Shield,
  ShieldCheck,
  Eye,
  Users,
  Edit3,
  Crown,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { CreateAdminDialog } from '@/components/admin/CreateAdminDialog';
import { EditAdminDialog } from '@/components/admin/EditAdminDialog';
import { getInvokeErrorMessage } from '@/lib/supabaseInvokeError';

type AdminRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'client';

interface AdminUser {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
}

const roleConfig: Record<AdminRole, { label: string; icon: React.ElementType; color: string }> = {
  owner: { label: 'Owner', icon: Crown, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  admin: { label: 'Admin', icon: ShieldCheck, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  editor: { label: 'Editor', icon: Edit3, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  viewer: { label: 'Viewer', icon: Eye, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  client: { label: 'Client', icon: Users, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

const AdminUsers = () => {
  const { isOwner, isLoading: authLoading, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !isOwner) {
      toast({
        title: "Access Denied",
        description: "Only owners can access admin user management.",
        variant: "destructive",
      });
      navigate('/admin');
    }
  }, [authLoading, isOwner, navigate, toast]);

  const fetchAdminUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_users_view')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setAdminUsers(data || []);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      toast({
        title: "Error",
        description: "Failed to load admin users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) {
      fetchAdminUsers();
    }
  }, [isOwner]);

  const handleToggleStatus = async (user: AdminUser) => {
    try {
      const response = await supabase.functions.invoke('manage-admin-user', {
        body: {
          action: 'update',
          userId: user.user_id,
          isActive: !user.is_active,
        },
      });

      if (response.error) {
        const message = await getInvokeErrorMessage(response);
        throw new Error(message || response.error.message || 'Request failed');
      }
      if (response.data && typeof response.data === 'object' && 'error' in response.data && (response.data as { error?: string }).error) {
        throw new Error((response.data as { error: string }).error);
      }

      toast({
        title: user.is_active ? "User Disabled" : "User Enabled",
        description: `${user.name} has been ${user.is_active ? 'disabled' : 'enabled'}.`,
      });

      fetchAdminUsers();
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (user: AdminUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      const response = await supabase.functions.invoke('manage-admin-user', {
        body: {
          action: 'delete',
          userId: userToDelete.user_id,
        },
      });

      if (response.error) {
        const message = await getInvokeErrorMessage(response);
        throw new Error(message || response.error.message || 'Request failed');
      }
      if (response.data && typeof response.data === 'object' && 'error' in response.data && (response.data as { error?: string }).error) {
        throw new Error((response.data as { error: string }).error);
      }

      toast({
        title: "User Deleted",
        description: `${userToDelete.name} has been removed.`,
      });

      fetchAdminUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const handleEditClick = (user: AdminUser) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  if (authLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!isOwner) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif font-light text-foreground">Admin Users</h1>
            <p className="text-muted-foreground mt-1">Manage your team's access and permissions</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <UserPlus size={18} />
            Add Admin User
          </Button>
        </div>

        {/* Roles Legend */}
        <div className="flex flex-wrap gap-4 p-4 bg-card rounded-lg border border-border">
          <div className="text-sm text-muted-foreground mr-4">Roles:</div>
          {Object.entries(roleConfig).map(([role, config]) => (
            <div key={role} className="flex items-center gap-2 text-sm">
              <config.icon size={14} className={config.color.split(' ')[1]} />
              <span className="text-foreground">{config.label}</span>
              <span className="text-muted-foreground text-xs">
                {role === 'owner' && '(Full access)'}
                {role === 'admin' && '(Manage content)'}
                {role === 'editor' && '(Upload only)'}
                {role === 'viewer' && '(Read only)'}
              </span>
            </div>
          ))}
        </div>

        {/* Admin Users Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : adminUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Shield size={48} className="mb-4 opacity-50" />
              <p>No admin users found</p>
              <Button 
                variant="outline" 
                onClick={() => setCreateDialogOpen(true)}
                className="mt-4"
              >
                Add your first admin user
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminUsers.map((user) => {
                  const roleInfo = roleConfig[user.role];
                  const isCurrentUser = user.user_id === session?.user?.id;
                  
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {user.name}
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <Badge className={`${roleInfo.color} border gap-1`}>
                          <roleInfo.icon size={12} />
                          {roleInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={user.is_active ? "default" : "secondary"}
                          className={user.is_active 
                            ? "bg-green-500/20 text-green-400 border-green-500/30" 
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                          }
                        >
                          {user.is_active ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        {user.role !== 'owner' && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditClick(user)}
                              title="Edit user"
                            >
                              <Pencil size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleStatus(user)}
                              title={user.is_active ? 'Disable user' : 'Enable user'}
                            >
                              {user.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(user)}
                              className="text-destructive hover:text-destructive"
                              title="Delete user"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        )}
                        {user.role === 'owner' && (
                          <span className="text-muted-foreground text-sm">Protected</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Create Admin Dialog */}
      <CreateAdminDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchAdminUsers}
      />

      {/* Edit Admin Dialog */}
      {selectedUser && (
        <EditAdminDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          user={selectedUser}
          onSuccess={fetchAdminUsers}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Admin User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{userToDelete?.name}</strong>? 
              This action cannot be undone and will permanently remove their access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminUsers;
