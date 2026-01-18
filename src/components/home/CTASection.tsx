import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useRef, lazy, Suspense } from 'react';

const GoldenRing = lazy(() => import('@/components/3d/GoldenRing').then(m => ({ default: m.GoldenRing })));

export const CTASection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative py-32 md:py-40 overflow-hidden"
    >
      {/* Background Gradient with parallax */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-background"
        style={{ y: backgroundY }}
      />
      <div className="absolute inset-0">
        <motion.div 
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      
      {/* Decorative sparkles */}
      <motion.div
        className="absolute top-20 right-20 opacity-30 hidden md:block"
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <Sparkles className="w-12 h-12 text-primary" />
      </motion.div>
      <motion.div
        className="absolute bottom-32 left-16 opacity-20 hidden md:block"
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      >
        <Sparkles className="w-8 h-8 text-primary" />
      </motion.div>

      {/* 3D Ring Element */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-80 h-80 opacity-30 hidden lg:block">
        <Suspense fallback={null}>
          <GoldenRing />
        </Suspense>
      </div>

      <motion.div style={{ opacity }} className="relative container mx-auto px-6 text-center">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="inline-block text-primary font-sans text-sm uppercase tracking-[0.25em] mb-6"
        >
          Ready to Begin?
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="font-serif text-4xl md:text-5xl lg:text-6xl font-light max-w-4xl mx-auto leading-tight"
        >
          Let's Create Something{' '}
          <span className="text-gradient-gold">Beautiful</span> Together
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-6 font-sans text-lg text-muted-foreground max-w-2xl mx-auto"
        >
          Your love story deserves to be captured by artists who care. 
          Book your consultation today and let's discuss your vision.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Link to="/booking" className="btn-gold group inline-flex items-center gap-2">
              Book Consultation
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Link to="/contact" className="btn-luxury">
              Get in Touch
            </Link>
          </motion.div>
        </motion.div>

        {/* Trust indicators */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 flex flex-wrap justify-center gap-8 text-muted-foreground font-sans text-sm"
        >
          {['500+ Weddings', 'Award Winning', '10+ Years'].map((stat, index) => (
            <motion.div
              key={stat}
              className="flex items-center gap-2"
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 + index * 0.1, type: 'spring' as const, stiffness: 200 }}
            >
              <motion.span
                className="w-2 h-2 rounded-full bg-primary"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
              />
              {stat}
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
};
