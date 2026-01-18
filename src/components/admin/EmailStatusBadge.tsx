import { useState } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, Loader2, Info } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';

export type EmailStatus = 'sent' | 'failed' | 'pending' | 'none';

interface EmailLogDetails {
  id: string;
  status: EmailStatus;
  created_at: string;
  error_message: string | null;
  metadata: {
    resend_id?: string;
    data?: Record<string, unknown>;
  } | null;
}

interface EmailStatusBadgeProps {
  status: EmailStatus;
  email: string;
  clientName: string;
  clientId?: string;
  onRetrySuccess?: () => void;
}

export const EmailStatusBadge = ({
  status,
  email,
  clientName,
  clientId,
  onRetrySuccess,
}: EmailStatusBadgeProps) => {
  const { toast } = useToast();
  const [isRetrying, setIsRetrying] = useState(false);
  const [emailDetails, setEmailDetails] = useState<EmailLogDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const fetchEmailDetails = async () => {
    if (!email) return;
    setIsLoadingDetails(true);
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('id, status, created_at, error_message, metadata')
        .eq('to_email', email)
        .eq('template_type', 'welcome')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setEmailDetails({
          id: data.id,
          status: data.status as EmailStatus,
          created_at: data.created_at,
          error_message: data.error_message,
          metadata: data.metadata as EmailLogDetails['metadata'],
        });
      }
    } catch (error) {
      console.error('Error fetching email details:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleRetry = async () => {
    if (!email || !email.includes('@')) {
      toast({
        title: 'Invalid email',
        description: 'Cannot send email to invalid address',
        variant: 'destructive',
      });
      return;
    }

    setIsRetrying(true);
    try {
      // Generate a temporary password for retry
      const tempPassword = Array.from(
        { length: 12 },
        () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[
          Math.floor(Math.random() * 55)
        ]
      ).join('');

      const loginUrl = `${window.location.origin}/login?email=${encodeURIComponent(email)}`;

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'welcome',
          to: email,
          data: {
            name: clientName,
            email,
            password: tempPassword,
            loginUrl,
            clientId,
          },
        },
      });

      if (error) throw error;

      // Check if the response indicates success
      if (data?.success && data?.id) {
        toast({
          title: 'Email sent successfully',
          description: `Welcome email sent to ${email}. Message ID: ${data.id}`,
        });
        onRetrySuccess?.();
      } else if (data?.error) {
        throw new Error(data.error);
      } else {
        // If no clear success indicator, treat as failure
        throw new Error('Email may not have been delivered. Please check logs.');
      }
    } catch (error: unknown) {
      console.error('Retry email failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Please try again later';
      toast({
        title: 'Failed to send email',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const renderStatusBadge = () => {
    switch (status) {
      case 'sent':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 gap-1">
            <CheckCircle size={12} />
            Sent
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 gap-1">
            <XCircle size={12} />
            Failed
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30 gap-1">
            <Clock size={12} />
            Pending
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
            <Clock size={12} />
            No record
          </Badge>
        );
    }
  };

  const renderDetails = () => {
    if (isLoadingDetails) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }

    if (!emailDetails) {
      return <p className="text-sm text-muted-foreground">No email log found</p>;
    }

    return (
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status:</span>
          <span className={
            emailDetails.status === 'sent' ? 'text-green-500' :
            emailDetails.status === 'failed' ? 'text-red-500' :
            'text-yellow-500'
          }>
            {emailDetails.status.charAt(0).toUpperCase() + emailDetails.status.slice(1)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Sent at:</span>
          <span>{format(new Date(emailDetails.created_at), 'MMM d, yyyy h:mm a')}</span>
        </div>
        {emailDetails.metadata?.resend_id && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Message ID:</span>
            <span className="font-mono text-xs truncate max-w-[150px]" title={emailDetails.metadata.resend_id}>
              {emailDetails.metadata.resend_id}
            </span>
          </div>
        )}
        {emailDetails.error_message && (
          <div className="mt-2 p-2 bg-red-500/10 rounded text-red-500 text-xs">
            <strong>Error:</strong> {emailDetails.error_message}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button 
            onClick={fetchEmailDetails}
            className="cursor-pointer hover:opacity-80 transition-opacity"
          >
            {renderStatusBadge()}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-3">
            <h4 className="font-medium">Email Details</h4>
            {renderDetails()}
            <div className="pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <>
                    <Loader2 size={14} className="mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} className="mr-2" />
                    {status === 'none' ? 'Send Welcome Email' : 'Resend Email'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {(status === 'failed' || status === 'none') && (
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
              <p>{status === 'none' ? 'Send welcome email' : 'Retry sending welcome email'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};
