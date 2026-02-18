

# Works / Portfolio Performance and Upload Optimization

## Current State Analysis

After reviewing the codebase, here is what exists today:

**Uploads (Works):**
- Already uses presigned URLs for direct-to-R2 upload (no edge proxy for file data)
- Limited to 100MB max file size
- No multipart upload support for works (only album media has it)
- Uploads both original AND preview as the same full-size file
- Single file upload only (no batch)

**Gallery/Landing Page:**
- Loads ALL works at once (no pagination)
- Fetches signed URLs sequentially one-by-one (waterfall)
- No lazy loading -- all images load immediately
- No thumbnail generation -- preview key stores the same full-resolution file
- No CDN cache headers

**Album Upload Engine (existing):**
- Already has multipart, retry, concurrency, speed indicators
- Works well for album media but is not used for portfolio/works uploads

---

## Changes Overview

### Phase 1: Upload Optimization

| File | Change |
|------|--------|
| `src/components/admin/UploadWorkDialog.tsx` | Increase max file size to 5GB, add multipart support for large files, add file size validation with warnings, add real upload progress via XHR, support batch uploads |
| `supabase/functions/manage-work/index.ts` | Add multipart initiate/part-url/complete/abort actions for works, fix presigned URL signing to only sign host header (matching R2 constraint) |

**Details:**
- Max file size raised from 100MB to 5GB
- Files under 50MB: single PUT with XHR progress tracking
- Files 50MB-5GB: multipart upload (10MB chunks, 5 concurrent parts, 3 retries per chunk)
- Show upload speed (MB/s) and estimated time remaining
- Warning toast for files over 1GB, error for files over 5GB
- Fix presigned URL signing: only sign `host` header (per R2 constraint memory), removing `Content-Type` from signature headers
- Stop uploading the same full file to both original and preview paths (wasteful)

### Phase 2: Gallery and Landing Page Performance

| File | Change |
|------|--------|
| `src/pages/Gallery.tsx` | Add pagination (12 items per page) with infinite scroll using IntersectionObserver, lazy load images with `loading="lazy"`, batch fetch signed URLs (parallel with Promise.all), load full-res only in lightbox |
| `src/components/home/GalleryPreview.tsx` | Add `loading="lazy"` to images, batch fetch signed URLs in parallel |
| `src/pages/admin/Works.tsx` | Add pagination (20 items per page) with "Load More" button, batch fetch signed URLs in parallel instead of sequential loop |

**Details:**
- Gallery page loads 12 works initially, loads 12 more on scroll (IntersectionObserver)
- Uses `limit` and `offset` in Supabase queries
- All signed URL fetches happen in parallel via `Promise.all` instead of sequential `for` loop
- Images use `loading="lazy"` attribute for native browser lazy loading
- Lightbox fetches full-resolution signed URL (original s3_key) only when clicked; gallery grid uses preview key

### Phase 3: Signed URL Caching

| File | Change |
|------|--------|
| `supabase/functions/s3-signed-url/index.ts` | Add `Cache-Control: public, max-age=3500` header to signed URL responses (URLs expire in 1hr, cache for ~58min) |
| `supabase/functions/manage-work/index.ts` | Add same cache headers to signed-url action response |

**Details:**
- Signed URL edge function responses include `Cache-Control` headers so browsers and CDN cache them
- This avoids re-fetching the same signed URL on every page visit within the cache window
- R2 signed URLs typically have a 1-hour expiry, so we cache for slightly less (3500s)

---

## What Will NOT Change

- Existing album upload system (UploadEngine/UploadManager) stays untouched
- Existing works data in database remains intact
- R2 bucket configuration unchanged
- Storage structure (`works/` and `works/previews/` prefixes) preserved
- All existing edge functions continue working

## Expected Results

- Works upload supports files up to 5GB with chunk progress
- Gallery page loads in under 1 second (12 items vs all items)
- Home page gallery preview loads 6 items with parallel URL fetching
- Admin works page paginates with parallel URL fetching
- Signed URLs cached by browser, reducing repeated edge function calls
- Real upload progress bar with speed and ETA for large files

