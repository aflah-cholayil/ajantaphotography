

# Increase Showcase Video Upload Limit to 1 GB

## Problem
The video upload size limit in `src/components/admin/VideoUploader.tsx` is currently hardcoded to 500 MB.

## Changes
**File:** `src/components/admin/VideoUploader.tsx`

Two edits:

1. **Line 37-41** — Change the size check from `500 * 1024 * 1024` to `1024 * 1024 * 1024` and update the error message to "Maximum video size is 1GB".

2. **Line 205** — Update the help text from "Max size: 500MB" to "Max size: 1GB".

No other files or logic affected.

