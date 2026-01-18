import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Camera, Video, Heart, Star } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { FloatingParticles } from '@/components/ui/FloatingParticles';

const services = [
  {
    icon: Camera,
    title: 'Wedding Photography',
    description: 'Full-day coverage capturing every precious moment from preparation to reception.',
    features: ['Unlimited Photos', 'Professional Editing', 'Online Gallery'],
  },
  {
    icon: Video,
    title: 'Cinematic Films',
    description: 'Hollywood-style wedding films that tell your unique love story.',
    features: ['4K Quality', 'Drone Footage', 'Same-Day Edit'],
  },
  {
    icon: Heart,
    title: 'Pre-Wedding Shoots',
    description: 'Romantic portrait sessions at stunning locations of your choice.',
    features: ['Location Scouting', 'Outfit Changes', 'Digital Album'],
  },
  {
    icon: Star,
    title: 'Event Coverage',
    description: 'Professional photography for engagements, receptions, and special celebrations.',
    features: ['Flexible Hours', 'Quick Delivery', 'Print Options'],
  },
];

export const ServicesSection = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 60, rotateX: -10 },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        duration: 0.8,
        ease: [0.25, 0.1, 0.25, 1] as const,
      },
    },
  };

  const iconVariants = {
    hidden: { scale: 0, rotate: -180 },
    visible: {
      scale: 1,
      rotate: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 200,
        damping: 15,
        delay: 0.2,
      },
    },
  };

  return (
    <section className="relative py-24 md:py-32 bg-background overflow-hidden">
      <FloatingParticles count={15} />
      
      <div className="container mx-auto px-6 relative z-10">
        <SectionHeading
          subtitle="Our Services"
          title="Crafting Visual Stories"
          description="From intimate ceremonies to grand celebrations, we offer comprehensive photography and videography services tailored to your vision."
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 perspective-1000"
        >
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              variants={cardVariants}
              className="group"
              whileHover={{ 
                y: -12, 
                rotateY: 5,
                transition: { duration: 0.4, ease: 'easeOut' } 
              }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              <div className="h-full p-8 bg-card border border-border rounded-lg hover:border-primary/40 transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 relative overflow-hidden">
                {/* Shimmer effect on hover */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                />
                
                <motion.div
                  variants={iconVariants}
                  className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors duration-300 relative"
                  whileHover={{ scale: 1.15, rotate: 10 }}
                  transition={{ duration: 0.3 }}
                >
                  <service.icon className="w-6 h-6 text-primary" />
                  {/* Glow ring */}
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary/30"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                  />
                </motion.div>
                
                <h3 className="font-serif text-2xl mb-3 text-foreground">{service.title}</h3>
                <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-6">
                  {service.description}
                </p>
                <ul className="space-y-2">
                  {service.features.map((feature, featureIndex) => (
                    <motion.li 
                      key={feature} 
                      className="flex items-center gap-2 font-sans text-sm text-foreground/70"
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + featureIndex * 0.1 }}
                    >
                      <motion.span 
                        className="w-1.5 h-1.5 rounded-full bg-primary"
                        animate={{ scale: [1, 1.5, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: featureIndex * 0.3 }}
                      />
                      {feature}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-12 text-center"
        >
          <Link to="/services" className="btn-luxury">
            View All Services
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
