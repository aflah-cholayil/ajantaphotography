

# Bulk Select and Delete System (Admin Album Gallery)

Add a professional bulk selection and deletion system to the Admin Album Detail page, with full S3 cleanup, progress tracking, and automatic stat updates.

---

## 1. Add a New `bulk_delete_media` Action to `storage-cleanup` Edge Function

**File: `supabase/functions/storage-cleanup/index.ts`**

Add a new action `bulk_delete_media` that accepts an array of `mediaIds` and processes them server-side in a single request:

- Fetch all media records for the given IDs
- Delete S3 objects (original + preview) for each
- Delete associated `detected_faces` and `media_favorites` rows
- Delete `media` records
- Log the bulk deletion in `deletion_logs` as a single audit entry with total count and size
- Clean up orphan `people` records (where `photo_count` drops to 0) by recounting faces per person and deleting empty ones
- Return `{ success, deletedCount, totalSize, peopleRemoved }`

This avoids making hundreds of individual API calls from the frontend.

---

## 2. Add Selection State and Logic to `AlbumDetail.tsx`

**File: `src/pages/admin/AlbumDetail.tsx`**

Add the following state and behavior:

- `selectionMode: boolean` -- toggled by a "Select" button in the gallery header
- `selectedIds: Set<string>` -- tracks selected media IDs
- `lastClickedIndex: number | null` -- for Shift+Click range selection
- `isBulkDeleting: boolean` and `bulkDeleteProgress: { current, total }` -- for progress tracking
- `showBulkDeleteConfirm: boolean` -- for confirmation dialog

**Selection Mode UI (gallery header bar):**
- "Select" / "Cancel" toggle button
- When in selection mode, show: "X Selected" count, "Select All", "Clear Selection", "Delete Selected" (red)

**Gallery grid changes (when in selection mode):**
- Each media item shows a checkbox in the top-left corner
- Clicking an item toggles its selection (instead of showing delete overlay)
- Selected items get a gold/amber ring border (`ring-2 ring-amber-500`)
- Shift+Click selects the range between `lastClickedIndex` and clicked index

**Bulk delete flow:**
1. Click "Delete Selected" -- opens `DeleteConfirmDialog` with warning about permanent S3 deletion
2. On confirm -- call `storage-cleanup` with `action: 'bulk_delete_media'` and the array of IDs
3. Show a progress toast or inline progress bar
4. On completion -- clear selection, refresh media list and people list, show success toast
5. Exit selection mode

---

## 3. Update `DeleteConfirmDialog` for Bulk Context

**File: `src/components/admin/DeleteConfirmDialog.tsx`**

No structural changes needed. The existing component already supports custom `title`, `description`, `warningItems`, and `entityName` props. We will pass bulk-specific text like:

- Title: "Delete 12 Files"
- Description: "You are about to permanently delete 12 files from this album."
- Warning items: "All original files from AWS S3", "All preview/thumbnail versions", "Face detection data for these files", "Client selections (favorites) for these files"

---

## Technical Details

### Bulk Delete Edge Function Action

The new `bulk_delete_media` action in `storage-cleanup`:
- Accepts `{ action: "bulk_delete_media", mediaIds: string[], albumId: string }`
- Fetches all media records in one query: `.in("id", mediaIds)`
- Deletes S3 objects sequentially (to avoid rate limiting)
- Batch-deletes DB records: `detected_faces`, `media_favorites`, `media` using `.in("media_id", mediaIds)` / `.in("id", mediaIds)`
- Recounts people: queries remaining `detected_faces` grouped by `person_id`, deletes people with 0 remaining faces
- Single `deletion_logs` entry for the batch

### Shift+Click Range Selection

Track `lastClickedIndex` (index in the `media` array). On click:
- If Shift held and `lastClickedIndex` is set: select all items between `lastClickedIndex` and current index
- Otherwise: toggle the single item and set `lastClickedIndex`

### Performance

- All S3 deletions happen server-side in the edge function (no browser overhead)
- Single API call regardless of selection size
- Gallery refresh happens once after the entire batch completes

### Files Summary

| File | Change |
|---|---|
| `supabase/functions/storage-cleanup/index.ts` | Add `bulk_delete_media` action |
| `src/pages/admin/AlbumDetail.tsx` | Add selection mode, Shift+Click, bulk delete flow |

