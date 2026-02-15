

# Fix Gallery 1000-Item Limit with Infinite Scroll

## Problem

Supabase JS client has a default row limit of 1000. Three places fetch media without pagination, silently capping results:
- Client AlbumView (`src/pages/client/AlbumView.tsx` line 118)
- Admin AlbumDetail (`src/pages/admin/AlbumDetail.tsx` line 154)
- Shared Gallery edge function (`supabase/functions/get-share-gallery/index.ts` line 147)

## Solution

Add cursor-based infinite scroll to the client and admin album views, paginated loading in the shared gallery edge function, and accurate total counts everywhere.

## Changes

### 1. Client AlbumView -- Infinite Scroll (`src/pages/client/AlbumView.tsx`)

- Replace single `fetchMedia` call with paginated fetching using `.range(offset, offset + PAGE_SIZE - 1)` where `PAGE_SIZE = 200`
- Add a separate count query: `supabase.from('media').select('id', { count: 'exact', head: true }).eq('album_id', id)` to get the true total
- Store `totalCount`, `hasMore`, and `page` state
- Display accurate count in tab headers: `Photos (3248)` instead of `photos.length`
- Add `IntersectionObserver` sentinel div at the bottom of `OptimizedMediaGrid` to trigger loading next page
- Append new results to existing `media` array (not replace)
- Show a small spinner at the bottom while loading more

### 2. OptimizedMediaGrid -- Sentinel Support (`src/components/client/OptimizedMediaGrid.tsx`)

- Accept new optional props: `hasMore`, `isLoadingMore`, `onLoadMore`
- Render a sentinel `div` at the end of the grid observed by `IntersectionObserver`
- When sentinel becomes visible and `hasMore` is true, call `onLoadMore`
- Show `Loader2` spinner when `isLoadingMore` is true

### 3. Admin AlbumDetail -- Paginated Fetch (`src/pages/admin/AlbumDetail.tsx`)

- Same pagination pattern as client: `PAGE_SIZE = 200`, `.range()` queries
- Add total count query for accurate stats cards
- Add "Load More" button at the bottom of the media grid (admin prefers explicit control over infinite scroll)
- Update the stats card that shows photo/video counts to use `totalCount` not `media.length`
- Large album warning banner when `totalCount > 3000`: "Large album (X items). Performance may vary."

### 4. Shared Gallery Edge Function (`supabase/functions/get-share-gallery/index.ts`)

- For the `load` action, accept optional `page` and `pageSize` params (default `pageSize = 200`, `page = 0`)
- Query with `.range(page * pageSize, (page + 1) * pageSize - 1)`
- Add a count query: `.select('id', { count: 'exact', head: true })`
- Return `{ items, totalCount, page, hasMore }` alongside album/shareLink data
- Shared gallery frontend (`src/pages/share/SharedGallery.tsx`) updated to paginate and append media

### 5. SharedGallery Frontend (`src/pages/share/SharedGallery.tsx`)

- Add pagination state (`page`, `hasMore`, `totalCount`, `isLoadingMore`)
- Initial `loadGallery` fetches page 0
- Add `IntersectionObserver` sentinel at the bottom of the photo/video grids
- When sentinel visible, call `loadGallery` with next page number and append results
- Update tab counts to show `totalCount`

### 6. Large Album Warning

- In both admin and client views, when `totalCount > 3000`, show a subtle warning banner:
  "Large album detected (X items). Performance may be reduced for very large albums."
- Non-blocking, dismissible

## What stays unchanged

- `UploadEngine` and upload logic (no changes)
- R2/S3 signed URL logic
- RLS policies
- Sort order behavior
- Download ZIP logic (operates on loaded media -- downloads what's loaded)
- Public Gallery page (`src/pages/Gallery.tsx`) -- works table is small, not affected

## Technical Notes

```text
PAGE_SIZE = 200
Supabase .range(from, to) is inclusive on both ends
Count query uses { count: 'exact', head: true } to avoid fetching rows
IntersectionObserver rootMargin = '200px' to prefetch before user reaches bottom
```

