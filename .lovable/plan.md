

# Fix Upload Counter Accuracy + Proper Cancel Behavior

## Summary
Refactor the upload engine and progress panel to fix inaccurate counters, implement proper cancel with abort + summary, and add a "cancelled" status for files.

---

## Current Issues Identified

1. **Cancel marks files as `error` with message "Cancelled"** instead of a dedicated `cancelled` status -- this mixes cancelled files with genuinely failed files in counts
2. **Pending files are not marked cancelled on cancel** -- only actively uploading files get stopped; queued files remain as `pending`
3. **No upload summary shown after cancel or completion** -- panel just stays with raw counts
4. **Progress is already byte-based** (this is correctly implemented via `totalBytesUploaded / totalBytes`)
5. **Counts are already filter-based** (using `.filter(f => f.status === ...)`) -- they work correctly but the `cancelled` state is missing
6. **dbSaved is already tracked separately** and only set after successful DB insert

## What Actually Needs to Change

The core engine architecture is solid. The main fixes are:

1. Add a `cancelled` status to the file state type
2. Cancel logic: mark queued files as `cancelled`, mark uploading files as `cancelled` (not `error`)
3. Add a summary view that appears after cancel or completion
4. Auto-clear behavior when all files are processed

---

## Implementation Steps

### Step 1: Update `src/lib/uploadEngine.ts`

**Add `cancelled` to FileUploadStatus:**
```
export type FileUploadStatus = 'pending' | 'uploading' | 'success' | 'error' | 'cancelled';
```

**Fix `cancel()` method:**
- Mark all `uploading` files as `cancelled` (not `error`)
- Mark all `pending` files as `cancelled`
- Abort multipart uploads for in-progress files
- Set `isCancelled = true` and `isUploading = false`

**Fix `retryFailed()` method:**
- Only retry files with status `error` (exclude `cancelled`)
- This is already mostly correct since cancelled files won't match `error`

### Step 2: Refactor `src/components/admin/UploadProgressPanel.tsx`

**Add cancelled count to summary stats:**
- Show `cancelledCount` alongside existing done/uploading/failed/queued counts

**Add Upload Summary view:**
- When `allDone` is true (no uploading, no pending), show a summary block:
  - Completed count (green checkmark)
  - Failed count (red X)
  - Cancelled count (grey stop icon)
  - Total attempted
- Show "Retry Failed" button if any failed
- Show "Close" button that calls `onClear`

**File list: show cancelled status:**
- Add a stop-circle icon for cancelled files
- Show "Cancelled" text in the status column

### Step 3: Update `src/components/admin/MediaUploader.tsx`

**Auto-clear after completion:**
- When upload finishes with zero failures, auto-dismiss after a short delay (3 seconds)
- If there are failures, keep the panel visible with the summary

---

## Technical Details

### Updated cancel() logic in uploadEngine.ts
```text
cancel() {
  this.state.isCancelled = true;
  
  // Abort all active XHR requests
  this.abortControllers.forEach(ctrl => ctrl.abort());
  this.abortControllers.clear();

  for (const file of this.state.files) {
    if (file.status === 'uploading') {
      // Abort multipart if in progress
      if (file.uploadId && file.s3Key) {
        supabase.functions.invoke('s3-multipart-upload', {
          body: { action: 'abort', s3Key: file.s3Key, uploadId: file.uploadId },
        }).catch(() => {});
      }
      file.status = 'cancelled';
      file.error = 'Cancelled';
    } else if (file.status === 'pending') {
      file.status = 'cancelled';
    }
  }
  
  this.state.isUploading = false;
  this.notify();
}
```

### Updated UploadProgressPanel counts
```text
const cancelledCount = files.filter(f => f.status === 'cancelled').length;
// allDone includes cancelled files
const allDone = !isUploading && pendingCount === 0 && uploadingCount === 0;
```

### Summary view (shown when allDone and has results)
```text
Upload Summary:
  [checkmark] Completed: {successCount}
  [x] Failed: {errorCount}  
  [stop] Cancelled: {cancelledCount}
  Total: {files.length}

[Retry Failed] [Close]
```

### Files to Modify
1. `src/lib/uploadEngine.ts` -- Add `cancelled` status, fix cancel logic
2. `src/components/admin/UploadProgressPanel.tsx` -- Add cancelled display, summary view
3. `src/components/admin/MediaUploader.tsx` -- Minor: auto-clear logic after success

