import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Search, MoreVertical, Mail, Eye, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { CreateClientDialog } from '@/components/admin/CreateClientDialog';
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

      // Combine the data
      const clientsWithProfiles = (clientsData || []).map(client => ({
        ...client,
        profiles: profilesMap[client.user_id] || { name: 'Unknown', email: 'N/A' },
        albums: client.albums || [],
      }));

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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-light text-foreground">Clients</h1>
            <p className="text-muted-foreground mt-1">Manage your photography clients</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={fetchClients} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <CreateClientDialog onSuccess={fetchClients} />
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Client</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Albums</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading clients...
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
                    <TableCell>
                      {client.event_date 
                        ? format(new Date(client.event_date), 'MMM d, yyyy')
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {client.albums.length} album{client.albums.length !== 1 ? 's' : ''}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(client.created_at), 'MMM d, yyyy')}
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
