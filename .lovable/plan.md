

# Fix R2 Upload Failures — Root Cause Found

## Root Cause (Confirmed from Network Logs)

Two issues are causing every upload to fail:

### Issue 1: Signature Mismatch (Code Bug)

The presigned URLs contain `X-Amz-SignedHeaders=host;x-amz-expires`. This means R2 expects the browser to send an `X-Amz-Expires` HTTP header in its PUT request. But the browser XHR only sends `Content-Type` -- it never sends `X-Amz-Expires` as a header. R2 computes a different signature than what's in the URL and rejects the request.

**Cause**: The `s3-upload` edge function passes `"X-Amz-Expires": "3600"` inside the `headers` object of `r2.sign()`. The `aws4fetch` library treats this as a header that must be present in the actual request. It should NOT be in headers at all -- `aws4fetch` with `signQuery: true` automatically puts the expiry in the query string.

Similarly, `Content-Type` and `Content-Length` are in the sign headers but they cause the same issue -- the signature requires these exact header values, but the browser may send slightly different values (or R2 processes them differently).

**Fix**: Sign with ONLY the `host` header (which is automatic). Remove `Content-Type`, `Content-Length`, and `X-Amz-Expires` from the headers passed to `sign()`. The browser can send whatever headers it wants as long as they're not in the signed set.

### Issue 2: CORS (Configuration)

The browser origin for testing is `https://3c0363e9-f83f-432c-8d7c-86574eed00e0.lovableproject.com`. Your R2 bucket CORS must include this origin (and your production domain). Without it, the browser blocks the PUT request entirely, which shows up as a generic "network error."

**Action required by you**: In your Cloudflare dashboard, go to R2 > ajanta-media bucket > Settings > CORS Policy, and set:
```json
[
  {
    "AllowedOrigins": [
      "https://ajantaphotography.in",
      "https://*.lovableproject.com",
      "https://*.lovable.app"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
Note: `ExposeHeaders: ["ETag"]` is critical for multipart uploads -- the browser needs to read the ETag response header from each part upload.

Wait 2-3 minutes after saving for CORS to propagate.

## Code Changes

### File 1: `supabase/functions/s3-upload/index.ts`

Remove all headers from the `sign()` call except let `host` be automatic:

```typescript
// BEFORE (broken):
const signedReq = await r2.sign(objectUrl, {
  method: "PUT",
  headers: {
    "Content-Type": fileType,
    "Content-Length": String(fileSize),
    "X-Amz-Expires": "3600",
  },
  aws: { signQuery: true },
});

// AFTER (fixed):
const signedReq = await r2.sign(objectUrl, {
  method: "PUT",
  aws: { signQuery: true },
});
```

This produces `X-Amz-SignedHeaders=host` only, so the browser's PUT request will always match.

### File 2: `supabase/functions/s3-multipart-upload/index.ts`

Same fix for the `getPartUploadUrl` function -- remove `X-Amz-Expires` from headers:

```typescript
// BEFORE:
const signed = await r2Client.sign(url, {
  method: "PUT",
  headers: { "X-Amz-Expires": "3600" },
  aws: { signQuery: true },
});

// AFTER:
const signed = await r2Client.sign(url, {
  method: "PUT",
  aws: { signQuery: true },
});
```

### File 3: `src/lib/uploadEngine.ts`

Add a diagnostic test endpoint call to help debug any remaining issues. When a PUT fails, capture the actual HTTP status from the XHR response (currently it fires the `error` event with no details because CORS blocks reading the response). After CORS is fixed, the `load` event will fire instead, and we'll get the actual R2 error message.

No major structural changes needed -- the existing timeout, retry, and concurrency logic is already correct.

## Deployment Order

1. I will update `s3-upload` and `s3-multipart-upload` edge functions (code fix)
2. Deploy both functions
3. **You** must update R2 bucket CORS in Cloudflare dashboard (manual step)
4. Wait 2-3 minutes for CORS propagation
5. Test upload of 1 small image

## Why This Will Work

- The presigned URL will only sign the `host` header, so any PUT request from any origin with any headers will have a valid signature
- CORS will allow the browser to actually make the PUT request and read the response
- The existing retry and timeout logic will handle any transient failures
- ETag exposure in CORS ensures multipart uploads can read the part ETags

