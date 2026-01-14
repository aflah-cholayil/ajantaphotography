import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Search, MoreVertical, Mail, Check, X, Calendar } from 'lucide-react';
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

type BookingStatus = 'new' | 'contacted' | 'confirmed' | 'cancelled';

interface Booking {
  id: string;
  client_name: string;
  client_email: string;
  phone: string | null;
  event_type: string;
  event_date: string | null;
  message: string | null;
  admin_notes: string | null;
  status: BookingStatus;
  created_at: string;
}

const statusConfig: Record<BookingStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' },
  contacted: { label: 'Contacted', className: 'bg-blue-500/20 text-blue-500 border-blue-500/30' },
  confirmed: { label: 'Confirmed', className: 'bg-green-500/20 text-green-500 border-green-500/30' },
  cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground border-muted' },
};

const AdminBookings = () => {
  const { toast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const fetchBookings = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings((data as Booking[]) || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleUpdateStatus = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: 'Status updated',
        description: `Booking marked as ${newStatus}`,
      });

      fetchBookings();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedBooking) return;

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ admin_notes: adminNotes })
        .eq('id', selectedBooking.id);

      if (error) throw error;

      toast({
        title: 'Notes saved',
        description: 'Admin notes have been updated',
      });

      setSelectedBooking(null);
      fetchBookings();
    } catch (error: unknown) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save notes',
        variant: 'destructive',
      });
    }
  };

  const openBookingDetails = (booking: Booking) => {
    setSelectedBooking(booking);
    setAdminNotes(booking.admin_notes || '');
  };

  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch = 
      booking.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.client_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.event_type.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-serif text-3xl font-light text-foreground">Bookings</h1>
          <p className="text-muted-foreground mt-1">Manage booking requests</p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search bookings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Client</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading bookings...
                  </TableCell>
                </TableRow>
              ) : filteredBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery || statusFilter !== 'all' 
                      ? 'No bookings found matching your criteria' 
                      : 'No bookings yet'
                    }
                  </TableCell>
                </TableRow>
              ) : (
                filteredBookings.map((booking) => (
                  <TableRow 
                    key={booking.id} 
                    className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => openBookingDetails(booking)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{booking.client_name}</p>
                        <p className="text-sm text-muted-foreground">{booking.client_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{booking.event_type}</TableCell>
                    <TableCell>
                      {booking.event_date 
                        ? format(new Date(booking.event_date), 'MMM d, yyyy')
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusConfig[booking.status].className}>
                        {statusConfig[booking.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(booking.created_at), 'MMM d, yyyy')}
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
                            onClick={() => window.open(`mailto:${booking.client_email}`)}
                          >
                            <Mail size={16} className="mr-2" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleUpdateStatus(booking.id, 'contacted')}>
                            <Mail size={16} className="mr-2" />
                            Mark as Contacted
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(booking.id, 'confirmed')}>
                            <Check size={16} className="mr-2" />
                            Mark as Confirmed
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleUpdateStatus(booking.id, 'cancelled')}>
                            <X size={16} className="mr-2" />
                            Mark as Cancelled
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

      {/* Booking Details Dialog */}
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Booking Details</DialogTitle>
            <DialogDescription>
              View and manage this booking request
            </DialogDescription>
          </DialogHeader>
          
          {selectedBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Client</p>
                  <p className="font-medium">{selectedBooking.client_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Email</p>
                  <p className="font-medium">{selectedBooking.client_email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Phone</p>
                  <p className="font-medium">{selectedBooking.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Event Type</p>
                  <p className="font-medium">{selectedBooking.event_type}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Event Date</p>
                  <p className="font-medium">
                    {selectedBooking.event_date 
                      ? format(new Date(selectedBooking.event_date), 'MMMM d, yyyy')
                      : '-'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <Badge variant="outline" className={statusConfig[selectedBooking.status].className}>
                    {statusConfig[selectedBooking.status].label}
                  </Badge>
                </div>
              </div>

              {selectedBooking.message && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Message</p>
                  <p className="text-sm p-3 bg-muted rounded-lg">{selectedBooking.message}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Admin Notes</p>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add private notes about this booking..."
                  className="resize-none"
                  rows={3}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setSelectedBooking(null)} className="flex-1">
                  Close
                </Button>
                <Button onClick={handleSaveNotes} className="flex-1 btn-gold">
                  Save Notes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminBookings;
