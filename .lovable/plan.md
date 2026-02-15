

# Production-Grade Upload System Rebuild

A complete overhaul of the upload engine, edge functions, and UI to handle 5GB-40GB folders with 2000-6000 files reliably.

---

## Problem Analysis

After reviewing the current code, these specific bugs and gaps cause failures:

1. **Queue race condition** in `uploadEngine.ts`: The `enqueue()` function calls itself recursively while also being called in a loop, causing duplicate file processing and memory spikes
2. **No exponential backoff** on file-level retries -- only chunk-level retries exist (with linear delay)
3. **No session refresh** before starting uploads -- JWT expires mid-upload for large batches
4. **Incomplete CORS headers** in `s3-upload` function (missing `x-supabase-client-platform` headers) causing random failures
5. **No server-side media save** -- DB insert runs client-side and silently fails, leaving orphan S3 files
6. **No batch size validation** -- browser can freeze when 6000 files are queued at once
7. **Gallery doesn't auto-refresh** after uploads complete

---

## Phase 1: Fix the Upload Engine Core

**File: `src/lib/uploadEngine.ts`** -- Complete rewrite of queue and retry logic

Changes:
- Replace recursive `enqueue()` with a proper semaphore-based queue (simple loop with `Promise.race`)
- Add file-level auto-retry with exponential backoff (1s, 3s, 5s) before marking as failed
- Add session refresh (`supabase.auth.refreshSession()`) before starting and every 30 minutes during upload
- Add batch validation: warn if total size exceeds 50GB, reject files over 2GB each
- Increase parallel files to 8, parts per file to 5
- Add `dbSaved` status field to track if media record was saved
- Move media record save into a retry loop (3 attempts)

---

## Phase 2: Harden the Edge Functions

**File: `supabase/functions/s3-upload/index.ts`** -- Fix CORS headers

- Update CORS headers to match the complete set used by `s3-multipart-upload`

**File: `supabase/functions/s3-multipart-upload/index.ts`** -- Minor hardening

- Add request timeout handling
- Log upload initiation for debugging

**New File: `supabase/functions/save-media-record/index.ts`** -- Server-side media save

- Accepts: `albumId`, `s3Key`, `fileName`, `mimeType`, `size`, `type`, `width`, `height`, `duration`
- Uses service role to insert into `media` table
- Returns the created media record ID
- This ensures DB records are created even if client state is lost

---

## Phase 3: Upgrade MediaUploader and Progress UI

**File: `src/components/admin/MediaUploader.tsx`**

- Add session refresh before starting upload
- Add batch validation with warning toast (file count, total size limits)
- Call `onUploadComplete` after each successful file (not just at end) for incremental gallery refresh
- Increase max file size to 2GB

**File: `src/components/admin/UploadProgressPanel.tsx`**

- Add "Saved to gallery" status indicator (checkmark + "saved" label)
- Show retry attempt count on failing files
- Add file count summary in header: "2,435 files (32.4 GB) -- 1,200 uploaded, 8 uploading, 3 failed, 1,224 queued"

---

## Phase 4: Auto-Refresh Gallery

**File: `src/pages/admin/AlbumDetail.tsx`**

- Pass an `onFileUploaded` callback to `MediaUploader` that calls `fetchMedia()` after every batch of 10 successful uploads (debounced)
- This makes new files appear in the gallery without manual refresh

---

## Phase 5: Background Cleanup

**File: `supabase/functions/storage-cleanup/index.ts`** -- Add orphan cleanup action

- Add `action: 'cleanup_orphans'` that:
  - Lists S3 objects in `albums/` prefix
  - Checks each against `media` table
  - Deletes S3 objects without DB records older than 24 hours
- Add `action: 'abort_stale_multiparts'` that:
  - Lists incomplete multipart uploads via S3 API
  - Aborts any older than 24 hours

---

## Technical Details

### Queue Architecture (Phase 1)

The new queue replaces the recursive pattern with:

```text
┌─────────────┐
│ File Queue   │  All files start here
│ (pending)    │
└──────┬──────┘
       │ Dequeue up to 8 files
       v
┌─────────────┐
│ Active Pool  │  Max 8 concurrent uploads
│ (uploading)  │  Each file: 5 concurrent parts
└──────┬──────┘
       │
  ┌────┴────┐
  │         │
  v         v
┌─────┐  ┌─────┐
│Done │  │Retry│── up to 3 retries with backoff
│     │  │Queue│   then moves to Failed
└─────┘  └─────┘
```

### New Edge Function: `save-media-record`

- Authenticated endpoint (admin only)
- Inserts into `media` table using service role
- Returns `{ id, s3_key }` on success
- Called by upload engine after S3 upload completes
- Registered in `supabase/config.toml` with `verify_jwt = false`

### Files Summary

| File | Action |
|---|---|
| `src/lib/uploadEngine.ts` | Rewrite queue, add retries, session refresh, server-side save |
| `supabase/functions/s3-upload/index.ts` | Fix CORS headers |
| `supabase/functions/s3-multipart-upload/index.ts` | Minor hardening |
| `supabase/functions/save-media-record/index.ts` | NEW: server-side media record creation |
| `supabase/functions/storage-cleanup/index.ts` | Add orphan cleanup actions |
| `src/components/admin/MediaUploader.tsx` | Session refresh, batch validation, incremental refresh |
| `src/components/admin/UploadProgressPanel.tsx` | Enhanced status display |
| `src/pages/admin/AlbumDetail.tsx` | Auto-refresh gallery on uploads |
| `supabase/config.toml` | Register `save-media-record` |

