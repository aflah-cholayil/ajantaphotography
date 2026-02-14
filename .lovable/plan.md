

# Bulk Folder Upload System (30-40GB Support)

This is a large-scale upgrade to the Admin Album system, turning it into a professional bulk upload platform for large photography projects. The plan is broken into phases for manageable implementation.

---

## Phase 1: Folder Upload with Album Creation Dialog

**What it does:** Allows admins to drag-and-drop an entire folder (or use a folder picker) and automatically create an album from it.

- Upgrade `MediaUploader` component to support folder selection via `webkitdirectory` attribute and folder drag-and-drop
- Recursively detect all images/videos from subfolders
- When folder is dropped/selected on the Albums page, show a "Create Album from Folder" dialog with:
  - Album Name (auto-filled from folder name, editable)
  - Client dropdown
  - Event Date picker
  - Auto Scan Faces toggle (default ON)
- On "Create and Upload": create album record, then begin uploading all files

**Files changed:**
- `src/components/admin/MediaUploader.tsx` -- add folder support, increase concurrency
- `src/components/admin/FolderUploadDialog.tsx` -- NEW: album creation modal for folder uploads
- `src/pages/admin/Albums.tsx` -- add "Upload Folder" button that opens the dialog
- `src/pages/admin/AlbumDetail.tsx` -- add "Add Folder" / "Add More Files" button

---

## Phase 2: High-Performance Upload Engine

**What it does:** Replaces the current single-PUT upload with a chunked, parallel, resumable system for handling 30-40GB reliably.

- Implement S3 Multipart Upload via a new edge function `s3-multipart-upload` supporting:
  - `initiate` -- starts a multipart upload, returns uploadId
  - `get_part_url` -- returns a presigned URL for each part (5-20MB chunks)
  - `complete` -- finalizes the multipart upload
  - `abort` -- cancels an incomplete upload
- Frontend upload engine (`src/lib/uploadEngine.ts`) handles:
  - Chunking files into 10MB parts
  - Parallel upload of 5-10 files simultaneously with 3 concurrent parts per file
  - Per-file and overall progress tracking
  - Automatic retry of failed chunks (up to 3 retries)
  - Resume capability (stores upload state in sessionStorage)
  - Cancel upload option
  - Presigned URLs expire after 10 minutes

**Files created:**
- `supabase/functions/s3-multipart-upload/index.ts` -- NEW edge function
- `src/lib/uploadEngine.ts` -- NEW: chunked parallel upload engine

**Files changed:**
- `src/components/admin/MediaUploader.tsx` -- use new upload engine
- `supabase/config.toml` -- register new edge function

---

## Phase 3: Professional Upload UI

**What it does:** Displays detailed, real-time upload statistics.

- Redesign the upload progress display to show:
  - Total files count and total size (e.g., "Uploading 2,435 files (32.4GB)")
  - Overall progress bar with percentage
  - Upload speed (MB/s) calculated from bytes transferred over time
  - Estimated time remaining
  - Per-file status list: checkmark (done), spinner with % (uploading), X with retry (failed)
  - Cancel All button
- Scrollable file list with status icons

**Files changed:**
- `src/components/admin/MediaUploader.tsx` -- complete UI redesign for bulk upload stats
- `src/components/admin/UploadProgressPanel.tsx` -- NEW: dedicated progress panel component

---

## Phase 4: Auto Face Scan Fix

**What it does:** Ensures face recognition triggers automatically and never gets stuck.

- After upload completes AND album has media, auto-trigger face detection regardless of album status
- Add timeout handling: if face processing takes longer than 30 minutes, mark as "failed" with a retry option
- When no faces are found, show "No faces detected" instead of infinite processing
- When new files are added to an existing album, only scan the new media (pass `mediaIds` to the edge function)
- Add incremental scan action to `face-detection` edge function (`action: "process_new_media"`)

