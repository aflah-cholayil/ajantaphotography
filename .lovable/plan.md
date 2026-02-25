
## Objective
Fix the “View Full Quotation” link so it never generates URLs with double slashes (e.g. `https://ajantaphotography.in//quotation/...`) and reliably opens the correct public quotation page.

## What I found
- The quotation route itself is correct in the frontend router:
  - `src/App.tsx` has `"/quotation/:quotationNumber"`.
- The email link is generated in backend function:
  - `supabase/functions/send-quotation/index.ts`
  - Current logic concatenates `SITE_URL + "/quotation/..."`.
- If `SITE_URL` is saved with a trailing slash (e.g. `https://ajantaphotography.in/`), concatenation creates `//quotation/...`, causing 404 on your domain.
- Same pattern exists in:
  - `supabase/functions/send-questionnaire/index.ts`
  - So questionnaire links can have the same bug.

## Implementation plan
1. **Normalize base URL before building links** in both backend functions:
   - Trim trailing slashes from `SITE_URL` (or fallback URL) before concatenation.
2. **Build path with a single leading slash**:
   - `.../quotation/${...}` and `.../questionnaire/${...}` using normalized base.
3. **Encode dynamic segment safely**:
   - Wrap quotation number and questionnaire token with `encodeURIComponent(...)`.
4. **Keep all existing functionality unchanged**:
   - No UI/layout/styling changes.
   - No database schema or policy changes.
5. **Validate end-to-end**:
   - Send a fresh quotation email and confirm button URL resolves to:
     - `https://ajantaphotography.in/quotation/<number>` (single slash only).
   - Send questionnaire email and confirm:
     - `https://ajantaphotography.in/questionnaire/<token>`.

## Files to update
- `supabase/functions/send-quotation/index.ts`
- `supabase/functions/send-questionnaire/index.ts`

## Exact code-level approach
- In each function:
  - Read env/fallback into `rawBaseUrl`
  - Normalize:
    - `const baseUrl = rawBaseUrl.replace(/\/+$/, "")`
  - Build final URL using normalized `baseUrl` and encoded path param.

## Technical details (for developer review)
```text
Current:
SITE_URL="https://ajantaphotography.in/"
viewUrl = `${SITE_URL}/quotation/AJ-2026-0002`
=> https://ajantaphotography.in//quotation/AJ-2026-0002   (broken on your host)

After fix:
baseUrl = SITE_URL.replace(/\/+$/, "")
viewUrl = `${baseUrl}/quotation/${encodeURIComponent(quotation_number)}`
=> https://ajantaphotography.in/quotation/AJ-2026-0002    (correct)
```

## Notes
- This fix prevents future broken links regardless of whether `SITE_URL` is stored with or without trailing slash.
- Already-sent emails with broken URLs cannot be edited retroactively; they should be resent after this fix.
