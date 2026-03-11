

# Fix Build Error in storage-stats Edge Function

## Problem
TypeScript error at `supabase/functions/storage-stats/index.ts` line 309: `'error' is of type 'unknown'` — cannot access `.message` directly.

## Current State of Backend
The project already uses Supabase for all backend operations. No Lovable Cloud-specific services exist to remove. The architecture is:
- Database → Supabase (via `@supabase/supabase-js`)
- Auth → Supabase Auth
- Storage → Cloudflare R2 via Supabase Edge Functions
- All API calls → `supabase.functions.invoke()`

## Change

### File: `supabase/functions/storage-stats/index.ts` (line 309)

Cast `error` before accessing `.message`:
```typescript
} catch (error) {
    console.error("storage-stats error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
```

Single line-level fix. No other files need changes.

