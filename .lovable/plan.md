

# Fix "View Full Quotation" Wrong Link

## Problem

The "View Full Quotation" button in the email links to `https://studio-shines-77.lovable.app/quotation/AJ-2026-0002`. This is the old Lovable preview URL, not your published site. When users click it, they see "Publish or update your Lovable project for it to appear here."

## Root Cause

In `supabase/functions/send-quotation/index.ts` (line 93), the fallback URL is hardcoded to the old preview domain:

```
const siteUrl = Deno.env.get("SITE_URL") || "https://studio-shines-77.lovable.app";
```

The `SITE_URL` secret is not configured, so it always falls back to `studio-shines-77.lovable.app`.

The same issue exists in `supabase/functions/send-questionnaire/index.ts` (line 98).

## Fix

**1. Update the fallback URL in both edge functions** to use the correct published URL (`https://ajantaphotography.in` if your custom domain is active, or `https://ajantaphotography.lovable.app`):

- `supabase/functions/send-quotation/index.ts` line 93: change fallback to `https://ajantaphotography.in`
- `supabase/functions/send-questionnaire/index.ts` line 98: change fallback to `https://ajantaphotography.in`

**2. Set the `SITE_URL` secret** to `https://ajantaphotography.in` so both functions use the correct domain going forward.

No other files are changed. No styling or layout modifications.

