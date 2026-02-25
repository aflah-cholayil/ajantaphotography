

# Fix Quotation View, Email, and PDF Issues

## Current State

After reviewing the code, the **view page** (`QuotationView.tsx`) and **email template** (`send-quotation/index.ts`) already have most fixes in place from the previous implementation:
- Notes render via `dangerouslySetInnerHTML` with `sanitizeHtml` (line 332)
- Multiple dates display correctly via `getEventDates` helper (lines 310-321)
- Notes section is positioned after event details (lines 326-335)
- Email template has multi-date support and sanitized HTML notes

The remaining issues are all in the **PDF generation** section of `QuotationView.tsx` (lines 119-246):

## Fixes Required

### 1. PDF: ₹ Symbol Shows as Small "1"

**Root cause**: jsPDF's default Helvetica font does not support the Unicode ₹ character.

**Fix**: Create a `formatCurrencyPDF` function that uses `"Rs."` prefix instead of ₹:

```typescript
const formatCurrencyPDF = (amount: number) =>
  'Rs. ' + new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0 }).format(amount);
```

Replace all `formatCurrency()` calls inside `handleDownloadPDF` with `formatCurrencyPDF()`. The web view continues using ₹ via `formatCurrency`.

### 2. PDF: Notes Section Position Wrong

**Current**: Notes are rendered after the totals section (lines 234-243).

**Fix**: Move the notes block to immediately after the event dates block (after line 173), before the items table header. This matches the view page and email layout order:

```
Event Type → Event Dates → Terms & Notes → Items Table → Totals
```

### 3. PDF: Notes Show Raw HTML Instead of Formatted Text

**Current**: `htmlToPlainText` strips all formatting, losing bullet structure.

**Fix**: Replace `htmlToPlainText` with a smarter HTML-to-text converter that preserves list structure:

```typescript
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
```

This preserves bullet points as `• ` prefixed lines in the PDF output.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/QuotationView.tsx` | Add `formatCurrencyPDF`, improve `htmlToPlainText`, move notes in PDF, use PDF-safe currency |

No database, edge function, or other file changes needed.

