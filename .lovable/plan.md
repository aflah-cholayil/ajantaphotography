
# Fix Gallery Carousel Image Clipping & Crash

## Problems

1. **Runtime crash**: `Cannot read properties of null (reading 'useRef')` in `useEmblaCarousel` — likely a duplicate React instance from the `embla-carousel-react` bundle. Fix by using a dynamic import pattern or ensuring proper React resolution.

2. **Images clipped**: The `overflow-hidden` on the inner slide `div` (line 152) combined with `scale-[0.85]` on side cards causes visual clipping. The `aspect-[3/4] max-h-[450px]` wrapper also constrains images. The outer `overflow-hidden` on the Embla viewport (line 142) is needed for the carousel but the inner slide's overflow should not clip the scaled content.

## Changes

### File: `src/components/home/GalleryPreview.tsx`

1. **Move `overflow-hidden` from the inner card div to the image wrapper only** — the card itself should allow the scale transform to render fully without clipping. Keep `overflow-hidden` on the `aspect-[3/4]` image container so images are cropped to fit, but remove it from the card wrapper that applies `scale()`.

2. **Remove `max-h-[450px]`** — this arbitrarily clips tall images. The `aspect-[3/4]` ratio already controls dimensions. Let the slide basis control the width and aspect ratio control the height naturally.

3. **Add padding to the Embla viewport container** to prevent side-image clipping at edges — use `py-4` so scaled shadows and edges aren't cut off.

4. **Ensure the `overflow-hidden` on Embla viewport only clips horizontally** — use `overflow-x-hidden overflow-y-visible` or add vertical padding to compensate.

These are CSS-only changes within `GalleryPreview.tsx`. No other files affected.
