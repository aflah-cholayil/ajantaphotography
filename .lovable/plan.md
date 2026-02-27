

# Redesign Gallery Preview as 3D Centered Carousel

## Approach

Replace the grid layout in `GalleryPreview.tsx` with a custom React carousel using Embla Carousel (already installed as `embla-carousel-react`). No new dependencies needed.

The carousel will use CSS transforms for the 3D centered-slide effect: center slide at `scale(1)`, adjacent slides at `scale(0.85) opacity(0.6)`, with smooth transitions.

## Changes

### File: `src/components/home/GalleryPreview.tsx` — Full rewrite of render section

Keep all existing data-fetching logic (works, imageUrls, loading state, fallbackImages) unchanged.

Replace the grid (lines 98-131) with an Embla-based carousel:

- Use `useEmblaCarousel` with `{ loop: true, align: 'center', slidesToScroll: 1 }`
- Custom autoplay via `setInterval` (3000ms), paused on hover
- Track `selectedIndex` via Embla's `select` event
- Each slide gets dynamic classes: center slide = `scale-100 opacity-100`, others = `scale-[0.85] opacity-60`
- Images rendered with `rounded-[20px]`, `object-cover`, `aspect-[3/4]`, max-height ~450px
- Slide container: `max-w-[1200px] mx-auto overflow-hidden`
- Responsive: on mobile `basis-[85%]`, on md `basis-[40%]` to show ~2.5 slides
- Prev/Next circular arrow buttons centered below carousel
- Soft shadow on center card via conditional `shadow-2xl`

### Controls

Two circular buttons below the carousel using `ChevronLeft` / `ChevronRight` from lucide-react, styled with thin border, hover background fade — matching the reference design.

### "Explore Full Gallery" link

Kept as-is below the controls.

### No other files changed

- No changes to Index.tsx, Layout, Navbar, Footer, or any other section
- No new dependencies needed (embla-carousel-react already installed)

