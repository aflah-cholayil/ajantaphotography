import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Download, Check, X, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MinimalFooter } from '@/components/shared/MinimalFooter';
import logoSrc from '@/assets/logo.png';
import { registerPDFFont } from '@/lib/pdfFont';

interface QuotationData {
  id: string;
  quotation_number: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  event_type: string | null;
  event_date: string | null;
  event_dates: string[] | null;
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

// formatCurrencyPDF removed — registerPDFFont enables ₹ in PDFs

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Sanitize HTML for safe rendering
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '');
}

// Convert HTML to structured plain text for PDF, preserving bullets
function htmlToStructuredText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  let result = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'li') result += '  • ';
      if (tag === 'br' || tag === 'p' || tag === 'div') result += '\n';
      el.childNodes.forEach(walk);
      if (tag === 'li' || tag === 'p' || tag === 'div') result += '\n';
    }
  };
  div.childNodes.forEach(walk);
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

// Get effective dates array with backward compat
function getEventDates(q: QuotationData): string[] {
  if (q.event_dates && q.event_dates.length > 0) return q.event_dates;
  if (q.event_date) return [q.event_date];
  return [];
}

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

  // Timeout protection for slow mobile networks
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Request timed out. Please check your connection and try again.');
      }
    }, 15000);
    return () => clearTimeout(timer);
  }, [loading]);

  const fetchQuotation = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-quotation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ quotation_number: quotationNumber }),
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Quotation not found');
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
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-quotation-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ quotation_number: quotationNumber, action }),
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to update');
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
    await registerPDFFont(doc);

    const margin = 20;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const contentW = pageW - margin * 2;
    let y = margin;

    // ── Colors ──
    const gold: [number, number, number] = [212, 175, 55];
    const textDark: [number, number, number] = [34, 34, 34];
    const textMuted: [number, number, number] = [136, 136, 136];
    const bgBox: [number, number, number] = [247, 247, 247];
    const borderLight: [number, number, number] = [238, 238, 238];

    // ── Helper: check page break ──
    const checkPage = (needed: number) => {
      if (y + needed > pageH - 25) {
        doc.addPage();
        y = margin;
      }
    };

    // ── Helper: draw footer on current page ──
    const drawFooter = () => {
      const fy = pageH - 12;
      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      const studioName = 'Ajanta Photography';
      const addr = `${studioConfig.address_line1 || 'GHSS School Junction, Pandalur'}, ${studioConfig.address_line2 || 'The Nilgiris'} – ${studioConfig.pincode || '643233'}`;
      const contact = `Phone: ${studioConfig.primary_phone || studioConfig.phones || '+91 94435 68486'}  |  Email: ${studioConfig.email || 'ajantastudiopandalur@gmail.com'}  |  ajantaphotography.in`;
      doc.text(studioName, pageW / 2, fy - 4, { align: 'center' });
      doc.text(addr, pageW / 2, fy, { align: 'center' });
      doc.text(contact, pageW / 2, fy + 4, { align: 'center' });
    };

    // ═══════════════════════════════════════
    // 1) HEADER — Logo left, title right
    // ═══════════════════════════════════════
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        img.onload = () => {
          doc.addImage(img, 'PNG', margin, y, 25, 25);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = logoSrc;
      });
    } catch { /* logo skipped */ }

    // Right-aligned header text
    doc.setFontSize(24);
    doc.setTextColor(...textDark);
    doc.text('QUOTATION', pageW - margin, y + 8, { align: 'right' });
    doc.setFontSize(10);
    doc.setTextColor(...textMuted);
    doc.text(quotation.quotation_number, pageW - margin, y + 15, { align: 'right' });
    doc.text(`Date: ${formatDate(quotation.created_at)}`, pageW - margin, y + 21, { align: 'right' });
    if (quotation.valid_until) {
      doc.text(`Valid Until: ${formatDate(quotation.valid_until)}`, pageW - margin, y + 27, { align: 'right' });
    }

    y += 32;

    // Gold divider line
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    // ═══════════════════════════════════════
    // 2) CLIENT + EVENT SECTION
    // ═══════════════════════════════════════
    const boxH = 32;
    doc.setFillColor(...bgBox);
    doc.roundedRect(margin, y - 4, contentW, boxH, 2, 2, 'F');

    // Left column — Bill To
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text('BILL TO', margin + 5, y + 2);
    doc.setFontSize(10);
    doc.setTextColor(...textDark);
    doc.text(quotation.client_name, margin + 5, y + 8);
    doc.setFontSize(9);
    doc.setTextColor(...textMuted);
    doc.text(quotation.client_email, margin + 5, y + 13);
    if (quotation.client_phone) {
      doc.text(quotation.client_phone, margin + 5, y + 18);
    }

    // Right column — Event Details
    const rightColX = margin + contentW / 2 + 5;
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text('EVENT DETAILS', rightColX, y + 2);
    doc.setFontSize(10);
    doc.setTextColor(...textDark);
    if (quotation.event_type) {
      doc.text(quotation.event_type, rightColX, y + 8);
    }
    const eventDates = getEventDates(quotation);
    if (eventDates.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(...textMuted);
      const datesStr = eventDates.map(d => formatDate(d)).join(', ');
      const dateLines = doc.splitTextToSize(datesStr, contentW / 2 - 10);
      doc.text(dateLines, rightColX, y + (quotation.event_type ? 13 : 8));
    }

    y += boxH + 8;

    // ═══════════════════════════════════════
    // 3) TERMS & CONDITIONS (moved before Items Table)
    // ═══════════════════════════════════════
    if (quotation.notes) {
      checkPage(20);
      doc.setFontSize(11);
      doc.setTextColor(...textDark);
      doc.text('TERMS & CONDITIONS', margin, y);
      y += 2;
      doc.setDrawColor(...gold);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + 45, y);
      y += 6;

      // ── HTML-aware renderer ──
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = quotation.notes;

      const centerX = pageW / 2;
      let listCounter = 0;

      const getAlign = (el: HTMLElement): string => {
        const style = el.getAttribute('style') || '';
        const match = style.match(/text-align:\s*(center|right|left)/i);
        return match ? match[1].toLowerCase() : 'left';
      };

      const drawTextBlock = (text: string, fontSize: number, bold: boolean, align: string, indent: number = 0) => {
        doc.setFontSize(fontSize);
        doc.setFont('NotoSans', bold ? 'bold' : 'normal');
        doc.setTextColor(34, 34, 34);
        const maxW = contentW - indent;
        const lines = doc.splitTextToSize(text, maxW);
        for (let i = 0; i < lines.length; i++) {
          checkPage(fontSize * 0.5 + 2);
          if (align === 'center') {
            doc.text(lines[i], centerX, y, { align: 'center' });
          } else if (align === 'right') {
            doc.text(lines[i], pageW - margin, y, { align: 'right' });
          } else {
            doc.text(lines[i], margin + indent, y);
          }
          y += fontSize * 0.45 + 1;
        }
      };

      const walkNode = (node: Node, inheritBold: boolean = false, inList: 'ul' | 'ol' | null = null) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.replace(/\s+/g, ' ') || '';
          if (text.trim()) {
            // Text nodes inside block elements are handled by the parent
            // Only draw if parent is inline or direct child of container
            const parent = node.parentElement;
            const parentTag = parent?.tagName.toLowerCase() || '';
            if (!['h1', 'h2', 'h3', 'p', 'li', 'div'].includes(parentTag)) {
              drawTextBlock(text.trim(), 9, inheritBold, 'left');
            }
          }
          return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const align = getAlign(el);
        const isBold = inheritBold || tag === 'strong' || tag === 'b';

        // Collect all text content from children (preserving bold segments)
        const getTextContent = (n: Node): string => {
          let t = '';
          n.childNodes.forEach(c => {
            if (c.nodeType === Node.TEXT_NODE) {
              t += c.textContent || '';
            } else {
              t += getTextContent(c);
            }
          });
          return t;
        };

        // Check if element has any bold children
        const hasBoldChild = (n: Node): boolean => {
          for (let i = 0; i < n.childNodes.length; i++) {
            const c = n.childNodes[i];
            if (c.nodeType === Node.ELEMENT_NODE) {
              const ct = (c as HTMLElement).tagName.toLowerCase();
              if (ct === 'strong' || ct === 'b') return true;
              if (hasBoldChild(c)) return true;
            }
          }
          return false;
        };

        switch (tag) {
          case 'h1':
            y += 4;
            drawTextBlock(getTextContent(el).trim(), 18, true, align);
            y += 3;
            break;
          case 'h2':
            y += 3;
            drawTextBlock(getTextContent(el).trim(), 15, true, align);
            y += 2;
            break;
          case 'h3':
            y += 2;
            drawTextBlock(getTextContent(el).trim(), 13, true, align);
            y += 2;
            break;
          case 'p': {
            const text = getTextContent(el).trim();
            if (text) {
              y += 2;
              const pBold = isBold || hasBoldChild(el);
              drawTextBlock(text, 9, pBold, align);
              y += 1;
            }
            break;
          }
          case 'ul':
            y += 1;
            el.childNodes.forEach(c => walkNode(c, isBold, 'ul'));
            y += 1;
            break;
          case 'ol':
            listCounter = 0;
            y += 1;
            el.childNodes.forEach(c => walkNode(c, isBold, 'ol'));
            y += 1;
            break;
          case 'li': {
            const liText = getTextContent(el).trim();
            if (liText) {
              checkPage(6);
              doc.setFontSize(9);
              doc.setFont('NotoSans', isBold ? 'bold' : 'normal');
              doc.setTextColor(34, 34, 34);
              if (inList === 'ol') {
                listCounter++;
                doc.text(`${listCounter}.`, margin + 4, y);
              } else {
                doc.text('•', margin + 4, y);
              }
              const liLines = doc.splitTextToSize(liText, contentW - 14);
              for (let i = 0; i < liLines.length; i++) {
                if (i > 0) checkPage(5);
                doc.text(liLines[i], margin + 10, y);
                y += 4;
              }
            }
            break;
          }
          case 'br':
            y += 3;
            break;
          case 'strong':
          case 'b':
            el.childNodes.forEach(c => walkNode(c, true, inList));
            break;
          case 'div':
          default:
            el.childNodes.forEach(c => walkNode(c, isBold, inList));
            break;
        }
      };

      tempDiv.childNodes.forEach(c => walkNode(c));

      // Reset font
      doc.setFont('NotoSans', 'normal');
      y += 6;
    }

    // ═══════════════════════════════════════
    // 4) ITEMS TABLE
    // ═══════════════════════════════════════
    const col = {
      num: margin,
      item: margin + 12,
      desc: margin + 52,
      qty: margin + 110,
      price: margin + 130,
      total: margin + 155,
    };
    const rowH = 7;
    const headerH = 8;

    // Table header
    doc.setFillColor(...gold);
    doc.rect(margin, y, contentW, headerH, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    const headerY = y + 5.5;
    doc.text('#', col.num + 2, headerY);
    doc.text('Item', col.item, headerY);
    doc.text('Description', col.desc, headerY);
    doc.text('Qty', col.qty + 5, headerY, { align: 'center' });
    doc.text('Price', col.price + 10, headerY, { align: 'right' });
    doc.text('Total', pageW - margin - 2, headerY, { align: 'right' });
    y += headerH;

    // Table rows
    items.forEach((item, i) => {
      const descLines = item.description
        ? doc.splitTextToSize(item.description, col.qty - col.desc - 3)
        : [];
      const neededH = Math.max(rowH, descLines.length * 4 + 4);
      checkPage(neededH + 2);

      doc.setFontSize(8);
      doc.setTextColor(...textDark);
      const cellY = y + 5;
      doc.text(`${i + 1}`, col.num + 2, cellY);
      doc.text(item.item_name.substring(0, 25), col.item, cellY);
      if (descLines.length > 0) {
        doc.setFontSize(7);
        doc.setTextColor(...textMuted);
        doc.text(descLines, col.desc, cellY);
        doc.setFontSize(8);
      }
      doc.setTextColor(...textDark);
      doc.text(`${item.quantity}`, col.qty + 5, cellY, { align: 'center' });
      doc.text(formatCurrency(item.price), col.price + 10, cellY, { align: 'right' });
      doc.text(formatCurrency(item.total), pageW - margin - 2, cellY, { align: 'right' });

      y += neededH;
      // Row border
      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
    });

    y += 10;

    // ═══════════════════════════════════════
    // 5) TOTALS SECTION
    // ═══════════════════════════════════════
    checkPage(40);
    const totalsLabelX = pageW - margin - 60;
    const totalsValX = pageW - margin - 2;

    doc.setFontSize(9);
    doc.setTextColor(...textDark);
    doc.text('Subtotal:', totalsLabelX, y);
    doc.text(formatCurrency(quotation.subtotal), totalsValX, y, { align: 'right' });
    y += 6;

    if (quotation.discount_amount > 0) {
      doc.text('Discount:', totalsLabelX, y);
      doc.text(`-${formatCurrency(quotation.discount_amount)}`, totalsValX, y, { align: 'right' });
      y += 6;
    }

    if (quotation.tax_percentage > 0) {
      const taxAmt = quotation.subtotal * quotation.tax_percentage / 100;
      doc.text(`Tax (${quotation.tax_percentage}%):`, totalsLabelX, y);
      doc.text(formatCurrency(taxAmt), totalsValX, y, { align: 'right' });
      y += 6;
    }

    // Separator
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.3);
    doc.line(totalsLabelX - 5, y, pageW - margin, y);
    y += 7;

    // Grand Total
    doc.setFontSize(14);
    doc.setTextColor(...gold);
    doc.text('GRAND TOTAL:', totalsLabelX - 15, y);
    doc.text(formatCurrency(quotation.total_amount), totalsValX, y, { align: 'right' });
    y += 14;

    // ═══════════════════════════════════════
    // 6) FOOTER
    // ═══════════════════════════════════════
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter();
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
  const eventDates = getEventDates(quotation);

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
        {(quotation.event_type || eventDates.length > 0) && (
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              {quotation.event_type && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Event</p>
                  <p className="font-medium text-foreground">{quotation.event_type}</p>
                </div>
              )}
              {eventDates.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Event Date{eventDates.length > 1 ? 's' : ''}
                  </p>
                  <div className="font-medium text-foreground">
                    {eventDates.map((d, i) => (
                      <p key={i}>{formatDate(d)}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes / Terms - now between event details and items */}
        {quotation.notes && (
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Terms & Notes</p>
            <div
              className="quotation-notes text-sm text-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(quotation.notes) }}
            />
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
