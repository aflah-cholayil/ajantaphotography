

# Fix PDF Footer Overlap and Ordered List Numbering

## File: `src/pages/QuotationView.tsx`

Two targeted fixes, nothing else changes.

---

### Fix 1: Footer overlapping content

**Root cause:** `checkPage` (line 183-188) reserves only 25mm at the bottom (`pageH - 25`), but the footer draws starting at `pageH - 16` (fy - 4 where fy = pageH - 12). Content can render into the footer zone.

**Fix:** Increase the bottom margin in `checkPage` from 25 to 35, so content never enters the footer area.

```text
Line 184: change  pageH - 25  →  pageH - 35
```

This single change ensures all content (items table, terms, totals) respects the footer space. The footer itself stays at its fixed position — no structural change needed since jsPDF uses absolute coordinates (not CSS positioning).

---

### Fix 2: Ordered list numbers always show "1"

**Root cause:** TipTap's HTML output wraps each list item in its own `<ol>` tag (e.g., `<ol><li>STILL</li></ol><ol><li>VIDEO</li></ol>`). At line 406, `listCounter` resets to 0 on every `<ol>` entry, so every item becomes "1."

**Fix:** Only reset `listCounter` when the previous sibling is NOT an `<ol>`. This way consecutive `<ol>` blocks share a single counter.

```text
Lines 405-409: Change from unconditional reset to:

case 'ol': {
  // Only reset counter if previous sibling wasn't also an <ol>
  const prevSib = el.previousElementSibling;
  if (!prevSib || prevSib.tagName.toLowerCase() !== 'ol') {
    listCounter = 0;
  }
  y += 1;
  el.childNodes.forEach(c => walkNode(c, isBold, 'ol'));
  y += 1;
  break;
}
```

---

### Summary of changes

| Line | What | Change |
|------|------|--------|
| 184 | `checkPage` threshold | `pageH - 25` → `pageH - 35` |
| 405-409 | `case 'ol'` | Conditional counter reset based on previous sibling |

No other files or logic modified.

