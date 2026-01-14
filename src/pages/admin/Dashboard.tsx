import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Users, Image, Calendar, Eye, Download, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { CreateClientDialog } from '@/components/admin/CreateClientDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardStats {
  totalClients: number;
  totalAlbums: number;
  pendingBookings: number;
  totalViews: number;
  totalDownloads: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalAlbums: 0,
    pendingBookings: 0,
    totalViews: 0,
    totalDownloads: 0,
  });
  const [recentClients, setRecentClients] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      // Fetch counts
      const [
        { count: clientsCount },
        { count: albumsCount },
        { count: bookingsCount },
        { data: shareLinksData },
        { data: clients },
        { data: bookings },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('albums').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('share_links').select('view_count, download_count'),
        supabase.from('clients').select(`
          id,
          event_name,
          event_date,
          created_at,
          profiles!inner(name, email)
        `).order('created_at', { ascending: false }).limit(5),
        supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

      // Calculate totals
      const totalViews = shareLinksData?.reduce((sum, link) => sum + (link.view_count || 0), 0) || 0;
      const totalDownloads = shareLinksData?.reduce((sum, link) => sum + (link.download_count || 0), 0) || 0;

      setStats({
        totalClients: clientsCount || 0,
        totalAlbums: albumsCount || 0,
        pendingBookings: bookingsCount || 0,
        totalViews,
        totalDownloads,
      });

      setRecentClients(clients || []);
      setRecentBookings(bookings || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const statCards = [
    { label: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-blue-500' },
    { label: 'Albums', value: stats.totalAlbums, icon: Image, color: 'text-green-500' },
    { label: 'Pending Bookings', value: stats.pendingBookings, icon: Calendar, color: 'text-yellow-500' },
    { label: 'Gallery Views', value: stats.totalViews, icon: Eye, color: 'text-purple-500' },
    { label: 'Downloads', value: stats.totalDownloads, icon: Download, color: 'text-primary' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-light text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Welcome back to Ajanta Photography</p>
          </div>
          <CreateClientDialog onSuccess={fetchDashboardData} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-light mt-1">{stat.value}</p>
                  </div>
                  <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Clients */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-xl font-light">Recent Clients</CardTitle>
              <button
                onClick={() => navigate('/admin/clients')}
                className="text-sm text-primary hover:underline"
              >
                View all
              </button>
            </CardHeader>
            <CardContent>
              {recentClients.length === 0 ? (
                <p className="text-muted-foreground text-sm">No clients yet</p>
              ) : (
                <div className="space-y-4">
                  {recentClients.map((client) => (
                    <div key={client.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{client.profiles?.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{client.event_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {client.event_date 
                            ? format(new Date(client.event_date), 'MMM d, yyyy')
                            : 'No date'
                          }
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Bookings */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-serif text-xl font-light">Recent Bookings</CardTitle>
              <button
                onClick={() => navigate('/admin/bookings')}
                className="text-sm text-primary hover:underline"
              >
                View all
              </button>
            </CardHeader>
            <CardContent>
              {recentBookings.length === 0 ? (
                <p className="text-muted-foreground text-sm">No bookings yet</p>
              ) : (
                <div className="space-y-4">
                  {recentBookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{booking.client_name}</p>
                        <p className="text-sm text-muted-foreground">{booking.event_type}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block px-2 py-1 text-xs rounded ${
                          booking.status === 'new' 
                            ? 'bg-yellow-500/20 text-yellow-500' 
                            : booking.status === 'confirmed'
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
