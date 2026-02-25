

# Fix Mobile "Load Failed" for Quotation Links

## Analysis

The current implementation already:
- Uses direct `fetch()` instead of `supabase.functions.invoke()` (fixed previously)
- Edge functions have `verify_jwt = false` in config.toml
- Edge function uses service role key (bypasses RLS)
- CORS headers are set

**However, there is a critical missing piece:** The `fetch` calls to the edge functions are missing the `apikey` header. Supabase's API gateway requires the `apikey` header (the anon key) on ALL requests, even when `verify_jwt = false`. Without it, the gateway rejects the request before it reaches the function — this is the "Load failed" error on mobile.

On desktop while logged in, the browser may have cached credentials or the Supabase client may handle this differently, but a fresh mobile browser session from an email link has no such context.

## Changes

### File: `src/pages/QuotationView.tsx`

**Change 1 — Add `apikey` header to `fetchQuotation` (lines 104-111):**

Add the anon key header so the Supabase gateway accepts the request:

```typescript
const res = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-quotation`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ quotation_number: quotationNumber }),
  }
);
```

**Change 2 — Add `apikey` header to `handleResponse` (lines 127-134):**

Same fix for the status update call:

```typescript
const res = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-quotation-status`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ quotation_number: quotationNumber, action }),
  }
);
```

**Change 3 — Add loading timeout (after line 100):**

Prevent infinite spinner on slow mobile networks:

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    if (loading) {
      setLoading(false);
      setError('Request timed out. Please check your connection and try again.');
    }
  }, 15000);
  return () => clearTimeout(timer);
}, [loading]);
```

### File: `supabase/functions/send-quotation/index.ts`

**Change 4 — Ensure email uses absolute URL (verify line ~93-94):**

The `siteUrl` already constructs an absolute URL. Verify it uses the published domain. Currently it falls back to `studio-shines-77.lovable.app` which is correct for the published URL.

No change needed here — already using absolute URLs.

## Summary

| File | Change |
|------|--------|
| `src/pages/QuotationView.tsx` | Add `apikey` header to both fetch calls + add 15s loading timeout |

The root cause is the missing `apikey` header on the direct fetch calls. The Supabase API gateway requires this header on every request, regardless of JWT verification settings.

