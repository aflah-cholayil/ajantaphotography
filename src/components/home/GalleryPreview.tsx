import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { supabase, supabaseUrl } from '@/integrations/supabase/client';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import gallery1 from '@/assets/gallery-1.jpg';
import gallery2 from '@/assets/gallery-2.jpg';
import gallery3 from '@/assets/gallery-3.jpg';

// Fallback images for when no works are uploaded
const fallbackImages = [
  { src: gallery1, alt: 'Wedding couple portrait' },
  { src: gallery2, alt: 'Wedding venue decor' },
  { src: gallery3, alt: 'Wedding details' },
];

interface Work {
  id: string;
  title: string;
  s3_key: string;
  s3_preview_key: string | null;
}

export const GalleryPreview = () => {
  const [works, setWorks] = useState<Work[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'center',
    slidesToScroll: 1,
  });

  // Track selected index
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Autoplay
  useEffect(() => {
    if (!emblaApi || isHovered) {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
      return;
    }
    autoplayRef.current = setInterval(() => {
      emblaApi.scrollNext();
    }, 3000);
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [emblaApi, isHovered]);

  // Fetch works (unchanged logic)
  useEffect(() => {
    const fetchWorks = async () => {
      try {
        const { data, error } = await supabase
          .from('works')
          .select('id, title, s3_key, s3_preview_key')
          .eq('status', 'active')
          .eq('show_on_home', true)
          .order('sort_order', { ascending: true })
          .limit(6);

        if (error) throw error;
        setWorks(data || []);

        if (data && data.length > 0) {
          const entries = await Promise.all(
            data.map(async (work) => {
              try {
                const response = await fetch(
                  `${supabaseUrl}/functions/v1/s3-signed-url?key=${encodeURIComponent(work.s3_key)}`
                );
                if (response.ok) {
                  const { url } = await response.json();
                  return [work.id, url] as const;
                }
              } catch { /* skip */ }
              return null;
            })
          );
          const urls: Record<string, string> = {};
          for (const entry of entries) {
            if (entry) urls[entry[0]] = entry[1];
          }
          setImageUrls(urls);
        }
      } catch (error) {
        console.error('Error fetching works:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchWorks();
  }, []);

  const displayImages = works.length > 0
    ? works.map((work, index) => ({
        id: work.id,
        src: imageUrls[work.id] || fallbackImages[index % fallbackImages.length]?.src,
        alt: work.title,
      }))
    : fallbackImages.map((img, index) => ({ id: `fallback-${index}`, ...img }));

  return (
    <section className="py-24 md:py-32 bg-card">
      <div className="container mx-auto px-6">
        <SectionHeading
          subtitle="Portfolio"
          title="Our Latest Work"
          description="A glimpse into the beautiful moments we've had the privilege to capture."
        />

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div
            className="mt-16 max-w-[1200px] mx-auto"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="overflow-x-hidden py-4" ref={emblaRef}>
              <div className="flex">
                {displayImages.map((image, index) => {
                  const isActive = index === selectedIndex;
                  return (
                    <div
                      key={image.id}
                      className="min-w-0 shrink-0 grow-0 basis-[85%] md:basis-[40%] px-2 md:px-3"
                    >
                      <div
                        className={`relative rounded-[20px] transition-all duration-700 ease-in-out ${
                          isActive
                            ? 'scale-100 opacity-100 shadow-2xl'
                            : 'scale-[0.85] opacity-60'
                        }`}
                      >
                        <div className="aspect-[3/4] overflow-hidden rounded-[20px]">
                          <img
                            src={image.src}
                            alt={image.alt}
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" />
                        <div className="absolute bottom-0 left-0 right-0 p-6 opacity-0 hover:opacity-100 transition-opacity duration-500">
                          <span className="font-serif text-xl text-foreground">{image.alt}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Controls */}
            <div className="flex justify-center items-center gap-4 mt-8">
              <button
                onClick={() => emblaApi?.scrollPrev()}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => emblaApi?.scrollNext()}
                className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Next slide"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <Link to="/gallery" className="btn-gold">
            Explore Full Gallery
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
