

# Update Favicon with New .ico File

## Changes

**1. Copy uploaded file → `public/favicon.ico`**
Replace the existing favicon.ico with the newly uploaded `user-uploads://ajantaico-2.ico`.

**2. Update `index.html`** — Add `<link rel="shortcut icon">` tag alongside the existing icon tags, and remove the PNG favicon references:

Current (lines 5-7):
```html
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
<link rel="apple-touch-icon" href="/favicon.png" />
```

After:
```html
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="shortcut icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/favicon.ico" />
```

This removes the PNG favicon references and consolidates on the .ico file.

**Not applicable:** This is a Vite/React project, not Next.js — no `layout.tsx` metadata changes needed.

**No other files touched.** No styling, layout, or functionality changes.

