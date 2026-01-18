import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Mail, CheckCircle, XCircle, Clock, ExternalLink, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';

interface EmailLog {
  id: string;
  to_email: string;
  subject: string;
  template_type: string;
  status: 'sent' | 'failed' | 'pending';
  error_message: string | null;
  created_at: string;
  metadata: {
    resend_id?: string;
    data?: Record<string, unknown>;
  } | null;
}

interface EmailHistoryDialogProps {
  clientEmail: string;
  clientName: string;
  trigger?: React.ReactNode;
}

export const EmailHistoryDialog = ({
  clientEmail,
  clientName,
  trigger,
}: EmailHistoryDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchEmailHistory = async () => {
    if (!clientEmail) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .eq('to_email', clientEmail)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setEmails((data || []).map(log => ({
        ...log,
        status: log.status as 'sent' | 'failed' | 'pending',
        metadata: log.metadata as EmailLog['metadata'],
      })));
    } catch (error) {
      console.error('Error fetching email history:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email history',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchEmailHistory();
    }
  }, [open, clientEmail]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
            Sent
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
            Failed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
            Pending
          </Badge>
        );
    }
  };

  const getTemplateLabel = (type: string) => {
    const labels: Record<string, string> = {
      welcome: 'Welcome Email',
      gallery_ready: 'Gallery Ready',
      share_link: 'Share Link',
      booking_confirmation: 'Booking Confirmation',
      password_changed: 'Password Changed',
    };
    return labels[type] || type;
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm">
            <Mail className="h-4 w-4 mr-2" />
            Email History
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email History for {clientName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{clientEmail}</p>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mb-4 opacity-50" />
              <p>No emails sent to this client yet</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="space-y-2">
              {emails.map((email) => (
                <AccordionItem
                  key={email.id}
                  value={email.id}
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-3 text-left w-full">
                      {getStatusIcon(email.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">
                            {getTemplateLabel(email.template_type)}
                          </span>
                          {getStatusBadge(email.status)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(email.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Subject:</span>
                        </div>
                        <div className="font-medium truncate" title={email.subject}>
                          {email.subject}
                        </div>
                      </div>

                      {email.metadata?.resend_id && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-muted-foreground">Message ID:</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-muted px-2 py-1 rounded truncate max-w-[200px]">
                              {email.metadata.resend_id}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyToClipboard(email.metadata!.resend_id!, email.id)}
                            >
                              {copiedId === email.id ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      {email.error_message && (
                        <div className="mt-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                          <p className="text-red-500 font-medium mb-1">Error:</p>
                          <p className="text-red-400 text-xs">{email.error_message}</p>
                        </div>
                      )}

                      {email.metadata?.resend_id && (
                        <div className="pt-2">
                          <a
                            href={`https://resend.com/emails/${email.metadata.resend_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                          >
                            View in Resend Dashboard
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </ScrollArea>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {emails.length} email{emails.length !== 1 ? 's' : ''} total
          </p>
          <Button variant="outline" size="sm" onClick={fetchEmailHistory} disabled={isLoading}>
            Refresh
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
