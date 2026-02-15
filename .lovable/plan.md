

# Fix Download Behavior -- Blob-Based Downloads

## Problem

Download buttons currently set an R2 signed URL as `link.href` with `link.download`. Since the URL is cross-origin, browsers ignore the `download` attribute and open the file in a new tab instead of downloading it.

## Solution

Use the blob fetch approach: fetch the signed URL as a blob, create an object URL, and trigger download from that. This works reliably cross-origin.

## Changes

### 1. `src/pages/client/AlbumView.tsx` -- `handleDownload`

Replace the current `<a>` link approach with:

```typescript
const response = await fetch(url);
const blob = await response.blob();
const blobUrl = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = blobUrl;
a.download = item.file_name;
document.body.appendChild(a);
a.click();
a.remove();
window.URL.revokeObjectURL(blobUrl);
```

Remove `link.target = '_blank'` -- no longer needed.

### 2. `src/pages/share/SharedGallery.tsx` -- `handleDownload`

Same blob-based download pattern as above, replacing the current direct-link approach.

### 3. `src/pages/admin/AlbumDetail.tsx` -- Admin download (if applicable)

Apply the same pattern to any single-file download in the admin view. The ZIP download logic already works correctly (it creates a blob via JSZip), so no changes needed there.

## What stays unchanged

- Signed URL generation in the edge function (no backend changes needed)
- ZIP download logic (already blob-based)
- Upload logic
- All other edge functions

## Technical Notes

- The blob approach works for both images and videos
- Content-Type is preserved automatically by the browser's fetch
- File name is controlled by `a.download` which works with blob URLs (same-origin)
- For very large video files, this will buffer the entire file in memory before saving -- acceptable for typical gallery use cases

