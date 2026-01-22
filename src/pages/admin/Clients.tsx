import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, MoreVertical, Mail, Eye, RefreshCw, History, X, Filter, AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { CreateClientDialog } from '@/components/admin/CreateClientDialog';
import { EmailStatusBadge, type EmailStatus } from '@/components/admin/EmailStatusBadge';
import { EmailHistoryDialog } from '@/components/admin/EmailHistoryDialog';
import { BulkEmailDialog } from '@/components/admin/BulkEmailDialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface Client {
  id: string;
  event_name: string;
  event_date: string | null;
  notes: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    name: string;
    email: string;
  } | null;
  albums: {
    id: string;
    title: string;
    status: string;
  }[];
  emailStatus: EmailStatus;
}

type EmailStatusFilter = 'all' | 'sent' | 'failed' | 'none' | 'pending';

const AdminClients = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [emailStatusFilter, setEmailStatusFilter] = useState<EmailStatusFilter>('all');

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('Fetching clients...');
      
      // Get clients with joined profiles and albums
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select(`
          id,
          event_name,
          event_date,
          notes,
          created_at,
          user_id,
          albums (
            id,
            title,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (clientsError) {
        console.error('Error fetching clients:', clientsError);
        throw clientsError;
      }

      console.log('Clients fetched:', clientsData?.length || 0);

      // Now fetch profiles separately - admins should be able to see all
      const userIds = (clientsData || []).map(c => c.user_id).filter(Boolean);
      
      let profilesMap: Record<string, { name: string; email: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, name, email')
          .in('user_id', userIds);
        
        if (profilesError) {
          console.error('Error fetching profiles:', profilesError);
        } else if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => {
            acc[p.user_id] = { name: p.name, email: p.email };
            return acc;
          }, {} as Record<string, { name: string; email: string }>);
        }
      }

      // Fetch email logs for welcome emails to these clients
      const emails = Object.values(profilesMap).map(p => p.email).filter(Boolean);
      let emailStatusMap: Record<string, EmailStatus> = {};

      if (emails.length > 0) {
        const { data: emailLogs, error: emailLogsError } = await supabase
          .from('email_logs')
          .select('to_email, status, created_at')
          .eq('template_type', 'welcome')
          .in('to_email', emails)
          .order('created_at', { ascending: false });

        if (emailLogsError) {
          console.error('Error fetching email logs:', emailLogsError);
        } else if (emailLogs) {
          // Get the most recent status for each email
          emailLogs.forEach((log) => {
            if (!emailStatusMap[log.to_email]) {
              emailStatusMap[log.to_email] = log.status as EmailStatus;
            }
          });
        }
      }

      // Combine the data
      const clientsWithProfiles = (clientsData || []).map(client => {
        const profile = profilesMap[client.user_id] || { name: 'Unknown', email: 'N/A' };
        return {
          ...client,
          profiles: profile,
          albums: client.albums || [],
          emailStatus: (emailStatusMap[profile.email] || 'none') as EmailStatus,
        };
      });

      console.log('Clients with profiles:', clientsWithProfiles);
      setClients(clientsWithProfiles);
    } catch (error) {
      console.error('Error in fetchClients:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filteredClients = clients.filter((client) => {
    const searchLower = searchQuery.toLowerCase();
    const name = client.profiles?.name || '';
    const email = client.profiles?.email || '';
    
    // Search filter
    const matchesSearch = 
      name.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      client.event_name.toLowerCase().includes(searchLower);
    
    // Email status filter
    const matchesEmailStatus = 
      emailStatusFilter === 'all' || client.emailStatus === emailStatusFilter;
    
    return matchesSearch && matchesEmailStatus;
  });

  const emailStatusCounts = {
    all: clients.length,
    sent: clients.filter(c => c.emailStatus === 'sent').length,
    failed: clients.filter(c => c.emailStatus === 'failed').length,
    pending: clients.filter(c => c.emailStatus === 'pending').length,
    none: clients.filter(c => c.emailStatus === 'none').length,
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredClients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredClients.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleDeleteClient = async () => {
    if (!deleteClientId) return;

    const clientToDelete = clients.find(c => c.id === deleteClientId);
    setIsDeleting(true);

    try {
      const { data, error } = await supabase.functions.invoke('storage-cleanup', {
        body: {
          action: 'delete_client',
          clientId: deleteClientId,
        },
      });

      if (error) throw error;

      toast({
        title: 'Client deleted',
        description: `${clientToDelete?.profiles?.name || 'Client'} and all associated data have been permanently deleted. ${data?.mediaCount || 0} files removed from storage.`,
      });

      setDeleteClientId(null);
      fetchClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete client',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getClientToDelete = () => {
    return clients.find(c => c.id === deleteClientId);
  };

  const selectedClients = filteredClients
    .filter(c => selectedIds.has(c.id))
    .map(c => ({
      id: c.id,
      name: c.profiles?.name || 'Unknown',
      email: c.profiles?.email || '',
    }))
    .filter(c => c.email && c.email !== 'N/A');

  const isAllSelected = filteredClients.length > 0 && selectedIds.size === filteredClients.length;
  const isSomeSelected = selectedIds.size > 0;

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-light text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage your photography clients</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchClients} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <CreateClientDialog onSuccess={fetchClients} />
          </div>
        </div>

        {/* Email Deliverability Warning */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-amber-600 dark:text-amber-400">
              Emails may go to spam folders
            </p>
            <p className="text-muted-foreground">
              Welcome emails are sent from a test domain (<code className="bg-muted px-1 rounded text-xs">onboarding@resend.dev</code>). 
              Ask clients to check their <strong>spam/junk folder</strong>. 
              To fix this permanently, verify your domain at{' '}
              <a 
                href="https://resend.com/domains" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                resend.com/domains
              </a>.
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Email Status Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-muted-foreground text-sm">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Email:</span>
            </div>
            <div className="flex gap-1 flex-wrap">
              <Button
                variant={emailStatusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEmailStatusFilter('all')}
                className="h-8"
              >
                All ({emailStatusCounts.all})
              </Button>
              <Button
                variant={emailStatusFilter === 'sent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEmailStatusFilter('sent')}
                className="h-8 border-green-500/30 hover:bg-green-500/10"
              >
                <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
                Sent ({emailStatusCounts.sent})
              </Button>
              <Button
                variant={emailStatusFilter === 'failed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEmailStatusFilter('failed')}
                className="h-8 border-destructive/30 hover:bg-destructive/10"
              >
                <span className="w-2 h-2 rounded-full bg-destructive mr-1.5" />
                Failed ({emailStatusCounts.failed})
              </Button>
              <Button
                variant={emailStatusFilter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEmailStatusFilter('pending')}
                className="h-8 border-yellow-500/30 hover:bg-yellow-500/10"
              >
                <span className="w-2 h-2 rounded-full bg-yellow-500 mr-1.5" />
                Pending ({emailStatusCounts.pending})
              </Button>
              <Button
                variant={emailStatusFilter === 'none' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEmailStatusFilter('none')}
                className="h-8 border-muted-foreground/30 hover:bg-muted/50"
              >
                <span className="w-2 h-2 rounded-full bg-muted-foreground mr-1.5" />
                None ({emailStatusCounts.none})
              </Button>
            </div>
          </div>
        </div>

        {/* Bulk Action Bar */}
        <AnimatePresence>
          {isSomeSelected && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-between gap-4 p-3 bg-primary/10 border border-primary/20 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {selectedIds.size} client{selectedIds.size !== 1 ? 's' : ''} selected
                </span>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setBulkEmailOpen(true)}
                  disabled={selectedClients.length === 0}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email ({selectedClients.length})
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Card View */}
        <div className="block sm:hidden space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading clients...</div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No clients found matching your search' : 'No clients yet'}
            </div>
          ) : (
            filteredClients.map((client) => (
              <div 
                key={client.id} 
                className={`bg-card border rounded-lg p-4 space-y-3 transition-colors ${
                  selectedIds.has(client.id) ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Checkbox
                      checked={selectedIds.has(client.id)}
                      onCheckedChange={() => toggleSelect(client.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{client.profiles?.name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground truncate">{client.profiles?.email || 'N/A'}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/admin/albums?client=${client.id}`)}>
                        <Eye size={16} className="mr-2" />
                        View Albums
                      </DropdownMenuItem>
                      <EmailHistoryDialog
                        clientEmail={client.profiles?.email || ''}
                        clientName={client.profiles?.name || 'Client'}
                        trigger={
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <History size={16} className="mr-2" />
                            Email History
                          </DropdownMenuItem>
                        }
                      />
                      <DropdownMenuItem>
                        <Mail size={16} className="mr-2" />
                        Send Email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteClientId(client.id)}
                      >
                        <Trash2 size={16} className="mr-2" />
                        Delete Client
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Event</p>
                    <p className="truncate">{client.event_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Date</p>
                    <p>{client.event_date ? format(new Date(client.event_date), 'MMM d, yyyy') : '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Albums</p>
                    <p>{client.albums.length} album{client.albums.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Welcome Email</p>
                    <EmailStatusBadge
                      status={client.emailStatus}
                      email={client.profiles?.email || ''}
                      clientName={client.profiles?.name || 'Client'}
                      clientId={client.id}
                      onRetrySuccess={fetchClients}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Event</TableHead>
                <TableHead className="hidden md:table-cell">Event Date</TableHead>
                <TableHead className="hidden lg:table-cell">Albums</TableHead>
                <TableHead>Email Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading clients...
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'No clients found matching your search' : 'No clients yet'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow 
                    key={client.id} 
                    className={`hover:bg-muted/20 ${selectedIds.has(client.id) ? 'bg-primary/5' : ''}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(client.id)}
                        onCheckedChange={() => toggleSelect(client.id)}
                        aria-label={`Select ${client.profiles?.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{client.profiles?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{client.profiles?.email || 'N/A'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{client.event_name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {client.event_date 
                        ? format(new Date(client.event_date), 'MMM d, yyyy')
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm">
                        {client.albums.length} album{client.albums.length !== 1 ? 's' : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <EmailStatusBadge
                        status={client.emailStatus}
                        email={client.profiles?.email || ''}
                        clientName={client.profiles?.name || 'Client'}
                        clientId={client.id}
                        onRetrySuccess={fetchClients}
                      />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/admin/albums?client=${client.id}`)}>
                            <Eye size={16} className="mr-2" />
                            View Albums
                          </DropdownMenuItem>
                          <EmailHistoryDialog
                            clientEmail={client.profiles?.email || ''}
                            clientName={client.profiles?.name || 'Client'}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <History size={16} className="mr-2" />
                                Email History
                              </DropdownMenuItem>
                            }
                          />
                          <DropdownMenuItem>
                            <Mail size={16} className="mr-2" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteClientId(client.id)}
                          >
                            <Trash2 size={16} className="mr-2" />
                            Delete Client
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

        {/* Bulk Email Dialog */}
        <BulkEmailDialog
          open={bulkEmailOpen}
          onOpenChange={setBulkEmailOpen}
          clients={selectedClients}
          onComplete={() => {
            fetchClients();
            clearSelection();
          }}
        />

        {/* Delete Client Dialog */}
        <DeleteConfirmDialog
          title="Delete Client"
          description="This action will permanently delete this client and all associated data from your system and AWS S3 storage."
          entityName={getClientToDelete()?.profiles?.name || getClientToDelete()?.event_name}
          warningItems={[
            'All albums belonging to this client',
            'All photos and videos in those albums (from S3 storage)',
            'All share links and access permissions',
            'Email history and client profile',
          ]}
          confirmText="DELETE"
          isDeleting={isDeleting}
          onConfirm={handleDeleteClient}
          open={!!deleteClientId}
          onOpenChange={(open) => !open && setDeleteClientId(null)}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminClients;
