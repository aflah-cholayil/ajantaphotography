

# Redesign Quotation Email — Premium White Theme

## Scope

Only the email HTML template in `supabase/functions/send-quotation/index.ts`. No changes to PDF, quotation page, currency formatting, or mobile fetch logic.

## Changes

### File: `supabase/functions/send-quotation/index.ts`

**1. Update item rows (lines 96-104)** — Change colors from dark theme to light theme:
- Row border: `#eee` instead of `#333`
- Text colors: `#333` for primary, `#666` for secondary (instead of `#f5f0e8` / `#a09080`)

**2. Update event block (lines 112-116)** — Light background:
- Background: `#fafafa` instead of `#252118`
- Border-left: `#d4af37` (gold)
- Text: `#333` for labels, `#555` for values

**3. Update styled notes (lines 119-128)** — Light-theme colors:
- `<li>`, `<p>`: color `#444` instead of `#a09080`
- `<strong>`, `<b>`: color `#222` instead of `#f5f0e8`
- `<h3>`, `<h4>`: color `#222` instead of `#f5f0e8`

**4. Update notes block wrapper (lines 130-134)** — Light background:
- Background: `#fafafa` instead of `#252118`
- Label color: `#d4af37` instead of `#d4a853`

**5. Replace entire HTML template (lines 136-189)** — Full redesign:
- Outer wrapper: `background: #f5f5f5` (light gray page)
- Inner card: `background: #ffffff`, `border-radius: 10px`, subtle `box-shadow`
- Use table-based layout for email client compatibility
- Font: `Arial, Helvetica, sans-serif`
- Header: `color: #222` for title, `#d4af37` for quotation number
- Body text: `color: #555`
- Table header: gold accent `#d4af37` border-bottom, `color: #d4af37`
- Totals: `color: #555` for labels, `#222` for values, gold for grand total
- CTA button: `background: #d4af37`, `color: #ffffff`
- Footer: `color: #999`, `border-top: 1px solid #eee`
- Logo stays the same (works on both light/dark)

### Color Palette

| Element | Old (Dark) | New (White) |
|---------|-----------|-------------|
| Page background | `#1a1814` | `#f5f5f5` |
| Card background | `#1a1814` | `#ffffff` |
| Primary text | `#f5f0e8` | `#222` |
| Secondary text | `#a09080` | `#555` |
| Muted text | `#a09080` | `#999` |
| Gold accent | `#d4a853` | `#d4af37` |
| Borders | `#333` | `#eee` |
| Event/Notes bg | `#252118` | `#fafafa` |
| Discount | `#4ade80` | `#16a34a` |
| CTA button text | `#1a1814` | `#ffffff` |

### What stays the same
- All helper functions (formatCurrency, formatDate, sanitizeHtml, getEventDates, getStudioConfig)
- Data fetching logic
- Email sending logic (Resend)
- Status update and email log insertion
- Logo URL
- CORS headers

