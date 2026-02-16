

# Bulk Edit Request from Multi-Select Mode

## What This Does

Adds a "Request Edit" button to the sticky bottom action bar that appears during selection mode. When clicked, it opens a dialog where the client can add optional notes and submit edit requests for all selected photos at once (skipping any that already have a request).

## Changes

### 1. New Component: `BulkEditRequestDialog`

Create `src/components/client/BulkEditRequestDialog.tsx`:

- Accepts `mediaIds: string[]`, `albumId`, `existingEditRequests: Set<string>`
- Filters out items that already have edit requests
- Shows count: "Requesting edits for X of Y selected photos"
- Single notes textarea (shared across all items)
- On submit: batch-inserts into `edit_requests` table for all eligible items
- Shows success toast with count
- Calls `onSuccess` with array of new media IDs to update parent state

### 2. Update `AlbumView.tsx` -- Bottom Action Bar

Add a "Request Edit" button between "Entire Album" and "Download":

```
[Select All] [Entire Album] [Request Edit (N)] [Download (N)] [Cancel]
```

- The button shows count of selected items that do NOT already have an edit request
- Disabled if no eligible items (all already requested)
- Opens the new `BulkEditRequestDialog`
- On success: updates `editRequests` state, clears selection, exits selection mode
- Only visible on the Photos tab (not Videos)

### 3. Files

| File | Action |
|------|--------|
| `src/components/client/BulkEditRequestDialog.tsx` | New -- bulk edit request dialog |
| `src/pages/client/AlbumView.tsx` | Add "Request Edit" button to bottom bar, import dialog |

No database changes needed -- the existing `edit_requests` table supports this. Each selected photo gets its own row, matching the existing single-item behavior.

