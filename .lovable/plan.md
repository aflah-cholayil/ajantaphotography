

# Fix: Broken Images in Admin Album Gallery

## Problem

Some images show a broken image icon (the browser's default) in the admin album detail page. This happens when:
- A signed URL is successfully fetched but the actual image fails to load (e.g., file too large like the 10.4 MB DSC00078.JPG, network timeout, or corrupt file)
- The `<img>` tag has no `onError` handler, so the browser shows its default broken image icon

## Fix

### File: `src/pages/admin/AlbumDetail.tsx`

Add an `onError` handler to all `<img>` tags that display media. When an image fails to load:
1. Remove the broken URL from `mediaUrls` state so it falls back to the placeholder icon
2. Optionally retry once after a short delay

There are two `<img>` locations to fix:

**Location 1 (~line 812):** Main gallery grid images
```tsx
<img 
  src={mediaUrls[item.id]} 
  alt={item.file_name}
  className="w-full h-full object-cover"
  onError={() => {
    setMediaUrls(prev => {
      const updated = { ...prev };
      delete updated[item.id];
      return updated;
    });
  }}
/>
```

**Location 2 (~line 631):** Selection preview thumbnails -- same pattern

This ensures broken images gracefully show the placeholder icon instead of the browser's broken image indicator.

## What Changes
- `src/pages/admin/AlbumDetail.tsx` -- add `onError` handlers to `<img>` tags

## What Stays the Same
- Signed URL fetching logic (already parallel batched)
- Edge function
- Everything else
