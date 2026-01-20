import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Loader2, UserPlus, Mail, Key, ShieldCheck, Edit3, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PasswordStrengthIndicator } from '@/components/ui/PasswordStrengthIndicator';
import { validatePassword } from '@/lib/passwordValidation';

type AdminRole = 'admin' | 'editor' | 'viewer';

interface CreateAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const roleDescriptions: Record<AdminRole, string> = {
  admin: 'Full access to clients, albums, uploads, and bookings. Cannot manage admin users.',
  editor: 'Can upload photos/videos and mark galleries ready. Cannot delete data.',
  viewer: 'Read-only access to view clients, albums, and bookings.',
};

export const CreateAdminDialog = ({ open, onOpenChange, onSuccess }: CreateAdminDialogProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'editor' as AdminRole,
    autoGeneratePassword: true,
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.autoGeneratePassword) {
      const validation = validatePassword(formData.password);
      if (!validation.isValid) {
        toast({
          title: "Weak Password",
          description: validation.errors[0] || "Please choose a stronger password.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await supabase.functions.invoke('manage-admin-user', {
        body: {
          action: 'create',
          name: formData.name,
          email: formData.email,
          role: formData.role,
          autoGeneratePassword: formData.autoGeneratePassword,
          password: formData.autoGeneratePassword ? undefined : formData.password,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create admin user');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: "Admin User Created",
        description: `${formData.name} has been added and will receive login credentials via email.`,
      });

      // Reset form
      setFormData({
        name: '',
        email: '',
        role: 'editor',
        autoGeneratePassword: true,
        password: '',
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error('Error creating admin user:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create admin user",
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
            <UserPlus size={20} className="text-primary" />
            Add Admin User
          </DialogTitle>
          <DialogDescription>
            Create a new admin user. They will receive login credentials via email.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
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

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                className="pl-10"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                disabled={isLoading}
              />
            </div>
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

          {/* Password Options */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-password" className="text-sm font-medium">
                  Auto-generate Password
                </Label>
                <p className="text-xs text-muted-foreground">
                  A secure password will be generated and sent via email
                </p>
              </div>
              <Switch
                id="auto-password"
                checked={formData.autoGeneratePassword}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, autoGeneratePassword: checked, password: '' }))
                }
                disabled={isLoading}
              />
            </div>

            <AnimatePresence>
              {!formData.autoGeneratePassword && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <Label htmlFor="password">Custom Password *</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter a strong password"
                      className="pl-10"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      disabled={isLoading}
                    />
                  </div>
                  <PasswordStrengthIndicator password={formData.password} showRequirements={true} />
                </motion.div>
              )}
            </AnimatePresence>
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
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Admin User
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
