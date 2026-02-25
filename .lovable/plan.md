

# Quotation Layout Update + Multi-Date Support

## Overview

Enhance the quotation system with multi-date support, rich text notes editing, and reordered form layout. Changes span the database, 3 edge functions, 2 frontend pages, and the form dialog.

## Database Migration

Add `event_dates` column to `quotations` table:

```sql
ALTER TABLE quotations ADD COLUMN event_dates text[] DEFAULT '{}';
```

Migrate existing single `event_date` values into the new array column so no data is lost. Keep `event_date` column for backward compatibility but stop using it in new code.

## File Changes

### 1. `src/components/admin/QuotationFormDialog.tsx`

**Multi-date support:**
- Replace `event_date: string` in form state with `event_dates: string[]`
- Add "Add Date" button that appends a new date input
- Each date has a remove button (X icon)
- At least 1 date not enforced (optional field)

**Rich text notes:**
- Replace plain `<Textarea>` with a simple toolbar-enhanced textarea approach using markdown-style formatting
- Since adding TipTap/Quill would require new dependencies, use a lightweight approach: keep `<Textarea>` but add formatting toolbar buttons (bold `**text**`, bullet `• `, numbered `1. `) that insert markdown markers. Store as HTML by converting on save using a simple markdown-to-HTML converter built inline (no dependency needed)
- Alternatively, store raw text and render with `white-space: pre-wrap` plus basic pattern replacement for bullets/bold on display

**Recommended approach:** Use a simple rich textarea that stores HTML directly. Add toolbar buttons that use `document.execCommand` on a `contentEditable` div styled to match the existing textarea. This gives bullet points, bold, and line breaks without any new dependency.

**Form section reorder:**
```
Fill from Booking (if creating)
Client Info (name, email, phone)
Event Type
Event Dates (multi-date picker)
Notes / Terms & Conditions (rich text)
Items
Pricing Summary
Valid Until
Actions
```

**Save logic update:**
- Send `event_dates` array instead of `event_date`
- Convert notes from contentEditable HTML to stored HTML string
- When loading existing quotation, populate `event_dates` from the array column (fallback to `[event_date]` for old records)

### 2. `src/pages/QuotationView.tsx`

- Update `QuotationData` interface: add `event_dates: string[] | null`
- Event details section: render multiple dates, each on its own line or comma-separated
- Notes section: render HTML using `dangerouslySetInnerHTML` with basic sanitization (strip script tags, event handlers)
- PDF generation: render dates as multi-line, render notes as plain text extracted from HTML

### 3. `supabase/functions/send-quotation/index.ts`

- Read `event_dates` array from quotation
- Display dates in the event details block as comma-separated formatted dates
- Render notes HTML directly in the email (already in an HTML context, so this works naturally)
- Sanitize notes HTML server-side (strip `<script>`, `onclick`, etc.) before embedding

### 4. `supabase/functions/get-quotation/index.ts`

- No structural change needed -- `select("*")` already returns all columns including new `event_dates`
- Backward compat: if `event_dates` is empty/null but `event_date` exists, return `event_dates: [event_date]`

### 5. `src/pages/admin/Quotations.tsx`

- Update `Quotation` interface to include `event_dates`
- Event Date column: show first date or "Multiple dates" badge if > 1

## Rich Text Implementation Detail

Use a `contentEditable` div with a minimal toolbar (no new dependencies):

```text
[B] [• List] [1. Numbered] [—]
┌─────────────────────────────────────┐
│ • 50% advance required              │
│ • Balance before delivery            │
│ • Cancellation not refundable        │
└─────────────────────────────────────┘
```

Toolbar buttons:
- **Bold**: wraps selection in `<strong>`
- **Bullet list**: inserts `<ul><li>` 
- **Ordered list**: inserts `<ol><li>`

The `contentEditable` div's innerHTML is captured on blur/change and stored in `form.notes`. On load, existing HTML is set as innerHTML. Plain text from old records renders fine as-is.

Sanitization function (no dependency): strip `<script>`, `<iframe>`, `on*` attributes using regex before rendering.

## Backward Compatibility

- Old quotations with `event_date` but no `event_dates`: handled by fallback logic in both frontend and edge functions
- Old plain text notes: render correctly in contentEditable and in all display contexts
- No breaking changes to existing data

## Files Summary

| File | Action |
|------|--------|
| Database migration | Add `event_dates text[]` column, migrate existing data |
| `src/components/admin/QuotationFormDialog.tsx` | Reorder sections, multi-date UI, rich text editor |
| `src/pages/QuotationView.tsx` | Multi-date display, HTML notes rendering |
| `src/pages/admin/Quotations.tsx` | Update interface and date column display |
| `supabase/functions/send-quotation/index.ts` | Multi-date + HTML notes in email |
| `supabase/functions/get-quotation/index.ts` | Backward compat for event_dates |

