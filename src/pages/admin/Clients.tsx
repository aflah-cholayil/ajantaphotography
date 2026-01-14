import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, MoreVertical, Mail, Eye } from 'lucide-react';
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
  profiles: {
    name: string;
    email: string;
  };
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

  const fetchClients = async () => {
    try {
      // First get clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, event_name, event_date, notes, created_at, user_id')
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      // Get profiles and albums for each client
      const clientsWithDetails = await Promise.all(
        (clientsData || []).map(async (client) => {
          const [profileRes, albumsRes] = await Promise.all([
            supabase.from('profiles').select('name, email').eq('user_id', client.user_id).single(),
            supabase.from('albums').select('id, title, status').eq('client_id', client.id),
          ]);
          return {
            ...client,
            profiles: profileRes.data || { name: 'Unknown', email: '' },
            albums: albumsRes.data || [],
          };
        })
      );

      setClients(clientsWithDetails as Client[]);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = clients.filter((client) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      client.profiles.name.toLowerCase().includes(searchLower) ||
      client.profiles.email.toLowerCase().includes(searchLower) ||
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
          <CreateClientDialog onSuccess={fetchClients} />
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
                        <p className="font-medium">{client.profiles.name}</p>
                        <p className="text-sm text-muted-foreground">{client.profiles.email}</p>
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
