

# Fix Showcase Video Upload Error

## Root Cause

Three issues in `supabase/functions/upload-asset/index.ts`:

### 1. CORS headers are outdated (PRIMARY cause)
The CORS headers are missing `x-supabase-client-platform`, `x-supabase-client-platform-version`, `x-supabase-client-runtime`, `x-supabase-client-runtime-version`. The Supabase JS client v2.97.0 sends these headers, and the browser's preflight (OPTIONS) request is rejected because they're not in `Access-Control-Allow-Headers`. This explains why the edge function logs show no request processing — the actual POST never reaches the handler.

### 2. Auth uses `supabase.auth.getUser(token)` instead of JWT decoding
Other edge functions (like `s3-signed-url`) switched to manual JWT payload decoding to work correctly with Lovable Cloud's ES256 tokens. `upload-asset` still calls `getUser(token)` which can fail.

### 3. File size mismatch: server limits 500MB, UI says 1GB
The edge function rejects files over 500MB, but the client UI displays "Max size: 1GB" and validates at 1GB.

## Changes

### File: `supabase/functions/upload-asset/index.ts`

1. **Update CORS headers** to match the working pattern from `s3-signed-url`:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

2. **Replace `supabase.auth.getUser(token)` with JWT decoding** — add `decodeJwtPayload` helper and use service-role client for role lookup (same pattern as `s3-signed-url`).

3. **Update file size limit** from 500MB to 1GB to match the UI.

| Issue | Fix |
|-------|-----|
| Missing CORS headers | Add `x-supabase-client-*` headers |
| Auth failure with Lovable Cloud tokens | Use `decodeJwtPayload` instead of `getUser()` |
| 500MB server limit vs 1GB UI | Change to `1024 * 1024 * 1024` |

No other files modified.

