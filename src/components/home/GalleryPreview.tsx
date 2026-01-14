import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SectionHeading } from '@/components/ui/SectionHeading';
import gallery1 from '@/assets/gallery-1.jpg';
import gallery2 from '@/assets/gallery-2.jpg';
import gallery3 from '@/assets/gallery-3.jpg';

const galleryImages = [
  { src: gallery1, alt: 'Wedding couple portrait', span: 'row-span-2' },
  { src: gallery2, alt: 'Wedding venue decor', span: 'row-span-1' },
  { src: gallery3, alt: 'Wedding details', span: 'row-span-1' },
];

export const GalleryPreview = () => {
  return (
    <section className="py-24 md:py-32 bg-card">
      <div className="container mx-auto px-6">
        <SectionHeading
          subtitle="Portfolio"
          title="Our Latest Work"
          description="A glimpse into the beautiful moments we've had the privilege to capture."
        />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {galleryImages.map((image, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative overflow-hidden rounded-lg group cursor-pointer ${
                index === 0 ? 'md:row-span-2' : ''
              }`}
            >
              <div className="aspect-[4/5] md:h-full">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute inset-0 flex items-end p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <span className="font-serif text-xl text-foreground">{image.alt}</span>
              </div>
            </motion.div>
          ))}
        </div>

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
