

# Fix: Video Cover Images Not Showing in Client Gallery

## Root Cause

In `OptimizedMediaGrid.tsx` (line 266), the video thumbnail uses:

```
poster={url + '#t=0.1'}
```

This is broken because:
1. The `poster` attribute expects an **image URL** (jpg/png), not a video URL
2. Appending `#t=0.1` to a signed R2 URL does nothing for the poster -- it's only meaningful on `<video src>`
3. With `preload="metadata"`, R2 may not serve enough data via range requests for the browser to render a first frame

Additionally, videos in the database have `s3_preview_key` as `NULL`, so there's no separate thumbnail image to use.

## Fix (in `OptimizedMediaGrid.tsx`)

Two changes to the video rendering block (lines 259-269):

1. **Remove the broken `poster` attribute** entirely
2. **Change `preload="metadata"` to `preload="auto"`** so the browser downloads enough of the video to render the first visible frame

Before:
```tsx
<video
  src={url}
  className="w-full h-full object-cover"
  muted
  playsInline
  preload="metadata"
  poster={url + '#t=0.1'}
  onError={handleImageError}
  onLoadedData={() => setIsLoading(false)}
/>
```

After:
```tsx
<video
  src={url}
  className="w-full h-full object-cover"
  muted
  playsInline
  preload="auto"
  onError={handleImageError}
  onLoadedData={() => setIsLoading(false)}
/>
```

## Files Changed

| File | Change |
|------|--------|
| `src/components/client/OptimizedMediaGrid.tsx` | Remove broken `poster` attr, change `preload` to `"auto"` |

## What Is NOT Touched

- No backend/edge function changes
- No database changes
- No storage structure changes
- No other component changes

This is a 2-line fix in a single file.