**Files changed:**
- `supabase/functions/face-detection/index.ts` -- add incremental scan, timeout handling
- `src/components/admin/MediaUploader.tsx` -- auto-trigger after upload
- `src/pages/admin/AlbumDetail.tsx` -- improved face status display

---

## Phase 5: Bulk Selection System (Client Gallery)

**What it does:** Adds professional selection tools for the client gallery.

- Shift+Click for range selection
- "Select All" button per tab (photos/videos)
- Selection counter in header
- Download Selected as ZIP
- Filter by Photos / Videos / People (already partially exists via tabs)

**Files changed:**
- `src/pages/client/AlbumView.tsx` -- add Shift+Click range selection logic
- `src/components/client/OptimizedMediaGrid.tsx` -- support shift-click

---

## Phase 6: Streaming ZIP Download

**What it does:** Replaces the current in-memory ZIP with a streaming approach for large albums.

- Create `s3-download-zip` edge function that:
  - Accepts an array of S3 keys
  - Streams files from S3 and assembles ZIP on-the-fly
  - Returns the ZIP as a streaming response
- Frontend shows download progress
- Fallback to client-side ZIP for small selections (under 50 files)

**Files created:**
- `supabase/functions/s3-download-zip/index.ts` -- NEW: server-side streaming ZIP

**Files changed:**
- `src/pages/client/AlbumView.tsx` -- use server-side ZIP for large downloads
- `supabase/config.toml` -- register new function

---

## Phase 7: Thumbnail Generation and Optimization

**What it does:** Generates web-optimized versions and thumbnails for faster gallery loading.

- After upload, generate thumbnails server-side via a new edge function `generate-thumbnails`
- Store in S3 under the path: `albums/{albumId}/thumbnails/{filename}`
- Save `s3_preview_key` to the media record for the optimized version
- Client gallery loads thumbnail/preview; download gives original
- Optional: admin toggle for "compress before upload" (client-side, lossless resize to max 4000px)

**Files created:**
- `supabase/functions/generate-thumbnails/index.ts` -- NEW: background thumbnail generation

**Files changed:**
- `src/components/admin/MediaUploader.tsx` -- trigger thumbnail generation after upload
- `supabase/config.toml` -- register function

---

## Phase 8: Album Expiry Settings in Admin

**What it does:** Adds configurable expiry to Studio Settings and shows expiry info in UI.

- Add "Album Expiry" card to Settings page with options: 30 / 60 / 90 / No Expiry
- Show expiry countdown badge on album cards (Admin and Client)
- Show warning banner in client album view when album expires within 7 days

**Files changed:**
- `src/pages/admin/Settings.tsx` -- add Album Expiry section
- `src/pages/admin/Albums.tsx` -- show expiry badges
- `src/pages/client/AlbumView.tsx` -- show expiry warning

---

## Technical Details

### Database Migration
- Add `s3_preview_key` column to `media` table if not present (already exists)
- No new tables needed -- existing `deletion_logs`, `studio_settings`, and album expiry columns are already in place

### Edge Functions Summary
| Function | Purpose |
|---|---|
| `s3-multipart-upload` | Initiate/part-url/complete/abort multipart uploads |
| `s3-download-zip` | Server-side streaming ZIP generation |
| `generate-thumbnails` | Background thumbnail/preview generation |

### Security
- All upload endpoints require admin Bearer token authentication
- Presigned URLs expire after 10 minutes
- Public users cannot upload
- All delete operations logged in `deletion_logs`

### Browser Compatibility
- Uses standard Web APIs (XMLHttpRequest for progress, IntersectionObserver for lazy load)
- Works on Chrome, Safari, Edge
- Mobile-compatible with simplified UI (no drag-and-drop, file picker only)

### Performance Safeguards
- Files processed in batches to avoid browser memory issues
- Upload engine uses Web Workers pattern (non-blocking)
- Maximum 10 concurrent XHR connections
- SessionStorage for resume state (cleared on completion)

