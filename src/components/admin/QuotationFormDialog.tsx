import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
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
import { RichTextEditor } from '@/components/ui/RichTextEditor';

interface QuotationItem {
  id?: string;
  item_name: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
  display_order: number;
}

interface QuotationFormData {
  client_name: string;
  client_email: string;
  client_phone: string;
  event_type: string;
  event_dates: string[];
  tax_percentage: number;
  discount_amount: number;
  notes: string;
  valid_until: string;
  booking_id: string | null;
}

interface Booking {
  id: string;
  client_name: string;
  client_email: string;
  phone: string | null;
  event_type: string;
  event_date: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotationId?: string | null;
  prefillBookingId?: string | null;
  onSaved: () => void;
}

// Sanitize HTML - strip scripts, iframes, on* attributes
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

export function QuotationFormDialog({ open, onOpenChange, quotationId, prefillBookingId, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState<QuotationFormData>({
    client_name: '', client_email: '', client_phone: '',
    event_type: '', event_dates: [], tax_percentage: 0,
    discount_amount: 0, notes: '', valid_until: '', booking_id: null,
  });
  const [items, setItems] = useState<QuotationItem[]>([
    { item_name: '', description: '', quantity: 1, price: 0, total: 0, display_order: 0 },
  ]);

  // Calculate totals
  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.total, 0), [items]);
  const taxAmount = useMemo(() => subtotal * (form.tax_percentage / 100), [subtotal, form.tax_percentage]);
  const totalAmount = useMemo(() => subtotal + taxAmount - form.discount_amount, [subtotal, taxAmount, form.discount_amount]);

  // Fetch bookings for dropdown
  useEffect(() => {
    if (!open) return;
    supabase.from('bookings').select('id, client_name, client_email, phone, event_type, event_date')
      .order('created_at', { ascending: false }).then(({ data }) => setBookings(data || []));
  }, [open]);

  // Load existing quotation or prefill from booking
  useEffect(() => {
    if (!open) return;
    if (quotationId) {
      loadQuotation(quotationId);
    } else if (prefillBookingId) {
      const booking = bookings.find(b => b.id === prefillBookingId);
      if (booking) fillFromBooking(booking);
    } else {
      resetForm();
    }
  }, [open, quotationId, prefillBookingId, bookings]);


  const resetForm = () => {
    setForm({
      client_name: '', client_email: '', client_phone: '',
      event_type: '', event_dates: [], tax_percentage: 0,
      discount_amount: 0, notes: '', valid_until: '', booking_id: null,
    });
    setItems([{ item_name: '', description: '', quantity: 1, price: 0, total: 0, display_order: 0 }]);
  };

  const loadQuotation = async (id: string) => {
    const { data: q } = await supabase.from('quotations').select('*').eq('id', id).single();
    if (!q) return;
    // Backward compat: use event_dates array, fallback to single event_date
    const eventDates: string[] = (q as any).event_dates?.length
      ? (q as any).event_dates
      : q.event_date ? [q.event_date] : [];
    setForm({
      client_name: q.client_name, client_email: q.client_email,
      client_phone: q.client_phone || '', event_type: q.event_type || '',
      event_dates: eventDates, tax_percentage: Number(q.tax_percentage),
      discount_amount: Number(q.discount_amount), notes: q.notes || '',
      valid_until: q.valid_until || '', booking_id: q.booking_id,
    });
    const { data: itemsData } = await supabase.from('quotation_items')
      .select('*').eq('quotation_id', id).order('display_order');
    if (itemsData?.length) {
      setItems(itemsData.map(i => ({
        id: i.id, item_name: i.item_name, description: i.description || '',
        quantity: i.quantity, price: Number(i.price), total: Number(i.total),
        display_order: i.display_order,
      })));
    }
  };

  const fillFromBooking = (booking: Booking) => {
    setForm(prev => ({
      ...prev,
      client_name: booking.client_name,
      client_email: booking.client_email,
      client_phone: booking.phone || '',
      event_type: booking.event_type,
      event_dates: booking.event_date ? [booking.event_date] : [],
      booking_id: booking.id,
    }));
  };

  const updateItem = (index: number, field: keyof QuotationItem, value: string | number) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'quantity' || field === 'price') {
        item.total = Number(item.quantity) * Number(item.price);
      }
      updated[index] = item;
      return updated;
    });
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      item_name: '', description: '', quantity: 1, price: 0, total: 0,
      display_order: prev.length,
    }]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Multi-date handlers
  const addDate = () => {
    setForm(prev => ({ ...prev, event_dates: [...prev.event_dates, ''] }));
  };

  const updateDate = (index: number, value: string) => {
    setForm(prev => {
      const dates = [...prev.event_dates];
      dates[index] = value;
      return { ...prev, event_dates: dates };
    });
  };

  const removeDate = (index: number) => {
    setForm(prev => ({
      ...prev,
      event_dates: prev.event_dates.filter((_, i) => i !== index),
    }));
  };


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);
  };

  const handleSave = async () => {
    if (!form.client_name || !form.client_email) {
      toast({ title: 'Error', description: 'Client name and email are required', variant: 'destructive' });
      return;
    }
    if (items.some(i => !i.item_name)) {
      toast({ title: 'Error', description: 'All items must have a name', variant: 'destructive' });
      return;
    }

    const notesHtml = form.notes || '';

    setSaving(true);
    try {
      const filteredDates = form.event_dates.filter(d => d.trim() !== '');
      const quotationData: Record<string, any> = {
        client_name: form.client_name,
        client_email: form.client_email,
        client_phone: form.client_phone || null,
        event_type: form.event_type || null,
        event_date: filteredDates[0] || null, // backward compat
        event_dates: filteredDates,
        subtotal,
        tax_percentage: form.tax_percentage,
        discount_amount: form.discount_amount,
        total_amount: totalAmount,
        notes: sanitizeHtml(notesHtml) || null,
        valid_until: form.valid_until || null,
        booking_id: form.booking_id || null,
      };

      let qId = quotationId;

      if (quotationId) {
        const { error } = await supabase.from('quotations').update(quotationData as any).eq('id', quotationId);
        if (error) throw error;
        await supabase.from('quotation_items').delete().eq('quotation_id', quotationId);
      } else {
        const { data, error } = await supabase.from('quotations')
          .insert({ ...quotationData, quotation_number: '' } as any)
          .select('id').single();
        if (error) throw error;
        qId = data.id;
      }

      const itemsToInsert = items.map((item, i) => ({
        quotation_id: qId!,
        item_name: item.item_name,
        description: item.description || null,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        display_order: i,
      }));

      const { error: itemsErr } = await supabase.from('quotation_items').insert(itemsToInsert);
      if (itemsErr) throw itemsErr;

      toast({ title: 'Success', description: quotationId ? 'Quotation updated' : 'Quotation created' });
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {quotationId ? 'Edit Quotation' : 'Create New Quotation'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Fill from Booking */}
          {!quotationId && (
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Fill from Booking</Label>
              <Select
                value={form.booking_id || ''}
                onValueChange={(val) => {
                  const booking = bookings.find(b => b.id === val);
                  if (booking) fillFromBooking(booking);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a booking (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.client_name} — {b.event_type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Client Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Client Name *</Label>
              <Input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))} />
            </div>
            <div>
              <Label>Client Email *</Label>
              <Input type="email" value={form.client_email} onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))} />
            </div>
            <div>
              <Label>Client Phone</Label>
              <Input value={form.client_phone} onChange={e => setForm(p => ({ ...p, client_phone: e.target.value }))} />
            </div>
          </div>

          {/* Event Type */}
          <div>
            <Label>Event Type</Label>
            <Input value={form.event_type} onChange={e => setForm(p => ({ ...p, event_type: e.target.value }))} placeholder="e.g. Wedding, Pre-Wedding" />
          </div>

          {/* Event Dates (Multi) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Event Dates</Label>
              <Button variant="outline" size="sm" onClick={addDate} type="button">
                <Plus size={14} className="mr-1" /> Add Date
              </Button>
            </div>
            {form.event_dates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dates added. Click "Add Date" to add event dates.</p>
            ) : (
              <div className="space-y-2">
                {form.event_dates.map((date, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={date}
                      onChange={e => updateDate(index, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeDate(index)}
                      className="h-8 w-8 text-destructive shrink-0"
                      type="button"
                    >
                      <X size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes / Terms & Conditions (Rich Text) */}
          <div>
            <Label className="mb-2 block">Notes / Terms & Conditions</Label>
            <RichTextEditor
              content={form.notes}
              onChange={(html) => setForm(p => ({ ...p, notes: html }))}
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Items</Label>
              <Button variant="outline" size="sm" onClick={addItem} type="button">
                <Plus size={14} className="mr-1" /> Add Item
              </Button>
            </div>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-start border border-border rounded-lg p-3">
                  <div className="col-span-12 sm:col-span-4">
                    <Input placeholder="Item name *" value={item.item_name}
                      onChange={e => updateItem(index, 'item_name', e.target.value)} />
                  </div>
                  <div className="col-span-12 sm:col-span-3">
                    <Input placeholder="Description" value={item.description}
                      onChange={e => updateItem(index, 'description', e.target.value)} />
                  </div>
                  <div className="col-span-4 sm:col-span-1">
                    <Input type="number" min={1} placeholder="Qty" value={item.quantity}
                      onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Input type="number" min={0} placeholder="Price" value={item.price || ''}
                      onChange={e => updateItem(index, 'price', parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-3 sm:col-span-1 flex items-center justify-end text-sm font-medium text-foreground">
                    {formatCurrency(item.total)}
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <Button variant="ghost" size="icon" onClick={() => removeItem(index)}
                      disabled={items.length <= 1} className="h-8 w-8 text-destructive" type="button">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Tax %</Label>
                <Input type="number" min={0} max={100} className="w-20 h-8"
                  value={form.tax_percentage || ''} onChange={e => setForm(p => ({ ...p, tax_percentage: parseFloat(e.target.value) || 0 }))} />
              </div>
              <span className="text-sm font-medium">{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Discount</Label>
                <Input type="number" min={0} className="w-24 h-8"
                  value={form.discount_amount || ''} onChange={e => setForm(p => ({ ...p, discount_amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <span className="text-sm font-medium text-destructive">-{formatCurrency(form.discount_amount)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-border pt-3">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          {/* Valid Until */}
          <div className="w-48">
            <Label>Valid Until</Label>
            <Input type="date" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : quotationId ? 'Update Quotation' : 'Create Quotation'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
