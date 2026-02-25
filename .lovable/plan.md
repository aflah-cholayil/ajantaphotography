

# Fix Terms Rendering + Multiple Dates Display

## Analysis

After reviewing the code thoroughly, all three issues were already addressed in previous edits. The `QuotationView.tsx` file correctly uses `dangerouslySetInnerHTML` with `sanitizeHtml`, renders multiple dates via `getEventDates`, and positions notes before items. The email template and PDF also have the correct logic.

However, there are two potential remaining issues that could cause the user to still see problems:

### Issue A: Tailwind Preflight Hides Bullets
Tailwind's CSS reset (`preflight`) sets `list-style: none` on all `ul`/`ol` elements. While the current code uses `[&_ul]:list-disc`, the `list-style-type` may not render visible bullets without proper `padding-left` on the `ul` element itself (Tailwind's `ml-4` adds margin but some browsers need `pl-` for bullet visibility). Additionally, `li` elements need `list-style` inherited.

### Issue B: Notes HTML `<ul>` may lack inline styles for email
The email template renders `quotation.notes` HTML directly, but `<ul>` tags in notes don't have inline `list-style-type` or `padding-left` styles — many email clients strip or ignore CSS classes. The notes HTML from the contentEditable editor produces bare `<ul><li>` tags without inline styles.

## Changes Required

### File: `src/pages/QuotationView.tsx`

**Line 362** — Strengthen CSS for HTML notes rendering to ensure bullets are visible despite Tailwind's preflight reset:

```
Current:
className="text-sm text-foreground [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:my-0.5 [&_strong]:font-bold"

Replace with:
className="text-sm text-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:ml-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:ml-0 [&_li]:my-0.5 [&_li]:list-item [&_strong]:font-bold"
```

The key change: `pl-5` (padding-left) instead of `ml-4` (margin-left) — bullets render inside the padding, not the margin. Adding `[&_li]:list-item` forces `display: list-item` which is required for bullet markers.

### File: `supabase/functions/send-quotation/index.ts`

**In the `notesBlock` section (around line 122)** — Add inline styles to the notes HTML before embedding in email, since email clients don't support CSS classes:

Wrap the `sanitizeHtml(quotation.notes)` output with a style injection that adds inline styles to `<ul>`, `<ol>`, and `<li>` tags:

```typescript
// Before embedding notes in email, add inline styles for email client compatibility
const styledNotes = sanitizeHtml(quotation.notes)
  .replace(/<ul>/gi, '<ul style="list-style-type: disc; padding-left: 20px; margin: 8px 0;">')
  .replace(/<ol>/gi, '<ol style="list-style-type: decimal; padding-left: 20px; margin: 8px 0;">')
  .replace(/<li>/gi, '<li style="margin: 4px 0; color: #a09080;">');
```

Use `styledNotes` in the notesBlock instead of `sanitizeHtml(quotation.notes)`.

## Summary

| File | Change |
|------|--------|
| `src/pages/QuotationView.tsx` | Fix CSS classes for bullet visibility (pl-5, list-item) |
| `supabase/functions/send-quotation/index.ts` | Add inline styles to notes HTML for email client compatibility |

No database or other file changes needed. These are targeted CSS/styling fixes to ensure the already-correct HTML actually renders bullets visually.

