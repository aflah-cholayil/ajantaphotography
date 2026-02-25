import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Search, Plus, MoreVertical, Send, Eye, Pencil, Trash2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { QuotationFormDialog } from '@/components/admin/QuotationFormDialog';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Quotation {
  id: string;
  quotation_number: string;
  client_name: string;
  client_email: string;
  event_type: string | null;
  event_date: string | null;
  event_dates: string[] | null;
  total_amount: number;
  status: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground border-muted' },
  sent: { label: 'Sent', className: 'bg-blue-500/20 text-blue-500 border-blue-500/30' },
  viewed: { label: 'Viewed', className: 'bg-amber-500/20 text-amber-500 border-amber-500/30' },
  accepted: { label: 'Accepted', className: 'bg-green-500/20 text-green-500 border-green-500/30' },
  rejected: { label: 'Rejected', className: 'bg-red-500/20 text-red-500 border-red-500/30' },
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const AdminQuotations = () => {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [prefillBookingId, setPrefillBookingId] = useState<string | null>(null);

  const fetchQuotations = async () => {
    const { data, error } = await supabase
      .from('quotations')
      .select('id, quotation_number, client_name, client_email, event_type, event_date, event_dates, total_amount, status, created_at')
      .order('created_at', { ascending: false });
    if (!error) setQuotations((data as unknown as Quotation[]) || []);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  // Handle prefill from booking
  useEffect(() => {
    const fromBooking = searchParams.get('fromBooking');
    if (fromBooking) {
      setPrefillBookingId(fromBooking);
      setFormOpen(true);
      setSearchParams({});
    }
  }, [searchParams]);

  const handleSend = async (id: string) => {
    setSending(id);
    try {
      const { data, error } = await supabase.functions.invoke('send-quotation', {
        body: { quotationId: id },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Failed to send');
      toast({ title: 'Quotation sent', description: 'Email sent successfully' });
      fetchQuotations();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSending(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('quotations').delete().eq('id', deleteId);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Quotation deleted successfully' });
      setDeleteId(null);
      fetchQuotations();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const openEdit = (id: string) => {
    setEditId(id);
    setPrefillBookingId(null);
    setFormOpen(true);
  };

  const openCreate = () => {
    setEditId(null);
    setPrefillBookingId(null);
    setFormOpen(true);
  };

  const filtered = quotations.filter(q => {
    const matchesSearch =
      q.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.client_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.quotation_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-light text-foreground">Quotations</h1>
            <p className="text-muted-foreground mt-1">Create and manage client quotations</p>
          </div>
          <Button onClick={openCreate}>
            <Plus size={16} className="mr-2" /> New Quotation
          </Button>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search quotations..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Quotation #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Event Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchQuery || statusFilter !== 'all' ? 'No quotations found' : 'No quotations yet. Create your first one!'}
                  </TableCell>
                </TableRow>
              ) : filtered.map(q => (
                <TableRow key={q.id} className="hover:bg-muted/20">
                  <TableCell className="font-mono text-sm">{q.quotation_number}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{q.client_name}</p>
                      <p className="text-sm text-muted-foreground">{q.client_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{q.event_type || '-'}</TableCell>
                  <TableCell>
                    {(() => {
                      const dates = q.event_dates?.length ? q.event_dates : q.event_date ? [q.event_date] : [];
                      if (dates.length === 0) return '-';
                      if (dates.length === 1) return format(new Date(dates[0]), 'MMM d, yyyy');
                      return (
                        <div>
                          <span>{format(new Date(dates[0]), 'MMM d, yyyy')}</span>
                          <Badge variant="outline" className="ml-2 text-xs">+{dates.length - 1} more</Badge>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(q.total_amount)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusConfig[q.status]?.className || ''}>
                      {statusConfig[q.status]?.label || q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(q.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical size={16} /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => window.open(`/quotation/${q.quotation_number}`, '_blank')}>
                          <Eye size={16} className="mr-2" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(q.id)}>
                          <Pencil size={16} className="mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleSend(q.id)} disabled={sending === q.id}>
                          <Send size={16} className="mr-2" /> {sending === q.id ? 'Sending...' : 'Send Email'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteId(q.id)} className="text-destructive">
                          <Trash2 size={16} className="mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <QuotationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        quotationId={editId}
        prefillBookingId={prefillBookingId}
        onSaved={fetchQuotations}
      />

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Quotation"
        description="Are you sure you want to delete this quotation? This action cannot be undone."
      />
    </AdminLayout>
  );
};

export default AdminQuotations;
