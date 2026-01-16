import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Pencil, ShieldCheck, Edit3, Eye } from 'lucide-react';

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

interface EditAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  onSuccess: () => void;
}

const roleDescriptions: Record<string, string> = {
  owner: 'Full access including admin user management.',
  admin: 'Full access to clients, albums, uploads, and bookings. Cannot manage admin users.',
  editor: 'Can upload photos/videos and mark galleries ready. Cannot delete data.',
  viewer: 'Read-only access to view clients, albums, and bookings.',
  client: 'Client access only.',
};

export const EditAdminDialog = ({ open, onOpenChange, user, onSuccess }: EditAdminDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: user.name,
    role: user.role as AdminRole,
  });

  useEffect(() => {
    setFormData({
      name: user.name,
      role: user.role as AdminRole,
    });
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: "Validation Error",
        description: "Please enter a name.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('manage-admin-user', {
        body: {
          action: 'update',
          userId: user.user_id,
          name: formData.name,
          role: formData.role,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to update admin user');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: "User Updated",
        description: `${formData.name}'s information has been updated.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating admin user:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update admin user",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil size={20} className="text-primary" />
            Edit Admin User
          </DialogTitle>
          <DialogDescription>
            Update {user.name}'s information and permissions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Email (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              placeholder="Enter full name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              disabled={isLoading}
            />
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">Role *</Label>
            <Select
              value={formData.role}
              onValueChange={(value: AdminRole) => setFormData(prev => ({ ...prev, role: value }))}
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-blue-400" />
                    Admin
                  </div>
                </SelectItem>
                <SelectItem value="editor">
                  <div className="flex items-center gap-2">
                    <Edit3 size={14} className="text-green-400" />
                    Editor
                  </div>
                </SelectItem>
                <SelectItem value="viewer">
                  <div className="flex items-center gap-2">
                    <Eye size={14} className="text-gray-400" />
                    Viewer
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {roleDescriptions[formData.role]}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
