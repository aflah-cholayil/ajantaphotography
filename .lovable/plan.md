

# Fix ₹ Symbol in PDF — Embed Unicode Font in jsPDF

## Problem

jsPDF's built-in fonts (Helvetica, Courier, Times) do not support the ₹ Unicode character (U+20B9). The current workaround uses `"Rs."` prefix instead. The user wants the actual `₹` symbol to appear in PDFs, matching the web view and email.

## Solution

Embed a subset of **Noto Sans** (a Google font that supports ₹) as a base64 string into jsPDF. This is the standard approach for jsPDF Unicode support.

## Technical Details

### Approach

1. **Create a font helper file** (`src/lib/pdfFont.ts`) containing:
   - A base64-encoded Noto Sans Regular TTF font (subset to Latin + Indian Rupee symbol to keep size reasonable ~30-50KB)
   - A helper function `registerPDFFont(doc)` that calls `doc.addFileToVFS`, `doc.addFont`, and `doc.setFont`

2. **Update `QuotationView.tsx`**:
   - Import and call `registerPDFFont(doc)` after creating the jsPDF instance
   - Remove `formatCurrencyPDF` — use `formatCurrency` (which outputs `₹`) for both web and PDF
   - All currency in the PDF will now render with the actual ₹ symbol

### File Changes

| File | Change |
|------|--------|
| `src/lib/pdfFont.ts` | New file — base64 Noto Sans font + register helper |
| `src/pages/QuotationView.tsx` | Import font helper, remove `formatCurrencyPDF`, use `formatCurrency` everywhere in PDF |

### Code Flow

```text
handleDownloadPDF()
  → const doc = new jsPDF()
  → registerPDFFont(doc)        // sets Noto Sans as active font
  → doc.text(formatCurrency(amount))  // ₹1,50,000 renders correctly
```

### Key Changes in QuotationView.tsx

- Line 43-44: Remove `formatCurrencyPDF` function
- Line 149-150: After `new jsPDF()`, add `registerPDFFont(doc)`
- Lines 238, 239, 258, 262, 267, 273: Replace all `formatCurrencyPDF(...)` with `formatCurrency(...)`

### Font Subset Strategy

Rather than embedding the full Noto Sans (~500KB base64), we'll use a minimal subset containing:
- ASCII Latin characters (A-Z, a-z, 0-9, punctuation)
- Indian Rupee sign (₹ U+20B9)
- Common symbols (comma, period, dash, colon)

This keeps the font file small (~40KB) while supporting all characters used in the quotation PDF.

### Result After Fix

- Web View: `₹1,50,000` ✔
- Email: `₹1,50,000` ✔  
- PDF: `₹1,50,000` ✔ (was showing `Rs. 1,50,000` or broken characters)

