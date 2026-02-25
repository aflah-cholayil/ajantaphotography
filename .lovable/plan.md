

# Upgrade Notes Editor to Full Rich Text (TipTap)

## Current State

The notes editor in `QuotationFormDialog.tsx` uses a basic `contentEditable` div with only 3 toolbar buttons (Bold, Bullet List, Numbered List). No headings, no italic, no underline, no alignment, no images, no horizontal rule.

Rendering already works via `dangerouslySetInnerHTML` on the public page and inline-styled HTML in email. PDF uses `htmlToStructuredText()` for plain-text conversion.

## Plan

### 1. Install TipTap

Add packages: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`, `@tiptap/extension-image`, `@tiptap/extension-horizontal-rule`, `@tiptap/pm`.

### 2. Create `RichTextEditor` component

**New file: `src/components/ui/RichTextEditor.tsx`**

A reusable component wrapping TipTap with a toolbar containing:
- Headings (H1, H2, H3) via dropdown or buttons
- Bold, Italic, Underline
- Bullet list, Numbered list
- Text alignment (left, center, right)
- Insert image (URL prompt)
- Horizontal rule
- Clear formatting

Props: `content: string`, `onChange: (html: string) => void`

The editor outputs clean HTML. Styled with Tailwind classes for the toolbar and editor area matching the current dark theme.

### 3. Update `QuotationFormDialog.tsx`

- Remove the `contentEditable` div, `notesRef`, `execCommand`, `handleNotesInput` logic
- Import and use the new `RichTextEditor` component
- Pass `form.notes` as content and update form state via `onChange`
- No changes to save logic — it already stores HTML

### 4. Add CSS for notes rendering

**Update `src/index.css`** — Add `.quotation-notes` styles for the public page:

```css
.quotation-notes { line-height: 1.8; }
.quotation-notes h1 { font-size: 1.625rem; margin-top: 1.25rem; font-weight: 700; }
.quotation-notes h2 { font-size: 1.375rem; margin-top: 1.125rem; font-weight: 700; }
.quotation-notes h3 { font-size: 1.125rem; margin-top: 0.9375rem; font-weight: 600; }
.quotation-notes ul { list-style-type: disc; padding-left: 1.25rem; }
.quotation-notes ol { list-style-type: decimal; padding-left: 1.25rem; }
.quotation-notes img { max-width: 100%; height: auto; margin: 0.625rem 0; border-radius: 0.375rem; }
.quotation-notes p { margin-bottom: 0.625rem; }
.quotation-notes hr { border-top: 1px solid currentColor; opacity: 0.2; margin: 1rem 0; }
```

### 5. Update public quotation page (`QuotationView.tsx`)

Change the notes `div` class to include `quotation-notes`:
```jsx
<div className="quotation-notes text-sm text-foreground"
  dangerouslySetInnerHTML={{ __html: sanitizeHtml(quotation.notes) }} />
```

No other changes — `dangerouslySetInnerHTML` with the existing `sanitizeHtml` already preserves formatting safely.

### 6. Update email template (`send-quotation/index.ts`)

Expand the `styledNotes` replacements to cover the new tags the TipTap editor produces:

```typescript
const styledNotes = quotation.notes ? sanitizeHtml(quotation.notes)
  .replace(/<h1>/gi, '<h1 style="font-size:22px; color:#222; margin:16px 0 8px; font-weight:700;">')
  .replace(/<h2>/gi, '<h2 style="font-size:18px; color:#222; margin:14px 0 6px; font-weight:700;">')
  .replace(/<h3>/gi, '<h3 style="font-size:15px; color:#222; margin:12px 0 6px; font-weight:600;">')
  .replace(/<p>/gi, '<p style="margin:8px 0; color:#444; line-height:1.6;">')
  .replace(/<strong>/gi, '<strong style="color:#222; font-weight:600;">')
  .replace(/<em>/gi, '<em style="color:#444;">')
  .replace(/<u>/gi, '<u style="color:#444;">')
  .replace(/<ul>/gi, '<ul style="list-style-type:disc; padding-left:20px; margin:8px 0;">')
  .replace(/<ol>/gi, '<ol style="list-style-type:decimal; padding-left:20px; margin:8px 0;">')
  .replace(/<li>/gi, '<li style="margin:4px 0; color:#444;">')
  .replace(/<img /gi, '<img style="max-width:100%; height:auto; border-radius:6px; margin:10px 0;" ')
  .replace(/<hr>/gi, '<hr style="border:none; border-top:1px solid #eee; margin:15px 0;">')
  : '';
```

### 7. PDF rendering — no changes needed

The existing `htmlToStructuredText()` function already walks the DOM tree and converts to plain text with bullet markers. TipTap output uses standard HTML tags, so it will continue to work. H1/H2/H3 text will appear as regular lines (acceptable for PDF plain text).

## What is NOT touched
- Quotation creation/save logic
- Supabase schema (notes is already `text`, stores HTML fine)
- Currency formatting
- Mobile responsiveness
- PDF download logic
- Email sending logic (only the inline style replacements)

## Files

| File | Action |
|------|--------|
| `src/components/ui/RichTextEditor.tsx` | Create — TipTap wrapper |
| `src/components/admin/QuotationFormDialog.tsx` | Update — replace contentEditable with RichTextEditor |
| `src/pages/QuotationView.tsx` | Update — add `quotation-notes` class |
| `src/index.css` | Update — add `.quotation-notes` styles |
| `supabase/functions/send-quotation/index.ts` | Update — expand inline style replacements for h1/h2/em/u/img/hr |

