import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Logo } from '@/components/shared/Logo';
import { supabase } from '@/integrations/supabase/client';

const Login = () => {
  const [searchParams] = useSearchParams();
  // Pre-fill email from URL query parameter (from welcome email)
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const navigate = useNavigate();
  const { user, isAdmin, role, signIn, isLoading: authLoading } = useAuth();

  // Redirect authenticated users based on role
  useEffect(() => {
    if (!authLoading && user && role) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else if (role === 'client') {
        navigate('/client', { replace: true });
      }
    }
  }, [user, isAdmin, role, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Invalid email or password');
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Please confirm your email address');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Welcome back!');
        // Navigation handled by useEffect
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      toast.error('Enter your email first');
      return;
    }

    setIsSendingReset(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'password_reset',
          to: normalizedEmail,
          data: {},
        },
      });

      if (error || (data && typeof data === 'object' && 'success' in data && (data as any).success === false)) {
        const { error: fallbackError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (fallbackError) {
          toast.error(fallbackError.message);
          return;
        }
      }

      toast.success('If your account exists, you will receive a reset email');
    } catch (err) {
      toast.error('Failed to send password reset email');
      console.error('Reset password error:', err);
    } finally {
      setIsSendingReset(false);
    }
  };

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <Layout hideFooter>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  // Don't render form if user is already authenticated
  if (user && role) {
    return (
      <Layout hideFooter>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
            <h1 className="font-serif text-3xl font-light text-foreground">
              Welcome Back
            </h1>
            <p className="mt-2 font-sans text-muted-foreground">
              Sign in to access your gallery
            </p>
          </div>

          <div className="glass p-8 rounded-lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground font-sans">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/50 border-border focus:border-primary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground font-sans">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-background/50 border-border focus:border-primary pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={isSendingReset}
                    className="text-xs text-primary hover:underline disabled:opacity-50 disabled:hover:no-underline"
                  >
                    {isSendingReset ? 'Sending reset...' : 'Forgot password?'}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full btn-gold text-sm"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-border text-center">
              <p className="font-sans text-sm text-muted-foreground">
                New client?{' '}
                <Link to="/contact" className="text-primary hover:underline">
                  Contact us to get access
                </Link>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Login;
