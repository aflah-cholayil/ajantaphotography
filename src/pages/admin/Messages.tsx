import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, MoreVertical, Mail, Trash2, Eye, EyeOff, MessageSquare, Send, Reply } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  phone: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

const AdminMessages = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [readFilter, setReadFilter] = useState<string>('all');
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [replyMode, setReplyMode] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages((data as ContactMessage[]) || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('messages_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_messages',
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleToggleRead = async (messageId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ is_read: !currentStatus })
        .eq('id', messageId);

      if (error) throw error;

      toast({
        title: currentStatus ? 'Marked as unread' : 'Marked as read',
      });

      fetchMessages();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update message',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!messageToDelete) return;

    try {
      const { error } = await supabase
        .from('contact_messages')
        .delete()
        .eq('id', messageToDelete);

      if (error) throw error;

      toast({
        title: 'Message deleted',
      });

      setDeleteDialogOpen(false);
      setMessageToDelete(null);
      fetchMessages();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete message',
        variant: 'destructive',
      });
    }
  };

  const openMessageDetails = async (message: ContactMessage) => {
    setSelectedMessage(message);
    setReplyMode(false);
    setReplyText('');
    
    // Mark as read when opening
    if (!message.is_read) {
      await supabase
        .from('contact_messages')
        .update({ is_read: true })
        .eq('id', message.id);
      fetchMessages();
    }
  };

  const handleSendReply = async () => {
    if (!selectedMessage || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'contact_reply',
          to: selectedMessage.email,
          data: {
            recipientName: selectedMessage.name,
            replyMessage: replyText.trim(),
            originalSubject: selectedMessage.subject,
            originalMessage: selectedMessage.message,
          }
        }
      });

      if (error) throw error;

      toast({
        title: 'Reply sent!',
        description: `Email sent to ${selectedMessage.email}`,
      });

      setReplyMode(false);
      setReplyText('');
      setSelectedMessage(null);
    } catch (error) {
      console.error('Failed to send reply:', error);
      toast({
        title: 'Error',
        description: 'Failed to send reply. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingReply(false);
    }
  };

  const filteredMessages = messages.filter((message) => {
    const matchesSearch = 
      message.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (message.subject?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      message.message.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRead = 
      readFilter === 'all' || 
      (readFilter === 'unread' && !message.is_read) ||
      (readFilter === 'read' && message.is_read);

    return matchesSearch && matchesRead;
  });

  const unreadCount = messages.filter(m => !m.is_read).length;

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-light text-foreground flex items-center gap-3">
              Messages
              {unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground">
                  {unreadCount} new
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Contact form submissions</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={readFilter} onValueChange={setReadFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Messages</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mobile Card View */}
        <div className="block sm:hidden space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading messages...</div>
          ) : filteredMessages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
              {searchQuery || readFilter !== 'all' 
                ? 'No messages found matching your criteria' 
                : 'No messages yet'
              }
            </div>
          ) : (
            filteredMessages.map((message) => (
              <div 
                key={message.id} 
                className={`bg-card border border-border rounded-lg p-4 space-y-2 cursor-pointer ${!message.is_read ? 'border-l-4 border-l-primary' : ''}`}
                onClick={() => openMessageDetails(message)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!message.is_read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                      <p className={`truncate ${!message.is_read ? 'font-semibold' : 'font-medium'}`}>
                        {message.name}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{message.email}</p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8">
                          <MoreVertical size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.open(`mailto:${message.email}`)}>
                          <Mail size={16} className="mr-2" />
                          Reply via Email
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleRead(message.id, message.is_read)}>
                          {message.is_read ? (
                            <><EyeOff size={16} className="mr-2" />Mark as Unread</>
                          ) : (
                            <><Eye size={16} className="mr-2" />Mark as Read</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => { setMessageToDelete(message.id); setDeleteDialogOpen(true); }}
                        >
                          <Trash2 size={16} className="mr-2" />Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <p className={`text-sm ${!message.is_read ? 'font-medium' : ''}`}>
                  {message.subject || '(No subject)'}
                </p>
                <p className="text-sm text-muted-foreground line-clamp-2">{message.message}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(message.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-8"></TableHead>
                <TableHead>From</TableHead>
                <TableHead className="hidden md:table-cell">Subject</TableHead>
                <TableHead className="hidden lg:table-cell">Message</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading messages...
                  </TableCell>
                </TableRow>
              ) : filteredMessages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
                    {searchQuery || readFilter !== 'all' 
                      ? 'No messages found matching your criteria' 
                      : 'No messages yet'
                    }
                  </TableCell>
                </TableRow>
              ) : (
                filteredMessages.map((message) => (
                  <TableRow 
                    key={message.id} 
                    className={`hover:bg-muted/20 cursor-pointer ${!message.is_read ? 'bg-primary/5' : ''}`}
                    onClick={() => openMessageDetails(message)}
                  >
                    <TableCell>
                      {!message.is_read && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className={`${!message.is_read ? 'font-semibold' : 'font-medium'}`}>
                          {message.name}
                        </p>
                        <p className="text-sm text-muted-foreground">{message.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className={`hidden md:table-cell ${!message.is_read ? 'font-medium' : ''}`}>
                      {message.subject || '(No subject)'}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-xs">
                      <p className="truncate text-muted-foreground">
                        {message.message}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(message.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => window.open(`mailto:${message.email}`)}
                          >
                            <Mail size={16} className="mr-2" />
                            Reply via Email
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleToggleRead(message.id, message.is_read)}
                          >
                            {message.is_read ? (
                              <>
                                <EyeOff size={16} className="mr-2" />
                                Mark as Unread
                              </>
                            ) : (
                              <>
                                <Eye size={16} className="mr-2" />
                                Mark as Read
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => {
                              setMessageToDelete(message.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 size={16} className="mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Message Details Dialog */}
      <Dialog open={!!selectedMessage} onOpenChange={() => { setSelectedMessage(null); setReplyMode(false); setReplyText(''); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {replyMode ? 'Reply to Message' : 'Message Details'}
            </DialogTitle>
            <DialogDescription>
              {replyMode 
                ? `Replying to ${selectedMessage?.name}`
                : selectedMessage && `Received ${format(new Date(selectedMessage.created_at), 'MMMM d, yyyy \'at\' h:mm a')}`
              }
            </DialogDescription>
          </DialogHeader>
          
          {selectedMessage && !replyMode && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">From</p>
                  <p className="font-medium">{selectedMessage.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Email</p>
                  <p className="font-medium">{selectedMessage.email}</p>
                </div>
                {selectedMessage.phone && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Phone</p>
                    <p className="font-medium">{selectedMessage.phone}</p>
                  </div>
                )}
                {selectedMessage.subject && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Subject</p>
                    <p className="font-medium">{selectedMessage.subject}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Message</p>
                <p className="text-sm p-3 bg-muted rounded-lg whitespace-pre-wrap">{selectedMessage.message}</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedMessage(null)} className="flex-1">
                  Close
                </Button>
                <Button 
                  onClick={() => setReplyMode(true)} 
                  className="flex-1 btn-gold"
                >
                  <Reply size={16} className="mr-2" />
                  Reply
                </Button>
              </div>
            </div>
          )}

          {selectedMessage && replyMode && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-1">Original message from {selectedMessage.name}:</p>
                <p className="text-sm text-muted-foreground line-clamp-3">{selectedMessage.message}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Your Reply</p>
                <Textarea
                  placeholder="Type your reply here..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => { setReplyMode(false); setReplyText(''); }} 
                  className="flex-1"
                  disabled={isSendingReply}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSendingReply}
                  className="flex-1 btn-gold"
                >
                  {isSendingReply ? (
                    'Sending...'
                  ) : (
                    <>
                      <Send size={16} className="mr-2" />
                      Send Reply
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminMessages;