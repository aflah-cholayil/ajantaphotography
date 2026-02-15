

# Multi-Select Download System -- UI Enhancement

## Current State

The codebase already has working multi-select and ZIP download:
- Selection mode toggle, checkboxes on items, "Select All" buttons
- `handleDownloadSelected` creates a ZIP via JSZip with blob downloads
- Single file download uses blob approach

## What Needs Improving

### 1. Sticky Bottom Action Bar (`src/pages/client/AlbumView.tsx`)

Currently, selection controls are only in the header and can be hard to see. Add a fixed bottom action bar that appears when in selection mode:

```text
+------------------------------------------------------+
|  [X] 5 selected    [Download Selected]  [Cancel]     |
+------------------------------------------------------+
```

- Fixed to viewport bottom with `fixed bottom-0 left-0 right-0 z-40`
- Shows selected count
- "Download Selected" button (disabled if 0 selected)
- "Cancel" to exit selection mode
- Animated slide-up/down with framer-motion

### 2. Single vs Multi Download Logic

Update `handleDownloadSelected`:
- If exactly 1 item selected: use direct blob download (no ZIP overhead)
- If 2+ items selected: create ZIP as currently implemented

### 3. ZIP Filename Improvement

Change ZIP filename from `{title}_gallery.zip` to include event context. Fetch client event name and use: `{EventName}_{AlbumTitle}.zip` format. If event name unavailable, fall back to `{AlbumTitle}_gallery.zip`.

### 4. "Download Entire Album" Option

When entering selection mode, show a "Select All" and "Download Entire Album" option. "Download Entire Album" should:
- First load ALL media (paginate through remaining pages if `hasMore` is true)
- Then ZIP all items

### 5. Move Header Selection Controls to Bottom Bar

Remove the selection-mode buttons from the header. Keep only the "Select" toggle button in the header. All active selection controls move to the bottom bar.

## Files to Modify

- `src/pages/client/AlbumView.tsx` -- Bottom action bar, improved download logic, fetch-all for entire album download

## What Stays Unchanged

- `OptimizedMediaGrid.tsx` -- Checkbox rendering already works
- Edge functions -- No backend changes needed
- JSZip logic -- Already correct, just needs filename tweak
- Admin album detail -- Separate concern

