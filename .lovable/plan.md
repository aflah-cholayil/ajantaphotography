

# Upgrade Quotation PDF Design

## Scope
Only the `handleDownloadPDF` function in `src/pages/QuotationView.tsx` (lines 163–294) will be rewritten. No other files, logic, database, email, or public page changes.

## Current State
The existing PDF is plain — flat text layout, no logo, basic grey table header, no two-column sections, notes placed before items, no footer.

## New PDF Layout

```text
┌─────────────────────────────────────────────┐
│  [LOGO]                    QUOTATION (bold) │
│                          AJ-2026-XXXX       │
│                          Date: ...          │
│                          Valid Until: ...    │
│─────────────── gold line ───────────────────│
│                                             │
│  BILL TO:              EVENT DETAILS:       │
│  ┌──────────────┐      ┌──────────────┐     │
│  │ Name         │      │ Event Name   │     │
│  │ Email        │      │ Event Dates  │     │
│  │ Phone        │      │              │     │
│  └──────────────┘      └──────────────┘     │
│  (light grey background box)                │
│                                             │
│  ┌─ ITEMS TABLE ────────────────────────┐   │
│  │ # │ Item │ Desc │ Qty │ Price │ Total│   │
│  │   (gold header, white text)          │   │
│  │   row with soft border               │   │
│  └──────────────────────────────────────┘   │
│                                             │
│                        Subtotal: ₹xxx       │
│                        Discount: -₹xxx      │
│                        Tax: ₹xxx            │
│                  ─────────────────           │
│                  GRAND TOTAL: ₹xxx (gold)   │
│                                             │
│  TERMS & CONDITIONS                         │
│  (structured text from HTML notes)          │
│                                             │
│──────────────────────────────────────────── │
│        Studio Name · Address · Phone        │
│              Email · Website                │
│          (centered, small grey text)        │
└─────────────────────────────────────────────┘
```

## Implementation Details

**File:** `src/pages/QuotationView.tsx` — replace lines 163–294 (the `handleDownloadPDF` function body)

### Key changes inside the function:

1. **Logo** — Load the company logo image (`/assets/logo.png`) as base64, draw it top-left at ~25×25mm using `doc.addImage()`. Fall back gracefully if load fails.

2. **Header (right-aligned)** — "QUOTATION" in 24px bold #222, quotation number in 11px grey, date and valid-until below. Gold divider line (`#d4af37`, 0.5pt) spanning full width below header.

3. **Client + Event section** — Light grey background box (`#f7f7f7`). Two-column layout: left column = "Bill To" with name/email/phone; right column = "Event Details" with event type and formatted dates.

4. **Items table** — Gold header background (`#d4af37`) with white bold text. 6 columns: #, Item, Description, Qty, Price, Total. Rows on white background with `#eee` bottom border. Page break check before each row.

5. **Totals section** — Right-aligned summary: Subtotal, Discount (if >0), Tax (if >0), then a thin separator line, then Grand Total in 22px bold gold (`#d4af37`).

6. **Terms & Conditions** — Section title "TERMS & CONDITIONS" in 11px bold. Uses existing `htmlToStructuredText()` to render notes as structured plain text with bullet preservation. Proper page break handling for long content.

7. **Footer** — Centered at bottom: studio name, address, phone, email, website in 8px grey text.

### Styling constants:
- Margins: 20mm (≈40px at 2x)
- Colors: text `#222222`, accent `#d4af37`, muted `#888888`, bg-box `#f7f7f7`
- Font: NotoSans (already registered via `registerPDFFont`) with Helvetica fallback
- Page size: A4 (default jsPDF)

### No changes to:
- `htmlToStructuredText()`, `sanitizeHtml()`, `formatCurrency()`, `formatDate()`, `getEventDates()`
- `fetchQuotation()`, `handleResponse()`
- Any JSX/HTML rendering
- Any other file

