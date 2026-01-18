import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, MoreVertical, Mail, Eye, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { CreateClientDialog } from '@/components/admin/CreateClientDialog';
import { EmailStatusBadge, type EmailStatus } from '@/components/admin/EmailStatusBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';

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

const AdminClients = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
    return (
      name.toLowerCase().includes(searchLower) ||
      email.toLowerCase().includes(searchLower) ||
      client.event_name.toLowerCase().includes(searchLower)
    );
  });

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

        {/* Search */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

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
              <div key={client.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{client.profiles?.name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground truncate">{client.profiles?.email || 'N/A'}</p>
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
                      <DropdownMenuItem>
                        <Mail size={16} className="mr-2" />
                        Send Email
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
                  <TableRow key={client.id} className="hover:bg-muted/20">
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
                          <DropdownMenuItem>
                            <Mail size={16} className="mr-2" />
                            Send Email
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
    </AdminLayout>
  );
};

export default AdminClients;
