import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/shared/Logo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PasswordStrengthIndicator } from '@/components/ui/PasswordStrengthIndicator';
import { strongPasswordSchema } from '@/lib/passwordValidation';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});

  const isValidLink = useMemo(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    return (
      hash.includes('access_token=') ||
      hash.includes('refresh_token=') ||
      search.includes('code=')
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const authAny = supabase.auth as unknown as {
          getSessionFromUrl?: (options?: { storeSession?: boolean }) => Promise<unknown>;
          exchangeCodeForSession?: (url: string) => Promise<unknown>;
        };

        if (typeof authAny.getSessionFromUrl === 'function') {
          await authAny.getSessionFromUrl({ storeSession: true });
        } else if (typeof authAny.exchangeCodeForSession === 'function') {
          await authAny.exchangeCodeForSession(window.location.href);
        }
      } catch (err) {
        console.error('Reset password init error:', err);
      } finally {
        if (mounted) setIsReady(true);
      }
    };

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = strongPasswordSchema.safeParse({ newPassword, confirmPassword });
    if (!result.success) {
      const fieldErrors: { newPassword?: string; confirmPassword?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'newPassword') fieldErrors.newPassword = err.message;
        if (err.path[0] === 'confirmPassword') fieldErrors.confirmPassword = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        toast.error('Reset link is invalid or expired');
        navigate('/login', { replace: true });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast.error(error.message);
        return;
      }

      const userId = session.user?.id;
      if (userId) {
        await supabase.from('profiles').update({ must_change_password: false }).eq('user_id', userId);
      }

      await supabase.auth.signOut();
      toast.success('Password updated. Please sign in.');
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error('Failed to reset password');
      console.error('Reset password submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isReady) {
    return (
      <Layout hideFooter>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!isValidLink) {
    return (
      <Layout hideFooter>
        <div className="min-h-screen flex items-center justify-center px-6 py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-md"
          >
            <div className="glass p-8 rounded-lg text-center space-y-4">
              <div className="flex justify-center">
                <Logo variant="default" linkTo="/" />
              </div>
              <p className="text-sm text-muted-foreground">
                This reset link is invalid or incomplete.
              </p>
              <Button className="w-full btn-gold" onClick={() => navigate('/login', { replace: true })}>
                Back to Login
              </Button>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideFooter>
      <div className="min-h-screen flex items-center justify-center px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8 flex flex-col items-center">
            <div className="mb-6">
              <Logo variant="large" linkTo="/" />
            </div>
            <h1 className="font-serif text-3xl font-light text-foreground">Reset Password</h1>
            <p className="mt-2 font-sans text-muted-foreground">Choose a new password to continue</p>
          </div>

          <div className="glass p-8 rounded-lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-foreground font-sans">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10 bg-background/50 border-border focus:border-primary"
                    placeholder="Enter new password"
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={newPassword} />
                {errors.newPassword ? (
                  <p className="text-xs text-destructive">{errors.newPassword}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-foreground font-sans">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 bg-background/50 border-border focus:border-primary"
                    placeholder="Confirm new password"
                    disabled={isSubmitting}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword ? (
                  <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                ) : null}
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full btn-gold text-sm">
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default ResetPassword;
