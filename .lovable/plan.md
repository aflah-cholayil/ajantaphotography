

# Fix: Cinematic Video Section Missing from Homepage

## Problem

The video section has valid settings (video uploaded, visibility ON) but disappears from the homepage because:

1. The signed URL is fetched successfully (200 OK)
2. The `<video>` element attempts to load the video from the R2 signed URL
3. The video `onError` event fires (likely due to CORS restrictions on the raw R2 endpoint `*.r2.cloudflarestorage.com`, or browser-specific video loading issues)
4. `hasError` is set to `true`, causing the entire section to return `null` and vanish

## Root Cause

The R2 signed URL points directly to `*.r2.cloudflarestorage.com`. Video elements are more strict about CORS than image elements. When the browser cannot load the video (CORS, network glitch, codec issue), the `onError` handler permanently hides the section with no retry or fallback.

## Fix

Two-part fix in `CinematicVideoSection.tsx`:

### 1. Don't hide the section on video error -- show a graceful fallback instead

Instead of `return null` when `hasError` is true, keep the section visible and show a play button overlay that opens the video URL in a new tab, or show a placeholder message. This way the section is always present when the admin has it enabled.

### 2. Add retry logic on error

When the video fails to load, retry once after a short delay before giving up. Some R2 signed URL issues are transient.

### 3. Use `crossOrigin="anonymous"` attribute

Add the `crossOrigin` attribute to the video element to properly handle CORS for R2 URLs, and add error details logging to diagnose the actual failure.

## Changes

| File | Change |
|------|--------|
| `src/components/home/CinematicVideoSection.tsx` | Remove the early return on `hasError`. Show fallback UI instead. Add retry logic. Add `crossOrigin` attribute. |

## Before (line ~126)

```tsx
// Don't render if there was an error fetching/loading
if (hasError && !isFetchingUrl) {
  return null;
}
```

## After

Remove the above block entirely. Instead, when `hasError` is true, show the section with a fallback play button that links to the video URL. The section heading and decorative frame remain visible regardless of video load state.

## Video element changes

```tsx
<video
  ref={videoRef}
  key={signedVideoUrl}
  className="absolute inset-0 w-full h-full object-cover cursor-pointer"
  src={signedVideoUrl}
  crossOrigin="anonymous"
  muted
  loop
  playsInline
  autoPlay
  preload="auto"
  onLoadedData={handleVideoLoad}
  onError={handleVideoError}
  onClick={handleVideoTap}
/>
```

## Error handler changes

Add a retry counter (max 1 retry). On first error, refetch the signed URL and try again. On second error, show the fallback UI (play icon with "Click to watch" link).

## Fallback UI (shown when hasError is true)

A centered play button with text "Click to play video" that opens the signed URL directly in the browser (which handles CORS differently than a `<video>` element). The section frame and heading remain visible.

