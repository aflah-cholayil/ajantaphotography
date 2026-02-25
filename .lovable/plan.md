

# Fix Favicon Not Showing in Google Search Results

## Why This Is Happening

Your `index.html` has **no `<link rel="icon">` tag**. There's a `public/favicon.ico` file in the project, but without an explicit link tag in the HTML, browsers fall back to the default `/favicon.ico` path. However, Google's crawler and some browsers may pick up the Lovable platform's default favicon instead because:

1. No explicit favicon declaration in `<head>`
2. The existing `public/favicon.ico` might still be the default Lovable icon file — not your custom Ajanta Photography icon

## Fix

**File: `index.html`** — Add explicit favicon link tags in the `<head>` section, right after the `<meta charset>` line:

```html
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
<link rel="apple-touch-icon" href="/favicon.png" />
```

**Additionally**, we need your custom Ajanta Photography icon as the actual favicon file. The current `public/favicon.ico` is likely the default Lovable icon.

**Action needed from you**: Please upload your Ajanta Photography icon (the one you set in Website Info) so I can replace `public/favicon.ico` and add a `public/favicon.png` version. Without replacing the actual file, the link tags alone won't help — Google will still serve the old Lovable icon.

**Note**: Even after fixing, Google takes days/weeks to re-crawl and update the favicon in search results. You can request re-indexing via Google Search Console to speed this up.

