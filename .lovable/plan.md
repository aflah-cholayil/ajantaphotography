

# Fix: Homepage Video Not Playing Automatically

## Problem

The video section shows the "Click to play video" fallback instead of auto-playing because the `crossOrigin="anonymous"` attribute on the `<video>` element triggers a CORS preflight/check against the R2 signed URL. R2's raw storage endpoint does not return the required CORS headers for cross-origin video requests, so the browser blocks the video load entirely and fires `onError`.

## Fix

In `src/components/home/CinematicVideoSection.tsx`:

1. **Remove `crossOrigin="anonymous"`** from the `<video>` element (line 174). Without this attribute, the browser loads the video as a simple cross-origin resource (like an `<img>` tag) without CORS enforcement, which works fine for playback.

2. **Keep everything else** -- the retry logic, fallback UI, `muted`, `autoPlay`, `playsInline` attributes all remain as-is.

## Why This Works

- `<video>` elements do NOT need CORS headers for basic playback (play/pause/display)
- CORS is only needed if you want to read video pixel data via Canvas (which we don't)
- Removing the attribute lets the browser fetch the video without CORS checks, matching how images from R2 already work in the app

## File Changed

| File | Change |
|------|--------|
| `src/components/home/CinematicVideoSection.tsx` | Remove `crossOrigin="anonymous"` from the video element (line 174) |

This is a single-line deletion.

