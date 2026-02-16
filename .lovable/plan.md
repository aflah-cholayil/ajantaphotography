

# Phase 1: Edit Request System (Safe Foundation)

This adds an edit request workflow where clients can request edits on specific photos, and admins can view those requests. No storage, upload, or existing gallery logic is touched.

---

## Step 1: Database Migration

Create a new `edit_requests` table (separate from `media` -- avoids altering the critical media table):

```text
edit_requests
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid()
  media_id      UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE
  album_id      UUID NOT NULL REFERENCES albums(id) ON DELETE CASCADE
  user_id       UUID NOT NULL (the client who requested)
  status        TEXT NOT NULL DEFAULT 'pending'  -- 'pending' only for Phase 1
  edit_notes    TEXT NULL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  UNIQUE(media_id, user_id)  -- one request per photo per client
```

RLS policies:
- Clients can INSERT for their own albums (user_id = auth.uid() + album ownership check)
- Clients can SELECT their own requests (user_id = auth.uid())
- Staff can SELECT all requests (is_admin_user)
- Staff can UPDATE/DELETE all requests

This is safer than adding columns to `media` because it keeps the media table untouched.

---

## Step 2: Client Side -- "Request Edit" on Media Hover

In `src/components/client/OptimizedMediaGrid.tsx`:

- Accept a new prop `editRequests: Set<string>` (set of media IDs already requested)
- On each media item hover overlay, add a pencil icon button "Request Edit"
- If the media ID is in `editRequests`, show a "Requested" badge instead
- Clicking "Request Edit" opens a small dialog/modal

---

## Step 3: Client Side -- Edit Request Dialog

Create `src/components/client/EditRequestDialog.tsx`:

- Small modal with:
  - Thumbnail of the selected photo
  - Optional textarea for edit notes
  - "Submit Request" button
- On submit: INSERT into `edit_requests` table
- On success: update local `editRequests` set, show toast

---

## Step 4: Client Side -- "Edit Requests" Tab

In `src/pages/client/AlbumView.tsx`:

- Add a new tab "Edit Requests" (with a pencil icon) after the existing tabs
- Create `src/components/client/EditRequestsTab.tsx`:
  - Fetch `edit_requests` where `album_id = id` and `user_id = auth.uid()`
  - Show grid of requested media thumbnails
  - Each item shows: thumbnail, status badge ("Pending"), edit note (if any), requested date
  - Uses the existing `getSignedUrl` pattern for thumbnails

---

## Step 5: Admin Side -- "Edit Requests" Tab

In `src/pages/admin/AlbumDetail.tsx`:

- Add a new tab "Edit Requests" in the admin album detail page
- Create `src/components/admin/EditRequestsList.tsx`:
  - Fetch `edit_requests` where `album_id = id`, joined with media for file_name
  - Show: thumbnail (reuse existing `mediaUrls`), client name, requested date, edit note, status badge
  - Read-only for Phase 1 (no actions)
  - Show count badge on tab header

---

## Files Changed

| File | Action |
|------|--------|
| Database migration | New `edit_requests` table + RLS |
| `src/components/client/EditRequestDialog.tsx` | New -- modal for requesting edits |
| `src/components/client/EditRequestsTab.tsx` | New -- client tab showing requests |
| `src/components/client/OptimizedMediaGrid.tsx` | Add "Request Edit" button on hover |
| `src/pages/client/AlbumView.tsx` | Add Edit Requests tab, fetch edit requests state |
| `src/components/admin/EditRequestsList.tsx` | New -- admin view of edit requests |
| `src/pages/admin/AlbumDetail.tsx` | Add Edit Requests tab |

## What Is NOT Touched

- Upload logic / R2 integration
- Signed URL generation edge function
- Existing gallery rendering (only adding overlay button)
- Storage system
- Media table schema

