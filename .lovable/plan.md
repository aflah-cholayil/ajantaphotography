

# Fix R2 Uploads — Server-Side Test + CORS Bypass

## Diagnosis

The edge function code is correct. Presigned URLs are generated with `X-Amz-SignedHeaders=host` only. R2 credentials are valid (ENDPOINT, BUCKET, ACCESS_KEY, SECRET_KEY all present). The problem is that the browser's PUT request to `r2.cloudflarestorage.com` is blocked by **CORS** -- R2 is not returning `Access-Control-Allow-Origin` headers, so the browser aborts the request and fires a generic "network error" with no details.

## Plan

### Step 1: Add Server-Side Test Upload to `s3-upload` Edge Function

Add an `action: "test"` mode that performs a real PUT of a tiny test file (a few bytes) from the edge function directly to R2. This runs server-side, completely bypasses CORS, and proves whether the R2 credentials and bucket configuration are correct.

**File**: `supabase/functions/s3-upload/index.ts`
- When the body contains `{ "action": "test" }`, the function will:
  - Create a 10-byte test payload
  - PUT it to `test/connectivity-test.txt` in the R2 bucket using `r2.fetch()`
  - Return the HTTP status from R2 (200/403/etc.) with full error details
  - Then DELETE the test file
- This gives us a definitive answer: are the credentials valid?

### Step 2: Improve Upload Error Reporting in Frontend

**File**: `src/lib/uploadEngine.ts`
- In `uploadSmallFile()`, replace the XHR-based upload with `fetch()` API when possible
- The `fetch()` API provides `TypeError: Failed to fetch` for CORS issues but also allows catching HTTP error responses when CORS is configured
- Add detailed logging: log the presigned URL domain, the XHR readyState, and status code on failure
- Show the actual R2 error message in the upload UI instead of generic "Upload network error"

### Step 3: CORS Configuration Reminder

You **must** update your R2 bucket CORS settings in the Cloudflare dashboard. This is the root cause. Go to:

**R2 > ajanta-media > Settings > CORS Policy**

Set this exact JSON:
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

Without this, **no browser-based upload will ever succeed** regardless of how the presigned URL is generated. The browser sends a CORS preflight (OPTIONS) request before the PUT, and R2 must respond with the correct headers.

### Deployment

1. Update and deploy `s3-upload` edge function with `action: "test"` support
2. Update `uploadEngine.ts` with better error reporting
3. Add a "Test R2 Connection" button on the album page that calls the test action
4. Test the connection server-side first, then test a real upload after CORS is configured

