
# Fix Album Item Count Capped at 1000

## Root Cause

The Albums list page (`src/pages/admin/Albums.tsx`) fetches album data using a Supabase relational sub-query:

```ts
.select(`
  id,
  title,
  ...
  media(id)   // <-- THIS is the problem
`)
```

This `media(id)` sub-query fetches the actual media rows to count them. Supabase hard-caps all queries at **1000 rows** by default, so albums with more than 1000 items will always show "1000 items" instead of the real number. This is purely a display/counting bug on the Albums list page — the actual media stored in the database is complete and intact.

## What Is Already Working Correctly

- `AlbumDetail.tsx` (the page you see when you open a single album) already uses the correct approach: it calls `{ count: 'exact', head: true }` to get the real count without fetching rows, and then uses `PAGE_SIZE = 200` with pagination for loading media itself.
- `client/AlbumView.tsx` also uses `{ count: 'exact', head: true }` correctly.

Only the **Albums list page** (`Albums.tsx`) has the broken counting pattern.

## Fix

### 1. Remove `media(id)` from the albums list query

Stop fetching media rows just for counting. Replace the sub-select with nothing — we will load counts separately.

### 2. Fetch accurate counts using a separate `COUNT` query

After fetching albums, run a single bulk query to get exact media counts per album:

```ts
const { data: countData } = await supabase
  .from('media')
  .select('album_id', { count: 'exact' })
  .in('album_id', albumIds)
  // grouped effectively via client-side reduce
```

Actually the cleanest approach is to use `{ count: 'exact', head: false }` and select only `album_id`, then group in JS — or better, use a single Supabase RPC call that returns counts per album. The simplest and cleanest solution that avoids N+1 queries:

```ts
// One query to get all counts: select album_id and group in JS
const { data: mediaCounts } = await supabase
  .from('media')
  .select('album_id')
  .in('album_id', albumIds);

// Build a map: { [albumId]: count }
const countMap = mediaCounts?.reduce((acc, row) => {
  acc[row.album_id] = (acc[row.album_id] || 0) + 1;
  return acc;
}, {} as Record<string, number>);
```

**Problem**: This still hits the 1000-row Supabase limit across all albums combined.

**Better approach** — use a database function (RPC) to return counts per album in one call:

```sql
CREATE OR REPLACE FUNCTION get_album_media_counts(album_ids uuid[])
RETURNS TABLE(album_id uuid, media_count bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT album_id, COUNT(*) as media_count
  FROM media
  WHERE album_id = ANY(album_ids)
  GROUP BY album_id;
$$;
```

Then call it from the frontend:
```ts
const { data: counts } = await supabase.rpc('get_album_media_counts', {
  album_ids: albumIds
});
```

This returns accurate counts for all albums in **one database call** without hitting any row limit.

### 3. Update the `Album` interface

Change `media: { id: string }[]` to just store the count:

```ts
interface Album {
  ...
  mediaCount: number; // replaces media: { id: string }[]
}
```

### 4. Update all references to `album.media.length`

- Line 361: `map[key].totalMedia += album.media.length` → `album.mediaCount`
- Line 577: `{album.media.length} item{...}` → `{album.mediaCount} item{...}`
- Line 540: `{group.totalMedia} Media` already works since totalMedia is computed

## Files Changed

| File | Change |
|------|--------|
| Database migration | Add `get_album_media_counts(uuid[])` function with RLS-safe `SECURITY DEFINER` |
| `src/pages/admin/Albums.tsx` | Remove `media(id)` sub-query, add RPC call for counts, update interface and all `.media.length` references |

## What This Does NOT Change

- The `AlbumDetail.tsx` page (already works correctly with pagination)
- The client album view (already works correctly)
- Actual media storage or upload logic
- Any data in the database

## Result

Albums with 1000+ items (like the "WEDDING" album shown in the screenshot) will now display the true count — whether that's 1,200, 2,500, or 3,000+ — accurately reflected in the admin albums list.
