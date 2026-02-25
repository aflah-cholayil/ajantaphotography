

# Fix Terms & Conditions in PDF

## Scope
Only modifying the `handleDownloadPDF` function in `src/pages/QuotationView.tsx`. No other changes.

## Two Changes

### 1. Move Terms & Conditions section
Currently at lines 382–405 (section 5, after Totals). Will be relocated to immediately after the Client + Event section (after line 279), before the Items Table.

New order:
```text
Header → Client/Event → Terms & Conditions → Items Table → Totals → Footer
```

### 2. Replace plain-text rendering with HTML-aware renderer
Currently the notes are converted via `htmlToStructuredText()` which strips all formatting into flat text with manual `•` bullets. This loses headings, bold, alignment, and proper list styling.

**New approach**: Write an inline HTML walker that reads the DOM nodes and calls jsPDF methods accordingly:
- `<h1>` → `setFontSize(18)`, bold, check `text-align: center` → use `align: 'center'`
- `<h2>` → `setFontSize(15)`, bold, same alignment logic
- `<h3>` → `setFontSize(13)`, bold
- `<p>` → `setFontSize(9)`, normal weight, respect `text-align` from style attribute
- `<strong>/<b>` → bold style
- `<ul>/<ol> + <li>` → indented with proper bullet `•` or number, no random symbols
- `<br>` → line break
- Page break check before each block element

This keeps using jsPDF's native text drawing (not `doc.html()`) so it works reliably, but parses the HTML structure to preserve formatting.

**Key details of the renderer:**
- Parses `style="text-align: center"` from TipTap output to determine alignment
- Uses `doc.setFont(undefined, 'bold')` / `'normal'` for weight
- Proper spacing: headings get 8mm top margin, paragraphs get 5mm, list items get 4mm
- `splitTextToSize` used for long text to handle wrapping
- Color stays `#222` on white — no dark theme

### Files modified
- `src/pages/QuotationView.tsx` — lines 279–405 (reorder sections + replace notes renderer)

### Technical approach (code-level)
```text
After line 279 (end of Client+Event):
  → Insert Terms & Conditions block with new HTML-aware renderer

Lines 282-338 (Items Table):
  → Stays the same, just shifts down in order

Lines 382-405 (old Terms section):
  → Removed (moved up)
```

The new renderer function `renderHtmlToPdf(doc, html, ...)` will:
1. Create a temporary DOM div, set innerHTML
2. Walk child nodes recursively
3. For each element, set font size/weight/alignment based on tag
4. Draw text with proper coordinates and page break handling
5. Handle nested bold within paragraphs/headings

