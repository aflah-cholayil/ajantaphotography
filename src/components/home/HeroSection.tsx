import { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronDown, Play, Sparkles } from 'lucide-react';
import heroImage from '@/assets/hero-wedding.jpg';
import { FloatingParticles } from '@/components/ui/FloatingParticles';

export const HeroSection = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);
  const textY = useTransform(scrollYProgress, [0, 0.5], ['0%', '20%']);

  // Stagger animation for text
  const letterVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.4 + i * 0.03,
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1] as const,
      },
    }),
  };

  const titleText = "Capturing";
  const highlightText = "Timeless";
  const endText = "Moments";

  return (
    <section ref={containerRef} className="relative h-screen overflow-hidden">
      {/* Parallax Background */}
      <motion.div 
        className="absolute inset-0 -z-10"
        style={{ y, scale }}
      >
        <img
          src={heroImage}
          alt="Wedding couple at sunset"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/50 to-background" />
      </motion.div>

      {/* Floating particles */}
      <FloatingParticles count={25} className="z-0" />

      {/* Decorative sparkles */}
      <motion.div
        className="absolute top-32 left-16 opacity-40 hidden md:block"
        animate={{ rotate: 360 }}
        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
      >
        <Sparkles className="w-8 h-8 text-primary" />
      </motion.div>
      <motion.div
        className="absolute top-48 right-24 opacity-30 hidden md:block"
        animate={{ rotate: -360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <Sparkles className="w-6 h-6 text-primary" />
      </motion.div>

      {/* Content */}
      <motion.div
        style={{ opacity, y: textY }}
        className="relative h-full flex flex-col items-center justify-center text-center px-6 z-10"
      >
        <motion.span
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-primary font-sans text-sm uppercase tracking-[0.4em] mb-6"
        >
          Premium Wedding Photography
        </motion.span>

        <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-light leading-[1.1] max-w-5xl overflow-hidden">
          <span className="inline-block">
            {titleText.split('').map((char, i) => (
              <motion.span
                key={i}
                custom={i}
                variants={letterVariants}
                initial="hidden"
                animate="visible"
                className="inline-block text-foreground"
              >
                {char}
              </motion.span>
            ))}
          </span>{' '}
          <span className="inline-block">
            {highlightText.split('').map((char, i) => (
              <motion.span
                key={i}
                custom={i + titleText.length}
                variants={letterVariants}
                initial="hidden"
                animate="visible"
                className="inline-block text-gradient-gold"
              >
                {char}
              </motion.span>
            ))}
          </span>
          <br />
          <span className="inline-block">
            {endText.split('').map((char, i) => (
              <motion.span
                key={i}
                custom={i + titleText.length + highlightText.length}
                variants={letterVariants}
                initial="hidden"
                animate="visible"
                className="inline-block text-foreground"
              >
                {char}
              </motion.span>
            ))}
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="mt-8 font-sans text-lg md:text-xl text-foreground/70 max-w-2xl leading-relaxed"
        >
          Every love story deserves to be told with artistry and elegance. 
          We create cinematic memories that last forever.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.1 }}
          className="mt-12 flex flex-col sm:flex-row gap-4"
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Link to="/booking" className="btn-gold">
              Book Your Session
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
            <Link to="/gallery" className="btn-luxury flex items-center gap-2">
              <Play size={16} />
              View Portfolio
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.4 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
        >
          <motion.div
            className="flex flex-col items-center gap-2 cursor-pointer"
            onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
            whileHover={{ scale: 1.1 }}
          >
            <motion.span 
              className="text-xs uppercase tracking-[0.2em] text-foreground/50 font-sans"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              Scroll
            </motion.span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronDown size={24} className="text-primary" />
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
};
