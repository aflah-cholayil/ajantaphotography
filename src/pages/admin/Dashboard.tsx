import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Users, Image, Calendar, Eye, Download, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { CreateClientDialog } from '@/components/admin/CreateClientDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DashboardStats {
  totalClients: number;
  totalAlbums: number;
  pendingBookings: number;
  unreadMessages: number;
  totalViews: number;
  totalDownloads: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    totalAlbums: 0,
    pendingBookings: 0,
    unreadMessages: 0,
    totalViews: 0,
    totalDownloads: 0,
  });
  const [recentClients, setRecentClients] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      // Fetch counts and data
      const [
        { count: clientsCount },
        { count: albumsCount },
        { count: bookingsCount },
        { count: messagesCount },
        { data: shareLinksData },
        { data: clientsData },
        { data: bookings },
      ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase.from('albums').select('*', { count: 'exact', head: true }),
        supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('contact_messages').select('*', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('share_links').select('view_count, download_count'),
        supabase.from('clients').select(`
          id,
          event_name,
          event_date,
          created_at,
          user_id
        `).order('created_at', { ascending: false }).limit(5),
        supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

      // Fetch profiles for clients
      const userIds = (clientsData || []).map(c => c.user_id).filter(Boolean);
      let profilesMap: Record<string, { name: string; email: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name, email')
          .in('user_id', userIds);
        
        if (profilesData) {
          profilesMap = profilesData.reduce((acc, p) => {
            acc[p.user_id] = { name: p.name, email: p.email };
            return acc;
          }, {} as Record<string, { name: string; email: string }>);
        }
      }

      const clientsWithProfiles = (clientsData || []).map(client => ({
        ...client,
        profiles: profilesMap[client.user_id] || { name: 'Unknown', email: '' },
      }));

      // Calculate totals
      const totalViews = shareLinksData?.reduce((sum, link) => sum + (link.view_count || 0), 0) || 0;
      const totalDownloads = shareLinksData?.reduce((sum, link) => sum + (link.download_count || 0), 0) || 0;

      setStats({
        totalClients: clientsCount || 0,
        totalAlbums: albumsCount || 0,
        pendingBookings: bookingsCount || 0,
        unreadMessages: messagesCount || 0,
        totalViews,
        totalDownloads,
      });

      setRecentClients(clientsWithProfiles);
      setRecentBookings(bookings || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to realtime changes for bookings and messages
    const bookingsChannel = supabase
      .channel('dashboard_bookings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => fetchDashboardData()
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('dashboard_messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contact_messages' },
        () => fetchDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [fetchDashboardData]);

  const statCards = [
    { label: 'Total Clients', value: stats.totalClients, icon: Users, color: 'text-blue-500' },
    { label: 'Albums', value: stats.totalAlbums, icon: Image, color: 'text-green-500' },
    { label: 'Pending Bookings', value: stats.pendingBookings, icon: Calendar, color: 'text-yellow-500' },
    { label: 'Unread Messages', value: stats.unreadMessages, icon: MessageSquare, color: 'text-pink-500' },
    { label: 'Gallery Views', value: stats.totalViews, icon: Eye, color: 'text-purple-500' },
    { label: 'Downloads', value: stats.totalDownloads, icon: Download, color: 'text-primary' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl sm:text-3xl font-light text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">Welcome back to Ajanta Photography</p>
          </div>
          <CreateClientDialog onSuccess={fetchDashboardData} />
        </div>

        {/* Stats Grid - Mobile: 2 columns, larger: responsive */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="bg-card border-border">
              <CardContent className="p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                    <p className="text-xl sm:text-2xl lg:text-3xl font-light mt-0.5 sm:mt-1">{stat.value}</p>
                  </div>
                  <stat.icon className={`h-6 w-6 sm:h-8 sm:w-8 ${stat.color} opacity-80 hidden sm:block`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Recent Clients */}
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
              <CardTitle className="font-serif text-lg sm:text-xl font-light">Recent Clients</CardTitle>
              <button
                onClick={() => navigate('/admin/clients')}
                className="text-xs sm:text-sm text-primary hover:underline"
              >
                View all
              </button>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
              {recentClients.length === 0 ? (
                <p className="text-muted-foreground text-sm">No clients yet</p>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {recentClients.map((client) => (
                    <div key={client.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base truncate">{client.profiles?.name || 'Unknown'}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{client.event_name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs sm:text-sm text-muted-foreground">
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
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
              <CardTitle className="font-serif text-lg sm:text-xl font-light">Recent Bookings</CardTitle>
              <button
                onClick={() => navigate('/admin/bookings')}
                className="text-xs sm:text-sm text-primary hover:underline"
              >
                View all
              </button>
            </CardHeader>
            <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
              {recentBookings.length === 0 ? (
                <p className="text-muted-foreground text-sm">No bookings yet</p>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {recentBookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base truncate">{booking.client_name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">{booking.event_type}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
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
