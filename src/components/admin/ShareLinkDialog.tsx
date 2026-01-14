import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays } from 'date-fns';
import { CalendarIcon, Copy, Check, Share2, Loader2, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const shareLinkSchema = z.object({
  password: z.string().optional(),
  allowDownload: z.boolean().default(false),
  expiresAt: z.date().optional(),
});

type ShareLinkFormData = z.infer<typeof shareLinkSchema>;

interface ShareLinkDialogProps {
  albumId: string;
  albumTitle: string;
  trigger?: React.ReactNode;
}

export const ShareLinkDialog = ({ albumId, albumTitle, trigger }: ShareLinkDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const form = useForm<ShareLinkFormData>({
    resolver: zodResolver(shareLinkSchema),
    defaultValues: {
      allowDownload: false,
      expiresAt: addDays(new Date(), 30),
    },
  });

  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const onSubmit = async (data: ShareLinkFormData) => {
    setIsLoading(true);
    try {
      // Hash password if provided (simple hash for demo, use bcrypt in production)
      let passwordHash = null;
      if (data.password) {
        const encoder = new TextEncoder();
        const passwordData = encoder.encode(data.password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', passwordData);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      const { data: shareLink, error } = await supabase
        .from('share_links')
        .insert({
          album_id: albumId,
          allow_download: data.allowDownload,
          expires_at: data.expiresAt?.toISOString(),
          password_hash: passwordHash,
        })
        .select('token')
        .single();

      if (error) throw error;

      const link = `${window.location.origin}/share/${shareLink.token}`;
      setGeneratedLink(link);

      toast({
        title: 'Share link created',
        description: 'The link has been generated successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create share link';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setGeneratedLink(null);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) handleClose();
      else setOpen(value);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Share2 size={16} className="mr-2" />
            Share
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {generatedLink ? 'Share Link Ready' : 'Create Share Link'}
          </DialogTitle>
          <DialogDescription>
            {generatedLink 
              ? `Share link for "${albumTitle}"`
              : `Generate a shareable link for "${albumTitle}"`
            }
          </DialogDescription>
        </DialogHeader>

        {generatedLink ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <LinkIcon size={16} className="text-muted-foreground flex-shrink-0" />
              <code className="text-sm flex-1 truncate">{generatedLink}</code>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCopy}
                className="flex-1"
                variant={copied ? 'default' : 'outline'}
              >
                {copied ? <Check size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button onClick={handleClose} variant="outline">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="allowDownload"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Allow Downloads</FormLabel>
                      <FormDescription>
                        Let viewers download the original files
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password Protection (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Leave empty for public access" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Expiration Date (Optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full pl-3 text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            {field.value ? (
                              format(field.value, 'PPP')
                            ) : (
                              <span>No expiration</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1 btn-gold">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Generate Link
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
