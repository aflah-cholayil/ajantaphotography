import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { X, Loader2, Image, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const categories = ['All', 'Wedding', 'Pre-Wedding', 'Event', 'Candid', 'Other'];
const types = ['All', 'Photo', 'Video'];

interface Work {
  id: string;
  title: string;
  category: string;
  type: string;
  s3_key: string;
  s3_preview_key: string | null;
}

const Gallery = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeType, setActiveType] = useState('All');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorks = async () => {
      try {
        const { data, error } = await supabase
          .from('works')
          .select('id, title, category, type, s3_key, s3_preview_key')
          .eq('status', 'active')
          .eq('show_on_gallery', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setWorks(data || []);

        // Fetch signed URLs
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

  const displayImages = works.map((work) => ({
    id: work.id,
    src: imageUrls[work.id] || '',
    alt: work.title,
    category: work.category,
    type: work.type,
  })).filter(img => img.src); // Only show images that have loaded URLs

  const filteredImages = displayImages.filter((img) => {
    const categoryMatch = activeCategory === 'All' || img.category.toLowerCase() === activeCategory.toLowerCase().replace('-', '');
    const typeMatch = activeType === 'All' || img.type.toLowerCase() === activeType.toLowerCase();
    return categoryMatch && typeMatch;
  });

  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-32 pb-16 bg-card">
        <div className="container mx-auto px-6">
          <SectionHeading
            subtitle="Our Work"
            title="Portfolio Gallery"
            description="A collection of beautiful moments we have had the privilege to capture."
          />
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 bg-card border-b border-border sticky top-16 z-30">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-6 py-2 font-sans text-sm uppercase tracking-wider transition-all duration-300 ${
                  activeCategory === category
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="flex justify-center gap-4">
            {types.map((type) => (
              <button
                key={type}
                onClick={() => setActiveType(type)}
                className={`flex items-center gap-1 px-4 py-1 font-sans text-xs uppercase tracking-wider transition-all duration-300 rounded-full ${
                  activeType === type
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {type === 'Photo' && <Image size={12} />}
                {type === 'Video' && <Video size={12} />}
                {type}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No works found matching your filters.</p>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredImages.map((image, index) => (
                  <motion.div
                    key={image.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="group cursor-pointer"
                    onClick={() => setSelectedImage(image.src)}
                  >
                    <div className="aspect-[4/5] overflow-hidden rounded-lg">
                      {image.type === 'video' ? (
                        <video
                          src={image.src}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          muted
                        />
                      ) : (
                        <img
                          src={image.src}
                          alt={image.alt}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 p-2 text-foreground hover:text-primary transition-colors"
            >
              <X size={32} />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              src={selectedImage}
              alt="Full view"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
};

export default Gallery;
