

# Phase 2: Admin Edit Upload + Download System

This phase extends the Phase 1 edit request system with admin upload of edited versions, client download, and status management. All changes are additive -- no existing upload, storage, or media table logic is modified.

---

## Design Decision: Keep Everything on `edit_requests` Table

Rather than adding columns to the `media` table (which is critical and heavily used), all edited file references will be stored on the `edit_requests` table. This is safer, backward-compatible, and keeps concerns separated.

---

## Step 1: Database Migration

Add columns to `edit_requests`:

```text
ALTER TABLE edit_requests ADD COLUMN edited_s3_key TEXT NULL;
ALTER TABLE edit_requests ADD COLUMN edited_at TIMESTAMPTZ NULL;
ALTER TABLE edit_requests ADD COLUMN edited_by UUID NULL;
```

The existing `status` column already supports any text value. We will use:
- `pending` (existing)
- `completed` (new -- set when admin uploads edited version)

---

## Step 2: New Edge Function -- `upload-edited-media`

A new edge function at `supabase/functions/upload-edited-media/index.ts` that:

1. Authenticates admin user (staff role check)
2. Accepts `{ editRequestId, fileName, fileType, fileSize }`
3. Validates the edit request exists and belongs to a valid album
4. Generates R2 presigned PUT URL with key: `albums/{albumId}/edited/{mediaId}-edited-{timestamp}.{ext}`
5. Returns presigned URL + s3Key
6. Does NOT touch existing upload logic or s3-upload function

This keeps the edited upload flow completely isolated from the original upload system.

---

## Step 3: Update `s3-signed-url` Edge Function

Add a check so that authenticated users (admin or album owner) can access `edited/` keys by verifying them against the `edit_requests.edited_s3_key` column, similar to how `media.s3_key` is already checked.

Small addition to the existing access validation logic -- approximately 10 lines of code added to the existing flow.

---

## Step 4: Admin Side -- Enhanced Edit Requests List

Upgrade `src/components/admin/EditRequestsList.tsx` to add actions for each request:

- **Download Original** button: Uses existing signed URL for the original `media.s3_key`, blob-downloads it (no new tab)
- **Upload Edited Version** button: Opens a file input, uploads to R2 via the new edge function, then updates the edit request record with `edited_s3_key`, `edited_at`, `edited_by`, and `status = 'completed'`
- **Status badges**: Show "Pending" (amber) or "Completed" (green) based on `status`
- Completed items show the edited thumbnail instead

Each card will have these action buttons below the info section.

---

## Step 5: Client Side -- Show Completed Edits

Upgrade `src/components/client/EditRequestsTab.tsx`:

- Show status-aware badges: "Pending" or "Completed"
- For completed items, show a **Download Edited** button that fetches the edited file via signed URL and blob-downloads it
- Optionally show both original and edited thumbnails side by side for completed items

---

## Step 6: Client Gallery -- "Edited Available" Badge (Optional Enhancement)

In `OptimizedMediaGrid.tsx`, for media items that have a completed edit request:
- Show a small sparkle badge "Edited" at the bottom of the thumbnail
- This requires passing a `completedEdits: Set<string>` prop (set of media IDs with completed edits)
- Fetched alongside existing `editRequests` in `AlbumView.tsx`

---

## Files Changed

| File | Action |
|------|--------|
| Database migration | Add 3 columns to `edit_requests` |
| `supabase/functions/upload-edited-media/index.ts` | New -- presigned URL for edited uploads |
| `supabase/functions/s3-signed-url/index.ts` | Small addition -- allow access to `edited/` keys |
| `supabase/config.toml` | Add entry for new edge function (verify_jwt = false) |
| `src/components/admin/EditRequestsList.tsx` | Add download original, upload edited, status management |
| `src/components/client/EditRequestsTab.tsx` | Add completed status display + download edited |
| `src/components/client/OptimizedMediaGrid.tsx` | Add "Edited" badge for completed edits |
| `src/pages/client/AlbumView.tsx` | Fetch completed edits set |

## What Is NOT Touched

- `s3-upload` edge function (original upload logic)
- `s3-multipart-upload` edge function
- `upload-asset` edge function
- `save-media-record` edge function
- `media` table schema
- `uploadEngine.ts` / `uploadManager.ts`
- R2 bucket structure for originals/previews
- Existing gallery rendering logic
- `storage-cleanup` edge function

## Storage Structure

```text
albums/{albumId}/
  originals/          -- existing, untouched
  previews/           -- existing, untouched
  edited/             -- NEW: edited versions only
    {mediaId}-edited-{timestamp}.jpg
```

## Security

- Only staff (owner/admin/editor) can upload edited versions
- Only album owner (client) or staff can download edited versions
- File type validation (images + videos only)
- Signed URLs expire after 1 hour (existing behavior)

