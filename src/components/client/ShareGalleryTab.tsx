import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { 
  Copy, Check, Share2, Link2, Lock, Calendar, Download, Trash2, 
  ExternalLink, Eye, Loader2, RefreshCw
} from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const shareLinkSchema = z.object({
  password: z.string().optional(),
  allowDownload: z.boolean().default(false),
  expiresAt: z.date().optional(),
});

type ShareLinkFormData = z.infer<typeof shareLinkSchema>;

interface ShareLink {
  id: string;
  token: string;
  allow_download: boolean;
  expires_at: string | null;
  view_count: number;
  download_count: number;
  created_at: string;
  password_hash: string | null;
}

interface ShareGalleryTabProps {
  albumId: string;
  albumTitle: string;
}

export const ShareGalleryTab = ({ albumId, albumTitle }: ShareGalleryTabProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const form = useForm<ShareLinkFormData>({
    resolver: zodResolver(shareLinkSchema),
    defaultValues: {
      allowDownload: false,
      expiresAt: addDays(new Date(), 30),
    },
  });

  const fetchShareLinks = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('share_links')
        .select('*')
        .eq('album_id', albumId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setShareLinks(data || []);
    } catch (error) {
      console.error('Error fetching share links:', error);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchShareLinks();
  }, [albumId]);

  const handleCopy = (token: string, linkId: string) => {
    const link = `${window.location.origin}/share/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedId(linkId);
    toast.success('Link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const onSubmit = async (data: ShareLinkFormData) => {
    setIsLoading(true);
    try {
      let passwordHash = null;
      if (data.password) {
        const { data: hashData, error: hashError } = await supabase.functions.invoke('hash-password', {
          body: { password: data.password },
        });

        if (hashError || hashData?.error) {
          throw new Error(hashData?.error || hashError?.message || 'Failed to hash password');
        }

        passwordHash = hashData.hash;
      }

      const { error } = await supabase
        .from('share_links')
        .insert({
          album_id: albumId,
          allow_download: data.allowDownload,
          expires_at: data.expiresAt?.toISOString(),
          password_hash: passwordHash,
        });

      if (error) throw error;

      toast.success('Share link created!');
      form.reset({
        allowDownload: false,
        expiresAt: addDays(new Date(), 30),
        password: '',
      });
      fetchShareLinks();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create share link';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('share_links')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      toast.success('Share link deleted');
      setDeleteId(null);
      fetchShareLinks();
    } catch (error) {
      console.error('Error deleting share link:', error);
      toast.error('Failed to delete share link');
    }
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Create New Share Link */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-serif text-xl font-light flex items-center gap-2">
            <Share2 className="text-primary" size={20} />
            Create Share Link
          </CardTitle>
          <CardDescription>
            Generate a secure link to share your gallery with family and friends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Allow Downloads */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-3">
                  <Download className="text-primary" size={20} />
                  <div>
                    <Label htmlFor="allowDownload" className="text-foreground">
                      Allow Downloads
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Let viewers download photos & videos
                    </p>
                  </div>
                </div>
                <Switch
                  id="allowDownload"
                  checked={form.watch('allowDownload')}
                  onCheckedChange={(checked) => form.setValue('allowDownload', checked)}
                />
              </div>

              {/* Password Protection */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lock className="text-primary" size={16} />
                  <Label htmlFor="password">Password Protection</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Leave empty for no password"
                  {...form.register('password')}
                  className="bg-muted/50 border-border"
                />
                <p className="text-xs text-muted-foreground">
                  Optional: Require a password to view the gallery
                </p>
              </div>
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Calendar className="text-primary" size={16} />
                <Label>Link Expiry</Label>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal bg-muted/50 border-border',
                      !form.watch('expiresAt') && 'text-muted-foreground'
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {form.watch('expiresAt') ? (
                      format(form.watch('expiresAt')!, 'PPP')
                    ) : (
                      'Pick an expiry date'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={form.watch('expiresAt')}
                    onSelect={(date) => form.setValue('expiresAt', date)}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button type="submit" className="w-full btn-gold" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Link2 size={16} className="mr-2" />
                  Generate Share Link
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Share Links */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-serif text-xl font-light flex items-center gap-2">
              <Link2 className="text-primary" size={20} />
              Your Share Links
            </CardTitle>
            <CardDescription>
              Manage your existing share links
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchShareLinks} disabled={isFetching}>
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </Button>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : shareLinks.length === 0 ? (
            <div className="text-center py-8">
              <Link2 size={48} className="mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No share links created yet</p>
              <p className="text-sm text-muted-foreground">Create one above to share your gallery</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shareLinks.map((link) => (
                <div
                  key={link.id}
                  className={cn(
                    'p-4 rounded-lg border transition-colors',
                    isExpired(link.expires_at)
                      ? 'bg-destructive/5 border-destructive/30'
                      : 'bg-muted/50 border-border hover:border-primary/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {link.password_hash && (
                          <Badge variant="outline" className="gap-1">
                            <Lock size={12} />
                            Password Protected
                          </Badge>
                        )}
                        {link.allow_download && (
                          <Badge variant="outline" className="gap-1">
                            <Download size={12} />
                            Downloads Enabled
                          </Badge>
                        )}
                        {isExpired(link.expires_at) && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground font-mono truncate mb-2">
                        {window.location.origin}/share/{link.token.slice(0, 16)}...
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye size={12} />
                          {link.view_count} views
                        </span>
                        <span className="flex items-center gap-1">
                          <Download size={12} />
                          {link.download_count} downloads
                        </span>
                        {link.expires_at && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                            Expires {format(new Date(link.expires_at), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(link.token, link.id)}
                        disabled={isExpired(link.expires_at)}
                      >
                        {copiedId === link.id ? (
                          <Check size={16} className="text-green-500" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(`/share/${link.token}`, '_blank')}
                        disabled={isExpired(link.expires_at)}
                      >
                        <ExternalLink size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteId(link.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Share Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this share link? Anyone with this link will no longer be able to access the gallery.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
