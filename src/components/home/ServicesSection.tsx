import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Camera, Video, Heart, Star } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';

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
  return (
    <section className="py-24 md:py-32 bg-background">
      <div className="container mx-auto px-6">
        <SectionHeading
          subtitle="Our Services"
          title="Crafting Visual Stories"
          description="From intimate ceremonies to grand celebrations, we offer comprehensive photography and videography services tailored to your vision."
        />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group"
            >
              <div className="h-full p-8 bg-card border border-border rounded-lg hover:border-primary/30 transition-all duration-500 hover:shadow-lg hover:shadow-primary/5">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors duration-300">
                  <service.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-serif text-2xl mb-3 text-foreground">{service.title}</h3>
                <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-6">
                  {service.description}
                </p>
                <ul className="space-y-2">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 font-sans text-sm text-foreground/70">
                      <span className="w-1 h-1 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
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
          <Link to="/services" className="btn-luxury">
            View All Services
          </Link>
        </motion.div>
      </div>
    </section>
  );
};
