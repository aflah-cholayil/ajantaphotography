

# Fix Notes Formatting in Email Template

## Analysis

The email template in `supabase/functions/send-quotation/index.ts` already:
- Renders notes as HTML (not plain text) via `${styledNotes}` inside the `html` property
- Sanitizes HTML (strips `<script>`, `<iframe>`, event handlers)
- Adds inline styles to `<ul>`, `<ol>`, `<li>` tags

**The remaining problem**: The inline style injection only covers list elements. Other common rich-text tags (`<p>`, `<strong>`, `<b>`, `<h3>`, `<h4>`, `<br>`) lack inline styles. Email clients strip inherited CSS, so:
- `<p>` tags collapse (no margin/padding, wrong color)
- `<strong>` inherits the muted `#a09080` color instead of standing out
- Headings have no styling at all
- Line spacing is lost

This explains why the admin sees "flat text, no spacing, all lines compressed" in email — the HTML tags are there but render without any visual differentiation.

## Changes

### File: `supabase/functions/send-quotation/index.ts` (lines 119-122)

Expand the inline style injection to cover all common rich-text elements:

```typescript
const styledNotes = quotation.notes ? sanitizeHtml(quotation.notes)
  .replace(/<ul>/gi, '<ul style="list-style-type: disc; padding-left: 20px; margin: 8px 0;">')
  .replace(/<ol>/gi, '<ol style="list-style-type: decimal; padding-left: 20px; margin: 8px 0;">')
  .replace(/<li>/gi, '<li style="margin: 4px 0; color: #a09080;">')
  .replace(/<p>/gi, '<p style="margin: 8px 0; color: #a09080; line-height: 1.6;">')
  .replace(/<strong>/gi, '<strong style="color: #f5f0e8; font-weight: 600;">')
  .replace(/<b>/gi, '<b style="color: #f5f0e8; font-weight: 600;">')
  .replace(/<h3>/gi, '<h3 style="color: #f5f0e8; font-size: 15px; margin: 12px 0 6px 0; font-weight: 600;">')
  .replace(/<h4>/gi, '<h4 style="color: #f5f0e8; font-size: 14px; margin: 10px 0 4px 0; font-weight: 600;">')
  : '';
```

This ensures:
- **Bold text** stands out in a brighter color (`#f5f0e8`) against the muted notes text
- **Paragraphs** have proper spacing and line-height
- **Headings** are visually distinct
- **Lists** keep their existing bullet/number styling

No other files need changes — the web view already handles this via Tailwind classes, and the PDF uses its own rendering.

| File | Change |
|------|--------|
| `supabase/functions/send-quotation/index.ts` | Add inline styles for `<p>`, `<strong>`, `<b>`, `<h3>`, `<h4>` in notes HTML |

