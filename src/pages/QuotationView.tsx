import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MinimalFooter } from '@/components/shared/MinimalFooter';
import logoSrc from '@/assets/logo.png';

interface QuotationData {
  id: string;
  quotation_number: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  event_type: string | null;
  event_date: string | null;
  subtotal: number;
  tax_percentage: number;
  discount_amount: number;
  total_amount: number;
  notes: string | null;
  status: string;
  valid_until: string | null;
  created_at: string;
}

interface QuotationItem {
  id: string;
  item_name: string;
  description: string | null;
  quantity: number;
  price: number;
  total: number;
  display_order: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
};

const QuotationView = () => {
  const { quotationNumber } = useParams<{ quotationNumber: string }>();
  const { toast } = useToast();
  const [quotation, setQuotation] = useState<QuotationData | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [studioConfig, setStudioConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (!quotationNumber) return;
    fetchQuotation();
  }, [quotationNumber]);

  const fetchQuotation = async () => {
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('get-quotation', {
        body: { quotation_number: quotationNumber },
      });
      if (fnErr) throw fnErr;
      if (data.error) throw new Error(data.error);
      setQuotation(data.quotation);
      setItems(data.items || []);
      setStudioConfig(data.studioConfig || {});
    } catch (err: any) {
      setError(err.message || 'Quotation not found');
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (action: 'accept' | 'reject') => {
    setResponding(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-quotation-status', {
        body: { quotation_number: quotationNumber, action },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      toast({ title: action === 'accept' ? 'Quotation Accepted' : 'Quotation Rejected' });
      setQuotation(prev => prev ? { ...prev, status: data.status } : null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setResponding(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!quotation) return;
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const margin = 20;
    let y = margin;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text('Ajanta Photography', margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(studioConfig.address_line1 || 'GHSS School Junction, Pandalur', margin, y);
    y += 5;
    doc.text(`${studioConfig.address_line2 || 'The Nilgiris'} – ${studioConfig.pincode || '643233'}`, margin, y);
    y += 5;
    doc.text(`Phone: ${studioConfig.phones || '+91 94435 68486'}`, margin, y);
    y += 5;
    doc.text(`Email: ${studioConfig.email || 'ajantastudiopandalur@gmail.com'}`, margin, y);
    y += 12;

    // Quotation title
    doc.setFontSize(16);
    doc.setTextColor(40, 40, 40);
    doc.text(`Quotation: ${quotation.quotation_number}`, margin, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(`Date: ${formatDate(quotation.created_at)}`, margin, y);
    if (quotation.valid_until) {
      doc.text(`Valid Until: ${formatDate(quotation.valid_until)}`, margin + 80, y);
    }
    y += 10;

    // Client info
    doc.setFontSize(11);
    doc.setTextColor(40, 40, 40);
    doc.text('Bill To:', margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.text(quotation.client_name, margin, y); y += 5;
    doc.setTextColor(120, 120, 120);
    doc.text(quotation.client_email, margin, y); y += 5;
    if (quotation.client_phone) { doc.text(quotation.client_phone, margin, y); y += 5; }
    if (quotation.event_type) { doc.text(`Event: ${quotation.event_type}`, margin, y); y += 5; }
    if (quotation.event_date) { doc.text(`Event Date: ${formatDate(quotation.event_date)}`, margin, y); y += 5; }
    y += 8;

    // Items table header
    const colX = [margin, margin + 10, margin + 85, margin + 105, margin + 130, margin + 155];
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 4, 170, 8, 'F');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('#', colX[0], y);
    doc.text('Item', colX[1], y);
    doc.text('Qty', colX[2], y);
    doc.text('Price', colX[3], y);
    doc.text('Total', colX[4], y);
    y += 8;

    // Items
    doc.setTextColor(40, 40, 40);
    items.forEach((item, i) => {
      if (y > 260) { doc.addPage(); y = margin; }
      doc.text(`${i + 1}`, colX[0], y);
      doc.text(item.item_name.substring(0, 35), colX[1], y);
      doc.text(`${item.quantity}`, colX[2], y);
      doc.text(formatCurrency(item.price), colX[3], y);
      doc.text(formatCurrency(item.total), colX[4], y);
      y += 7;
      if (item.description) {
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text(item.description.substring(0, 50), colX[1], y);
        y += 5;
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
      }
    });

    y += 5;
    doc.line(margin, y, margin + 170, y);
    y += 8;

    // Totals
    const rightCol = margin + 130;
    doc.text('Subtotal:', margin + 100, y);
    doc.text(formatCurrency(quotation.subtotal), rightCol, y);
    y += 6;
    if (quotation.tax_percentage > 0) {
      doc.text(`Tax (${quotation.tax_percentage}%):`, margin + 100, y);
      doc.text(formatCurrency(quotation.subtotal * quotation.tax_percentage / 100), rightCol, y);
      y += 6;
    }
    if (quotation.discount_amount > 0) {
      doc.text('Discount:', margin + 100, y);
      doc.text(`-${formatCurrency(quotation.discount_amount)}`, rightCol, y);
      y += 6;
    }
    doc.setFontSize(12);
    doc.setTextColor(180, 146, 61);
    doc.text('Total:', margin + 100, y);
    doc.text(formatCurrency(quotation.total_amount), rightCol, y);
    y += 10;

    // Notes
    if (quotation.notes) {
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text('Terms & Notes:', margin, y); y += 6;
      doc.setFontSize(9);
      const lines = doc.splitTextToSize(quotation.notes, 170);
      doc.text(lines, margin, y);
    }

    doc.save(`Quotation-${quotation.quotation_number}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-serif text-foreground mb-2">Quotation Not Found</h1>
          <p className="text-muted-foreground">{error || 'This quotation does not exist or has been removed.'}</p>
        </div>
      </div>
    );
  }

  const taxAmount = quotation.subtotal * (quotation.tax_percentage / 100);
  const canRespond = ['sent', 'viewed'].includes(quotation.status);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <img src={logoSrc} alt="Ajanta Photography" className="h-16 sm:h-20 w-auto" />
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download size={16} className="mr-2" /> Download PDF
          </Button>
        </div>

        {/* Quotation Info */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Quotation</h1>
            <p className="text-primary font-mono">{quotation.quotation_number}</p>
            <p className="text-sm text-muted-foreground mt-1">Date: {formatDate(quotation.created_at)}</p>
            {quotation.valid_until && (
              <p className="text-sm text-muted-foreground">Valid Until: {formatDate(quotation.valid_until)}</p>
            )}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-1">Bill To</p>
            <p className="font-medium text-foreground">{quotation.client_name}</p>
            <p className="text-sm text-muted-foreground">{quotation.client_email}</p>
            {quotation.client_phone && <p className="text-sm text-muted-foreground">{quotation.client_phone}</p>}
          </div>
        </div>

        {/* Event Details */}
        {(quotation.event_type || quotation.event_date) && (
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              {quotation.event_type && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Event</p>
                  <p className="font-medium text-foreground">{quotation.event_type}</p>
                </div>
              )}
              {quotation.event_date && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Event Date</p>
                  <p className="font-medium text-foreground">{formatDate(quotation.event_date)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="border border-border rounded-lg overflow-hidden mb-6">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">#</th>
                <th className="text-left text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Item</th>
                <th className="text-center text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Qty</th>
                <th className="text-right text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Price</th>
                <th className="text-right text-xs text-muted-foreground uppercase tracking-wider px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 text-sm text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{item.item_name}</p>
                    {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground">{formatCurrency(item.price)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pricing Breakdown */}
        <div className="flex justify-end mb-6">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(quotation.subtotal)}</span>
            </div>
            {quotation.tax_percentage > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax ({quotation.tax_percentage}%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            {quotation.discount_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-green-500">-{formatCurrency(quotation.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold border-t border-border pt-2">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(quotation.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {quotation.notes && (
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Terms & Notes</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{quotation.notes}</p>
          </div>
        )}

        {/* Status Banner */}
        {quotation.status === 'accepted' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center mb-6">
            <Check className="h-6 w-6 text-green-500 mx-auto mb-2" />
            <p className="text-green-500 font-medium">This quotation has been accepted</p>
          </div>
        )}
        {quotation.status === 'rejected' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center mb-6">
            <X className="h-6 w-6 text-red-500 mx-auto mb-2" />
            <p className="text-red-500 font-medium">This quotation has been rejected</p>
          </div>
        )}

        {/* Accept / Reject Buttons */}
        {canRespond && (
          <div className="flex gap-4 justify-center mb-8">
            <Button onClick={() => handleResponse('accept')} disabled={responding}
              className="bg-green-600 hover:bg-green-700 text-white px-8">
              <Check size={16} className="mr-2" /> Accept Quotation
            </Button>
            <Button variant="outline" onClick={() => handleResponse('reject')} disabled={responding}
              className="border-red-500/30 text-red-500 hover:bg-red-500/10 px-8">
              <X size={16} className="mr-2" /> Reject
            </Button>
          </div>
        )}
      </div>
      <MinimalFooter />
    </div>
  );
};

export default QuotationView;
