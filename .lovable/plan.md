

# Fix Email Notes Formatting — Preserve Alignment & Headings

## Root Cause

The `styledNotes` regex on line 124 uses `<p[^>]*>` which **strips all existing attributes** including TipTap's `style="text-align: center"`. Same problem on lines 120-123 for headings — `<h1[^>]*>` replaces the opening tag entirely, discarding any inline `style` attribute the editor set.

Additionally, the notes wrapper div (line 139) sets `font-size: 13px` which constrains heading sizes.

## Fix — Single File Only

**File: `supabase/functions/send-quotation/index.ts`**

### Change 1: Preserve existing `style` attributes instead of replacing tags

Instead of `replace(/<p[^>]*>/gi, '<p style="...">')` (which destroys alignment), the regex needs to:
- If the tag already has a `style` attribute, **append** to it
- If no `style` attribute, **add** one

Rewrite the `styledNotes` block (lines 119-134) to use a smarter replacement approach that merges styles rather than replacing tags. For each tag type:

```typescript
// For <p> tags - preserve text-align from TipTap
.replace(/<p style="([^"]*)"/gi, (match, existingStyle) => 
  `<p style="${existingStyle}; margin:8px 0; color:#444; line-height:1.6;"`)
.replace(/<p>/gi, '<p style="margin:8px 0; color:#444; line-height:1.6;">')

// Same pattern for h1, h2, h3 — preserve style="" if present
.replace(/<h1 style="([^"]*)"/gi, (match, s) => 
  `<h1 style="${s}; font-size:26px; color:#222; margin:20px 0 10px; font-weight:700;"`)
.replace(/<h1>/gi, '<h1 style="font-size:26px; color:#222; margin:20px 0 10px; font-weight:700;">')
// ... same for h2 (22px), h3 (18px)
```

### Change 2: Remove constraining font-size from notes wrapper

Line 139: Remove `font-size: 13px` from the wrapper div so headings can display at their actual sizes.

```typescript
// Before
<div style="color: #444; margin: 0; font-size: 13px; line-height: 1.6;">${styledNotes}</div>

// After
<div style="color: #444; margin: 0; line-height: 1.7;">${styledNotes}</div>
```

### Change 3: Increase heading sizes to match the user's expectations

- H1: `26px` (was `22px`)
- H2: `22px` (was `18px`)  
- H3: `18px` (was `15px`)

### Summary of what changes

| What | Before | After |
|------|--------|-------|
| `<p style="text-align:center">` | Replaced → alignment lost | Merged → alignment preserved |
| `<h1 style="text-align:center">` | Replaced → alignment lost | Merged → alignment preserved |
| Notes wrapper font-size | `13px` (constrains headings) | Removed |
| H1 size | 22px | 26px |
| H2 size | 18px | 22px |
| H3 size | 15px | 18px |

### What is NOT touched
- Admin editor
- Public quotation page
- PDF logic
- Database structure
- Quotation fetch logic
- Email sending method (already uses `html`)

