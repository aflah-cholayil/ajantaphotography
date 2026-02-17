

# Fix: Video Not Auto-Playing -- R2 Proxy Streaming

## Problem

The signed URL points directly to R2's raw S3 endpoint (`*.r2.cloudflarestorage.com`). This endpoint does not return proper CORS or Content-Type headers for browser video playback. The `<video>` element fails silently and falls back to the "Click to play video" state.

Images from R2 work because `<img>` tags are more lenient. `<video>` elements require proper headers (Content-Type, CORS, Range support) for inline playback.

## Solution

Create a **video streaming proxy edge function** that fetches the video from R2 server-side and streams it back to the browser with correct headers. Then update the component to use this proxy URL instead of the raw R2 signed URL.

## Changes

### 1. New Edge Function: `video-stream`

Create `supabase/functions/video-stream/index.ts`:

- Accepts a `key` query parameter (the S3 key)
- Only allows keys starting with `assets/showcase_video/` (public showcase videos)
- Fetches the video from R2 using the AWS credentials (same as `s3-signed-url`)
- Streams the response back with proper headers:
  - `Content-Type: video/mp4` (derived from file extension)
  - `Access-Control-Allow-Origin: *`
  - `Accept-Ranges: bytes` (for seeking support)
- Supports HTTP Range requests for seeking/scrubbing

### 2. Update `CinematicVideoSection.tsx`

Instead of fetching a signed URL and using it as the video `src`:
- Set the video `src` directly to the edge function proxy URL:
  `${VITE_SUPABASE_URL}/functions/v1/video-stream?key=${encodeURIComponent(showcaseVideoKey)}`
- Remove the signed URL fetch logic entirely (no more `fetchSignedUrl`, `signedVideoUrl`, `isFetchingUrl`, `retryCount`)
- Keep the error fallback UI for resilience
- The video element loads directly from the proxy, which returns proper video headers

### 3. Files

| File | Action |
|------|--------|
| `supabase/functions/video-stream/index.ts` | New -- streaming proxy for showcase videos |
| `src/components/home/CinematicVideoSection.tsx` | Simplify to use proxy URL directly instead of signed URL fetch |

### 4. Why This Works

- The edge function runs server-side, so it can access R2 without CORS restrictions
- It streams the response back to the browser with correct `Content-Type` and CORS headers
- The browser sees a same-origin (or CORS-enabled) video source with proper `video/mp4` content type
- Range request support enables seeking and efficient loading
- No changes to R2 configuration needed

