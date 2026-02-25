

# Fix Ordered List Numbering in PDF

## Root Cause (confirmed via database query)

The actual HTML stored by TipTap for this quotation is:

```html
<ol><li><p><strong>STILL:</strong></p></li></ol>
...
<ol start="2"><li><p><strong>VIDEO:</strong></p></li></ol>
```

TipTap uses the `start` attribute on `<ol>` to indicate continuation. The current code ignores this attribute — it uses a `previousElementSibling` heuristic that does not match how TipTap structures its output.

## Fix

**File:** `src/pages/QuotationView.tsx`, lines 405-414

Replace the `case 'ol'` block to read the `start` attribute:

```typescript
case 'ol': {
  const startAttr = (el as HTMLElement).getAttribute('start');
  if (startAttr) {
    listCounter = parseInt(startAttr, 10) - 1;
  } else {
    listCounter = 0;
  }
  y += 1;
  el.childNodes.forEach(c => walkNode(c, isBold, 'ol'));
  y += 1;
  break;
}
```

When `<ol start="2">` is encountered, `listCounter` is set to 1. The `<li>` handler then increments to 2, producing "2." — exactly matching what the admin typed.

When no `start` attribute exists (plain `<ol>`), counter resets to 0 as before, so item becomes "1."

## Summary

| Line | Change |
|------|--------|
| 405-414 | Read `start` attribute from `<ol>` instead of checking `previousElementSibling` |

Single change. No other files or logic modified.

