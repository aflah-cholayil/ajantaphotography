

# Fix Gallery Video Playback

## Problem

Two issues causing videos to break on the gallery page:

1. **Grid thumbnail**: Videos use signed R2 URLs directly in `<video src>`, which fails due to browser ORB (Opaque Response Blocking) / CORS restrictions. The same issue was previously solved for the homepage showcase video using the `video-stream` edge function proxy.

2. **Lightbox**: When a video work is clicked, the lightbox always renders `<motion.img>` (line 296-305). An `<img>` tag cannot display video content, resulting in a broken image icon showing "Full view" alt text.

## Root Cause

- The `video-stream` edge function only allows keys starting with `assets/showcase_video/` (line 47). Gallery work videos use a `works/` prefix, so they get a 403 "Access denied" response.
- The lightbox has no video-aware rendering — it always uses `<img>`.

## Changes

### 1. Edge Function: `supabase/functions/video-stream/index.ts`

Expand the allowed key prefixes to include `works/` alongside `assets/showcase_video/`:

```typescript
// Replace the strict prefix check with:
const allowedPrefixes = ["assets/showcase_video/", "works/"];
if (!allowedPrefixes.some(p => key.startsWith(p))) {
  return new Response(JSON.stringify({ error: "Access denied" }), {
    status: 403,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
```

### 2. Gallery Page: `src/pages/Gallery.tsx`

**a) Video thumbnails in grid** — use the video-stream proxy URL instead of signed URL:

For video-type works, construct the src as the video-stream proxy URL:
```
`${SUPABASE_URL}/functions/v1/video-stream?key=${encodeURIComponent(work.s3_key)}`
```

Add `preload="metadata"` and `playsInline` to the thumbnail `<video>` element so the browser loads the first frame as a poster.

**b) Track the selected work's type** — add state to know if the lightbox should show a video or image.

**c) Lightbox rendering** — conditionally render `<video>` with controls for video works, or `<motion.img>` for photos:

```tsx
{selectedWorkType === 'video' ? (
  <video
    src={`${SUPABASE_URL}/functions/v1/video-stream?key=${encodeURIComponent(selectedWorkKey)}`}
    controls
    autoPlay
    playsInline
    className="max-w-full max-h-[90vh] rounded-lg"
    onClick={(e) => e.stopPropagation()}
  />
) : (
  <motion.img ... />
)}
```

### Summary

| File | Change |
|------|--------|
| `supabase/functions/video-stream/index.ts` | Allow `works/` prefix in addition to `assets/showcase_video/` |
| `src/pages/Gallery.tsx` | Use video-stream proxy for video thumbnails; render `<video>` in lightbox for video works |

No other files modified. No changes to quotation, email, or calculation logic.

