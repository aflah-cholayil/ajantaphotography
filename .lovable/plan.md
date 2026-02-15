

# Upload Reliability Audit & Fix

## Root Cause Analysis

From the edge function logs, presigned URL generation succeeds every time (no errors logged). The same files appear 3 times in logs (~30s, ~34s, ~39s), confirming the retry logic fires but all attempts fail. The failure is happening during the **client-side PUT to R2** using the presigned URL.

Likely causes:
1. **No expiry on presigned URLs** -- `aws4fetch` `sign()` with `signQuery: true` does not set `X-Amz-Expires` by default. R2 may reject or the URL may be invalid without it.
2. **XHR error messages are generic** -- the upload just says "Upload failed: {status}" with no R2 error body, making debugging impossible.
3. **No Content-Length in signed headers** -- R2 can be strict about this.
4. **8 concurrent files hitting edge functions simultaneously** causes cold-start storms (visible in logs: 6+ boots in 1 second).
5. **No XHR timeout** -- hung requests never resolve.

## Changes

### File 1: `supabase/functions/s3-upload/index.ts`

**A. Add env var validation and logging at startup:**
```text
Log presence of R2_ENDPOINT, R2_BUCKET_NAME, R2_ACCESS_KEY_ID (exists: true/false)
Log R2_ENDPOINT format to verify it matches https://<id>.r2.cloudflarestorage.com
```

**B. Add expiry to presigned URL** (critical fix):
Set `X-Amz-Expires` header or add expires parameter in the `sign()` call so R2 accepts the URL.

**C. Add Content-Length to signed headers** so the presigned URL expects the correct file size.

**D. Add detailed error logging:**
Log file name, size, generated key, and any signing errors with full details.

**E. Remove all AWS references** -- this function already only uses R2, just clean up comments.

### File 2: `supabase/functions/s3-multipart-upload/index.ts`

**A. Remove dual-provider AWS logic entirely:**
- Remove `awsClient`, `awsRegion`, `awsBucket` initialization
- Remove `getClient()` and `getBaseUrl()` helper functions
- Hardcode R2 client for all operations
- Keep `provider` parameter acceptance for backwards compatibility but ignore it

**B. Add env var validation logging on boot.**

**C. Add detailed error logging** in `initiateMultipartUpload`, `completeMultipartUpload`:
- Log the R2 XML error response body
- Log file name, size, part number on failures
- Return the actual R2 error message to the frontend

**D. Add expiry to part presigned URLs** (same fix as s3-upload).

### File 3: `src/lib/uploadEngine.ts`

**A. Add XHR timeout** (60 seconds for small files, 5 minutes per part for multipart):
```text
xhr.timeout = 60000; // 60s for small files
xhr.ontimeout = () => reject(new Error('Upload timed out'));
```

**B. Improve error messages from XHR:**
Read the response body on failure to get the actual R2 error:
```text
xhr.addEventListener('load', () => {
  if (xhr.status >= 200 && xhr.status < 300) resolve();
  else reject(new Error(`Upload failed: ${xhr.status} - ${xhr.responseText}`));
});
```

**C. Reduce concurrent files from 8 to 4:**
Reduce `MAX_CONCURRENT_FILES` from 8 to 4 to avoid cold-start storms and R2 rate limits.

**D. Add jitter to retry delays:**
Prevent all retries from firing simultaneously:
```text
const jitter = Math.random() * 1000;
await new Promise(r => setTimeout(r, delay + jitter));
```

**E. Remove `storageProvider` conditional -- always send `'r2'`** (already done, just verify).

### File 4: `supabase/functions/s3-signed-url/index.ts`

**A. Keep dual-provider read logic** -- existing AWS-stored files still need to be readable. This is read-only, not upload-related, so dual-provider stays here.

### File 5: `supabase/functions/save-media-record/index.ts`

**A. Hardcode `storage_provider: 'r2'`** server-side instead of trusting client input:
```text
storage_provider: "r2",  // All new uploads go to R2
```

## Summary of Key Fixes

| Issue | Fix | File |
|-------|-----|------|
| No URL expiry | Add `X-Amz-Expires` to presigned URL signing | s3-upload, s3-multipart-upload |
| Generic error messages | Read XHR responseText on failure | uploadEngine.ts |
| Cold-start storms | Reduce concurrency from 8 to 4 | uploadEngine.ts |
| No XHR timeout | Add 60s/300s timeouts | uploadEngine.ts |
| Retry stampede | Add random jitter to retry delays | uploadEngine.ts |
| AWS code in upload path | Remove from s3-multipart-upload | s3-multipart-upload |
| No env validation | Log env var presence on function boot | s3-upload, s3-multipart-upload |
| Missing Content-Length | Include in presigned URL signing | s3-upload |

## Files Modified
1. `supabase/functions/s3-upload/index.ts` -- presigned URL expiry, Content-Length, env logging
2. `supabase/functions/s3-multipart-upload/index.ts` -- remove AWS, add expiry, error details
3. `src/lib/uploadEngine.ts` -- XHR timeout, better errors, reduce concurrency, retry jitter
4. `supabase/functions/save-media-record/index.ts` -- hardcode r2 provider

