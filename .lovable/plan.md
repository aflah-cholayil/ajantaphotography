

# Fix "Quotation Not Found" on Mobile/Email Links

## Root Cause

The `QuotationView.tsx` page uses `supabase.functions.invoke()` to call the edge functions. When a user opens the quotation link from an email on mobile (no active session), the Supabase JS client may fail to properly invoke the function because it attempts to attach session-related headers. On mobile browsers opening from email, this can cause the request to fail entirely with "Failed to send a request to the Edge Function".

## Fix

Replace `supabase.functions.invoke()` with direct `fetch()` calls using the absolute Supabase URL for both public edge functions (`get-quotation` and `update-quotation-status`). These are public endpoints (`verify_jwt = false`) and do not need authentication.

### File: `src/pages/QuotationView.tsx`

**Change 1 -- `fetchQuotation` function (lines 103-118):**

Replace `supabase.functions.invoke('get-quotation', ...)` with:

```typescript
const res = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-quotation`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quotation_number: quotationNumber }),
  }
);
const data = await res.json();
if (!res.ok || data.error) throw new Error(data.error || 'Quotation not found');
```

**Change 2 -- `handleResponse` function (lines 120-135):**

Replace `supabase.functions.invoke('update-quotation-status', ...)` with:

```typescript
const res = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-quotation-status`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quotation_number: quotationNumber, action }),
  }
);
const data = await res.json();
if (!res.ok || data.error) throw new Error(data.error || 'Failed to update');
```

This removes the dependency on the Supabase client session entirely for these public endpoints, fixing the mobile/email access issue. No edge function or database changes needed.

| File | Change |
|------|--------|
| `src/pages/QuotationView.tsx` | Replace `supabase.functions.invoke` with direct `fetch` for both public endpoints |

