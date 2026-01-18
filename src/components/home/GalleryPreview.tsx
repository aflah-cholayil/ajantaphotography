import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { FloatingParticles } from '@/components/ui/FloatingParticles';
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

  const displayImages = works.length > 0
    ? works.map((work, index) => ({
        id: work.id,
        src: imageUrls[work.id] || fallbackImages[index % fallbackImages.length]?.src,
        alt: work.title,
      }))
    : fallbackImages.map((img, index) => ({ id: `fallback-${index}`, ...img }));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const imageVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 40 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: [0.25, 0.1, 0.25, 1] as const,
      },
    },
  };

  return (
    <section className="relative py-24 md:py-32 bg-card overflow-hidden">
      <FloatingParticles count={10} />
      
      <div className="container mx-auto px-6 relative z-10">
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
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {displayImages.slice(0, 6).map((image, index) => (
              <motion.div
                key={image.id}
                variants={imageVariants}
                className={`relative overflow-hidden rounded-lg group cursor-pointer ${
                  index === 0 ? 'md:row-span-2' : ''
                }`}
                whileHover={{ scale: 1.02, transition: { duration: 0.3 } }}
              >
                <div className="aspect-[4/5] md:h-full overflow-hidden relative">
                  <motion.img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                    initial={{ scale: 1.1 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    whileHover={{ scale: 1.15 }}
                  />
                  
                  {/* Gradient overlay */}
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                  />
                  
                  {/* Shine effect */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full"
                    transition={{ duration: 0.8 }}
                  />
                  
                  {/* Title reveal */}
                  <motion.div 
                    className="absolute inset-0 flex items-end p-6"
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <motion.span 
                      className="font-serif text-xl text-foreground"
                      initial={{ y: 20, opacity: 0 }}
                      whileHover={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      {image.alt}
                    </motion.span>
                  </motion.div>

                  {/* Corner frame accents */}
                  <div className="absolute top-3 left-3 w-6 h-6 border-l-2 border-t-2 border-primary/0 group-hover:border-primary/60 transition-colors duration-300" />
                  <div className="absolute top-3 right-3 w-6 h-6 border-r-2 border-t-2 border-primary/0 group-hover:border-primary/60 transition-colors duration-300" />
                  <div className="absolute bottom-3 left-3 w-6 h-6 border-l-2 border-b-2 border-primary/0 group-hover:border-primary/60 transition-colors duration-300" />
                  <div className="absolute bottom-3 right-3 w-6 h-6 border-r-2 border-b-2 border-primary/0 group-hover:border-primary/60 transition-colors duration-300" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 text-center"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Link to="/gallery" className="btn-gold">
              Explore Full Gallery
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
