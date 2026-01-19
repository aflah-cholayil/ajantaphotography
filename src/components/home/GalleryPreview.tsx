import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Image } from 'lucide-react';

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

        // Fetch signed URLs for images
        if (data && data.length > 0) {
          const urls: Record<string, string> = {};
          for (const work of data) {
            try {
              const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/s3-signed-url?key=${encodeURIComponent(work.s3_preview_key || work.s3_key)}`
              );
              if (response.ok) {
                const { url } = await response.json();
                urls[work.id] = url;
              }
            } catch (err) {
              console.error('Failed to get signed URL');
            }
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

  const displayImages = works
    .filter(work => imageUrls[work.id]) // Only include works with loaded URLs
    .map((work) => ({
      id: work.id,
      src: imageUrls[work.id],
      alt: work.title,
    }));

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
        ) : displayImages.length === 0 ? (
          <div className="mt-16 text-center py-16">
            <Image className="mx-auto h-16 w-16 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              Portfolio coming soon. Check back for our latest work.
            </p>
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
                    className="w-full h-full object-cover"
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
