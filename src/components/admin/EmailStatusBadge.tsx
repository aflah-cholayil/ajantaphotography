import { useState } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

export type EmailStatus = 'sent' | 'failed' | 'pending' | 'none';

interface EmailStatusBadgeProps {
  status: EmailStatus;
  email: string;
  clientName: string;
  onRetrySuccess?: () => void;
}

export const EmailStatusBadge = ({
  status,
  email,
  clientName,
  onRetrySuccess,
}: EmailStatusBadgeProps) => {
  const { toast } = useToast();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'welcome',
          to: email,
          data: {
            name: clientName,
            email,
            password: '(Use password reset to set a new password)',
            loginUrl: `${window.location.origin}/login`,
          },
        },
      });

      if (error) throw error;

      toast({
        title: 'Email sent',
        description: `Welcome email resent to ${email}`,
      });

      onRetrySuccess?.();
    } catch (error: any) {
      console.error('Retry email failed:', error);
      toast({
        title: 'Failed to send email',
        description: error.message || 'Please try again later',
        variant: 'destructive',
      });
    } finally {
      setIsRetrying(false);
    }
  };

  if (status === 'sent') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 gap-1">
              <CheckCircle size={12} />
              Sent
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Welcome email delivered successfully</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 gap-1">
                <XCircle size={12} />
                Failed
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Welcome email failed to send</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Retry sending welcome email</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 gap-1">
              <Clock size={12} />
              Pending
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Email is queued for delivery</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // No email log found
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
        <Clock size={12} />
        No record
      </Badge>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Send welcome email</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
