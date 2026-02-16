

# Fix: Storage Per Client Not Updating for New Users

## Root Cause

The `storage-stats` edge function queries the `media` table without specifying a row limit:

```typescript
const { data: mediaData } = await adminClient.from("media").select("album_id, size, created_at");
```

Supabase has a **default limit of 1000 rows** per query. Your database now has **1,506 media records**. Since AJITH's 144 media items were uploaded after Neymar's 1,362 items, they fall beyond the 1000-row cutoff and are never included in the per-client storage calculation.

This is why AJITH shows **0.0 MB** despite actually having ~1.13 GB of media.

## Fix

### File: `supabase/functions/storage-stats/index.ts`

**Paginate the media query** to fetch ALL rows, not just the first 1000. Replace the single query with a loop:

```typescript
// Instead of:
const { data: mediaData } = await adminClient.from("media").select("album_id, size, created_at");

// Use paginated fetching:
let allMedia = [];
let from = 0;
const PAGE_SIZE = 1000;
let hasMore = true;

while (hasMore) {
  const { data } = await adminClient
    .from("media")
    .select("album_id, size, created_at")
    .range(from, from + PAGE_SIZE - 1);
  
  if (data && data.length > 0) {
    allMedia = allMedia.concat(data);
    hasMore = data.length === PAGE_SIZE;
    from += PAGE_SIZE;
  } else {
    hasMore = false;
  }
}
```

Apply the same pagination fix to these queries in the same function that could also exceed 1000 rows:
- `albumsData` query (currently small but should be future-proofed)
- `clientsData` query
- `profilesData` query
- `shareLinksData` query

## What Changes
- `supabase/functions/storage-stats/index.ts` -- paginate all database queries

## What Stays the Same
- R2 bucket listing (already handles pagination via XML continuation tokens)
- Cache logic
- Cost calculation formulas
- Frontend Storage Dashboard page

## Expected Result After Fix
- AJITH will correctly show ~1.13 GB storage across 2 albums
- All future clients will appear with accurate storage numbers regardless of total media count
