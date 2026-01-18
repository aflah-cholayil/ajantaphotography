import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import photographerImage from '@/assets/photographer.jpg';

export const AboutPreview = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const imageScale = useTransform(scrollYProgress, [0, 0.5], [1, 1.08]);
  const imageOpacity = useTransform(scrollYProgress, [0, 0.2], [0.8, 1]);

  return (
    <section ref={sectionRef} className="py-24 md:py-32 bg-background overflow-hidden">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative aspect-[3/4] rounded-lg overflow-hidden">
              <motion.img
                src={photographerImage}
                alt="Lead photographer"
                className="w-full h-full object-cover"
                style={{ scale: imageScale, opacity: imageOpacity }}
              />
            </div>
            {/* Decorative Frame */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="absolute -top-4 -left-4 w-32 h-32 border-l-2 border-t-2 border-primary/30"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="absolute -bottom-4 -right-4 w-32 h-32 border-r-2 border-b-2 border-primary/30"
            />

            {/* Stats Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="absolute -bottom-6 -right-6 lg:-right-12 glass p-6 rounded-lg"
            >
              <div className="flex gap-8">
                <div className="text-center">
                  <span className="block font-serif text-4xl text-primary">10+</span>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-sans">
                    Years
                  </span>
                </div>
                <div className="text-center">
                  <span className="block font-serif text-4xl text-primary">500+</span>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-sans">
                    Weddings
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <SectionHeading
              subtitle="About Us"
              title="The Art of Storytelling"
              align="left"
            />
            <div className="mt-8 space-y-6 font-sans text-muted-foreground leading-relaxed">
              <p>
                At Ajanta Photography, we believe every love story is unique and deserves 
                to be captured with artistry, emotion, and timeless elegance. Our approach 
                combines photojournalistic authenticity with cinematic beauty.
              </p>
              <p>
                With over a decade of experience, we've had the honor of documenting 
                hundreds of weddings across stunning venues. Our passion lies in 
                creating images that transport you back to those precious moments.
              </p>
              <p>
                We don't just take photographs—we create heirlooms that tell the 
                beautiful narrative of your most cherished day.
              </p>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-8 flex flex-col sm:flex-row gap-4"
            >
              <a href="/about" className="btn-luxury">
                Learn More
              </a>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
