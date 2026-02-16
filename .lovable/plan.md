

# Fix: Admin Album Images Loading Too Slowly

## Root Cause

In `src/pages/admin/AlbumDetail.tsx`, the `fetchMedia` function fetches signed URLs **one at a time** in a `for` loop (lines 193-204):

```typescript
for (const item of newMedia) {
  const { data: urlData } = await supabase.functions.invoke('s3-signed-url', { ... });
  // Each call waits for the previous to finish
}
```

With 53 items, this means 53 sequential network requests (~200-500ms each), totaling 10-25 seconds of wait time.

## Fix

### File: `src/pages/admin/AlbumDetail.tsx`

Replace the sequential loop with **parallel batch fetching**:

```typescript
// Fetch signed URLs in parallel batches of 10
const BATCH_SIZE = 10;
const urls: Record<string, string> = {};

for (let i = 0; i < newMedia.length; i += BATCH_SIZE) {
  const batch = newMedia.slice(i, i + BATCH_SIZE);
  const results = await Promise.all(
    batch.map(async (item) => {
      try {
        const { data: urlData } = await supabase.functions.invoke('s3-signed-url', {
          body: { s3Key: item.s3_key },
        });
        return { id: item.id, url: urlData?.url };
      } catch {
        return { id: item.id, url: null };
      }
    })
  );
  results.forEach(r => { if (r.url) urls[r.id] = r.url; });
  // Update UI progressively after each batch
  setMediaUrls(prev => ({ ...prev, ...urls }));
}
```

This changes load time from ~53 sequential calls to ~6 batches of 10 parallel calls. Images will also appear progressively as each batch completes.

## What Changes
- `src/pages/admin/AlbumDetail.tsx` -- parallel URL fetching with progressive rendering

## What Stays the Same
- Edge function `s3-signed-url` (no backend changes)
- Media query logic
- Everything else on the page

## Expected Result
- Images load ~5-8x faster
- Images appear progressively (first 10, then next 10, etc.)
- No more blank placeholder grid while waiting

