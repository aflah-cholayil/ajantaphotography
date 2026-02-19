

# Fix Broken Works/Portfolio Images

## Root Cause

The upload flow generates two paths -- `s3_key` (e.g., `works/1771427030221_DSC05471_1.jpg`) and `s3_preview_key` (e.g., `works/previews/1771427030221_DSC05471_1.jpg`) -- but **only uploads the file to `s3_key`**. The preview path is a phantom entry in the database with no actual file in R2.

When the gallery components try to load images using `s3_preview_key` first, R2 returns an XML error response (object not found), and Chrome blocks it with `net::ERR_BLOCKED_BY_ORB`. This causes images to appear broken.

## Fix Plan

### 1. Fix Upload: Stop Creating Phantom Preview Keys

**File: `supabase/functions/manage-work/index.ts`**

In the `upload-url` action, set `previewKey` equal to `s3Key` (instead of a separate `works/previews/` path). Same for `multipart-initiate`. Since we are not generating actual thumbnails, the preview should point to the same file as the original.

### 2. Fix Existing Data: Update DB Records

Run a migration to set `s3_preview_key = s3_key` for all existing works where the preview key points to a non-existent file path under `works/previews/`.

```sql
UPDATE works
SET s3_preview_key = s3_key
WHERE s3_preview_key LIKE 'works/previews/%';
```

### 3. Add Fallback Image Handling

**File: `src/pages/admin/Works.tsx`**

Add `onError` handler to `<img>` tags so broken images show a placeholder icon instead of a broken image:

```tsx
<img
  src={imageUrls[work.id]}
  alt={work.title}
  onError={(e) => {
    e.currentTarget.style.display = 'none';
  }}
/>
```

**File: `src/components/home/GalleryPreview.tsx`**

Add `onError` fallback to use the static fallback images when R2 images fail.

**File: `src/pages/Gallery.tsx`**

Add `onError` handler to hide broken images gracefully.

### 4. Use `s3_key` as Primary Fetch Key

**File: `src/components/home/GalleryPreview.tsx`**
**File: `src/pages/Gallery.tsx`**
**File: `src/pages/admin/Works.tsx`**

Change signed URL fetch to prefer `s3_key` over `s3_preview_key` as a safety measure, since the original file always exists:

```tsx
// Before (broken):
work.s3_preview_key || work.s3_key

// After (safe):
work.s3_key
```

Once actual thumbnail generation is implemented in the future, this can switch back to preferring thumbnails.

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/manage-work/index.ts` | Set `previewKey = s3Key` in upload-url and multipart-initiate actions |
| `src/pages/admin/Works.tsx` | Use `s3_key` for signed URL fetch, add `onError` fallback |
| `src/components/home/GalleryPreview.tsx` | Use `s3_key` for signed URL fetch, add `onError` fallback |
| `src/pages/Gallery.tsx` | Use `s3_key` for signed URL fetch, add `onError` fallback |
| Database migration | Update existing `s3_preview_key` to match `s3_key` |

## What This Does NOT Change

- Existing R2 files remain untouched
- Upload flow continues to work
- Album media system unchanged
- No R2 configuration changes needed

