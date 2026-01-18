import { useState } from 'react';
import { Eye, EyeOff, Lock, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
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
import { useToast } from '@/hooks/use-toast';
import { Logo } from '@/components/shared/Logo';

const passwordSchema = z.object({
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be less than 72 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

interface ChangePasswordDialogProps {
  open: boolean;
  userId: string;
  onPasswordChanged: () => void;
}

export const ChangePasswordDialog = ({ open, userId, onPasswordChanged }: ChangePasswordDialogProps) => {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    const result = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!result.success) {
      const fieldErrors: { newPassword?: string; confirmPassword?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'newPassword') {
          fieldErrors.newPassword = err.message;
        } else if (err.path[0] === 'confirmPassword') {
          fieldErrors.confirmPassword = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw updateError;
      }

      // Get user profile info for email
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profileData } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('user_id', userId)
        .maybeSingle();

      // Update must_change_password flag in profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('user_id', userId);

      if (profileError) {
        console.error('Error updating profile:', profileError);
        // Continue anyway since password was changed successfully
      }

      // Send password change notification email (fire and forget)
      const emailData = {
        name: profileData?.name || 'Client',
        email: profileData?.email || user?.email || '',
        changedAt: new Date().toLocaleString('en-IN', { 
          dateStyle: 'medium', 
          timeStyle: 'short',
          timeZone: 'Asia/Kolkata'
        }),
      };

      supabase.functions.invoke('send-email', {
        body: {
          type: 'password_changed',
          to: emailData.email,
          data: emailData,
        },
      }).catch((err) => {
        console.error('Failed to send password change notification:', err);
        // Don't block the flow if email fails
      });

      toast({
        title: 'Password changed successfully',
        description: 'You can now access your gallery.',
      });

      onPasswordChanged();
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to change password. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md bg-card border-border"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <Logo variant="small" linkTo={undefined} />
          </div>
          <DialogTitle className="font-serif text-xl font-light text-center">
            Change Your Password
          </DialogTitle>
          <DialogDescription className="text-center">
            For your security, please set a new password before continuing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-sm font-medium">
              New Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-10 pr-10 bg-background border-input"
                placeholder="Enter new password"
                disabled={isSubmitting}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.newPassword}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password" className="text-sm font-medium">
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10 pr-10 bg-background border-input"
                placeholder="Confirm new password"
                disabled={isSubmitting}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle size={12} />
                {errors.confirmPassword}
              </p>
            )}
          </div>

          <div className="bg-muted/50 rounded-md p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Password requirements:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>At least 8 characters</li>
              <li>One uppercase letter</li>
              <li>One lowercase letter</li>
              <li>One number</li>
            </ul>
          </div>

          <Button
            type="submit"
            className="w-full btn-gold"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Changing Password...' : 'Change Password'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
