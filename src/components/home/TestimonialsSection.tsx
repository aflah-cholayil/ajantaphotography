import { motion } from 'framer-motion';
import { Star, Quote, Sparkles } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { FloatingParticles } from '@/components/ui/FloatingParticles';

const testimonials = [
  {
    name: 'Sarah & Michael',
    event: 'Summer Wedding 2024',
    content:
      'Ajanta captured our wedding with such artistry and emotion. Every photo tells a story, and we could not be happier with the results. They truly understood our vision.',
    rating: 5,
  },
  {
    name: 'Emily & James',
    event: 'Beach Wedding 2024',
    content:
      'The team was incredibly professional and made us feel so comfortable. The cinematic film they created brought tears to our eyes. Absolutely stunning work!',
    rating: 5,
  },
  {
    name: 'Priya & Raj',
    event: 'Traditional Wedding 2023',
    content:
      'They captured the essence of our multicultural celebration beautifully. The attention to detail and ability to blend into the ceremony was remarkable.',
    rating: 5,
  },
];

export const TestimonialsSection = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.7,
        ease: [0.25, 0.1, 0.25, 1] as const,
      },
    },
  };

  return (
    <section className="relative py-24 md:py-32 bg-card overflow-hidden">
      <FloatingParticles count={12} />
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-10 opacity-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        >
          <Sparkles className="w-16 h-16 text-primary" />
        </motion.div>
      </div>
      <div className="absolute bottom-20 right-10 opacity-20">
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        >
          <Sparkles className="w-12 h-12 text-primary" />
        </motion.div>
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <SectionHeading
          subtitle="Testimonials"
          title="Love Stories Shared"
          description="Words from couples whose moments we have had the honor to capture."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              variants={cardVariants}
              className="relative group"
              whileHover={{ 
                y: -8, 
                scale: 1.02,
                transition: { duration: 0.3 } 
              }}
            >
              <div className="h-full p-8 bg-background border border-border rounded-lg relative overflow-hidden transition-all duration-500 group-hover:border-primary/30 group-hover:shadow-lg group-hover:shadow-primary/5">
                {/* Animated gradient background */}
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.08) 0%, transparent 70%)',
                  }}
                />
                
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  whileInView={{ scale: 1, rotate: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + index * 0.1, type: 'spring', stiffness: 200 }}
                >
                  <Quote className="w-10 h-10 text-primary/30 mb-6" />
                </motion.div>
                
                <p className="font-sans text-foreground/80 leading-relaxed mb-6 relative z-10">
                  &ldquo;{testimonial.content}&rdquo;
                </p>
                
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.5 + i * 0.1, type: 'spring', stiffness: 300 }}
                    >
                      <Star className="w-4 h-4 fill-primary text-primary" />
                    </motion.div>
                  ))}
                </div>
                
                <div className="relative z-10">
                  <motion.span 
                    className="block font-serif text-xl text-foreground"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 }}
                  >
                    {testimonial.name}
                  </motion.span>
                  <motion.span 
                    className="font-sans text-sm text-muted-foreground"
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.7 }}
                  >
                    {testimonial.event}
                  </motion.span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
