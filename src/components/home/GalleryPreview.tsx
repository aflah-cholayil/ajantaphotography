import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
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

        // Fetch signed URLs in parallel
        if (data && data.length > 0) {
          const entries = await Promise.all(
            data.map(async (work) => {
              try {
                const response = await fetch(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/s3-signed-url?key=${encodeURIComponent(work.s3_key)}`
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
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayImages.slice(0, 6).map((image, index) => (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative overflow-hidden rounded-lg group cursor-pointer ${
                  index === 0 ? 'md:row-span-2' : ''
                }`}
              >
                <div className="aspect-[4/5] md:h-full overflow-hidden">
                    <motion.img
                      src={image.src}
                      alt={image.alt}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    initial={{ scale: 1 }}
                    whileInView={{ scale: 1.08 }}
                    viewport={{ once: true }}
                    transition={{ duration: 8, ease: 'linear' }}
                    whileHover={{ scale: 1.15 }}
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 flex items-end p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <span className="font-serif text-xl text-foreground">{image.alt}</span>
                </div>
              </motion.div>
            ))}
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
