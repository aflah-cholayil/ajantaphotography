import { useState } from 'react';
import { Mail, Loader2, Send, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClientForEmail {
  id: string;
  name: string;
  email: string;
}

type EmailType = 'welcome' | 'gallery_ready';

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientForEmail[];
  onComplete: () => void;
}

interface EmailResult {
  clientId: string;
  email: string;
  success: boolean;
  error?: string;
}

export const BulkEmailDialog = ({
  open,
  onOpenChange,
  clients,
  onComplete,
}: BulkEmailDialogProps) => {
  const { toast } = useToast();
  const [emailType, setEmailType] = useState<EmailType>('welcome');
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<EmailResult[]>([]);
  const [currentClient, setCurrentClient] = useState<string | null>(null);

  const handleSend = async () => {
    if (clients.length === 0) return;

    setIsSending(true);
    setProgress(0);
    setResults([]);

    const newResults: EmailResult[] = [];
    const baseUrl = window.location.origin;

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      setCurrentClient(client.name);
      
      try {
        // Generate temporary password for welcome emails
        const tempPassword = emailType === 'welcome' 
          ? Array.from(
              { length: 12 },
              () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[
                Math.floor(Math.random() * 55)
              ]
            ).join('')
          : undefined;

        const loginUrl = `${baseUrl}/login?email=${encodeURIComponent(client.email)}`;

        const { data, error } = await supabase.functions.invoke('send-email', {
          body: {
            type: emailType,
            to: client.email,
            data: {
              name: client.name,
              email: client.email,
              password: tempPassword,
              loginUrl,
              clientId: client.id,
            },
          },
        });

        if (error) throw error;

        if (data?.success) {
          newResults.push({
            clientId: client.id,
            email: client.email,
            success: true,
          });
        } else {
          newResults.push({
            clientId: client.id,
            email: client.email,
            success: false,
            error: data?.error || 'Unknown error',
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to send email';
        newResults.push({
          clientId: client.id,
          email: client.email,
          success: false,
          error: errorMessage,
        });
      }

      setResults([...newResults]);
      setProgress(((i + 1) / clients.length) * 100);

      // Small delay between emails to avoid rate limiting
      if (i < clients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setCurrentClient(null);
    setIsSending(false);

    const successCount = newResults.filter(r => r.success).length;
    const failCount = newResults.filter(r => !r.success).length;

    toast({
      title: 'Bulk email complete',
      description: `${successCount} sent successfully${failCount > 0 ? `, ${failCount} failed` : ''}`,
      variant: failCount > 0 ? 'destructive' : 'default',
    });

    if (successCount > 0) {
      onComplete();
    }
  };

  const handleClose = () => {
    if (!isSending) {
      setResults([]);
      setProgress(0);
      onOpenChange(false);
    }
  };

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Bulk Email
          </DialogTitle>
          <DialogDescription>
            Send emails to {clients.length} selected client{clients.length !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        {results.length === 0 ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Type</label>
              <Select value={emailType} onValueChange={(v) => setEmailType(v as EmailType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="welcome">Welcome Email (with new password)</SelectItem>
                  <SelectItem value="gallery_ready">Gallery Ready Notification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Recipients</label>
              <ScrollArea className="h-[200px] border rounded-lg p-3">
                <div className="space-y-2">
                  {clients.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center justify-between text-sm py-1"
                    >
                      <span className="font-medium">{client.name}</span>
                      <span className="text-muted-foreground">{client.email}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {emailType === 'welcome' && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-yellow-500">
                  This will generate new temporary passwords for all selected clients. 
                  They will need to use the new password to log in.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {isSending && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Sending to: {currentClient}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}

            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                {successCount} Sent
              </Badge>
              {failCount > 0 && (
                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
                  {failCount} Failed
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[250px] border rounded-lg">
              <div className="p-3 space-y-2">
                {results.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between text-sm py-2 px-3 rounded ${
                      result.success ? 'bg-green-500/5' : 'bg-red-500/5'
                    }`}
                  >
                    <span className="truncate flex-1">{result.email}</span>
                    {result.success ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                        Sent
                      </Badge>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400 truncate max-w-[150px]" title={result.error}>
                          {result.error}
                        </span>
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-xs">
                          Failed
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {results.length === 0 ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isSending}>
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={isSending || clients.length === 0}>
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send to {clients.length} Client{clients.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} disabled={isSending}>
              {isSending ? 'Please wait...' : 'Done'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
