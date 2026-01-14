import { motion } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Link } from 'react-router-dom';
import { Camera, Video, Heart, Star, Users, Clock, Check } from 'lucide-react';

const services = [
  {
    icon: Camera,
    title: 'Wedding Photography',
    description:
      'Full-day coverage capturing every precious moment from bridal preparation to reception.',
    features: [
      'Unlimited high-resolution photos',
      'Professional post-processing',
      'Online private gallery',
      'Print-ready files',
      'Same-day sneak peeks',
      'Second photographer option',
    ],
    price: 'From $3,500',
  },
  {
    icon: Video,
    title: 'Cinematic Films',
    description:
      'Hollywood-style wedding films that tell your unique love story with emotion and artistry.',
    features: [
      '4K Ultra HD quality',
      'Highlight reel (5-8 min)',
      'Full ceremony edit',
      'Drone aerial footage',
      'Same-day edit option',
      'Raw footage included',
    ],
    price: 'From $4,500',
  },
  {
    icon: Heart,
    title: 'Pre-Wedding Shoots',
    description:
      'Romantic portrait sessions at stunning locations of your choice before the big day.',
    features: [
      '2-3 hour session',
      'Multiple outfit changes',
      '100+ edited photos',
      'Location scouting',
      'Professional styling tips',
      'Digital album included',
    ],
    price: 'From $1,200',
  },
  {
    icon: Star,
    title: 'Engagement Sessions',
    description:
      'Celebrate your engagement with a beautiful photo session to announce your love.',
    features: [
      '1-2 hour session',
      'One location',
      '50+ edited photos',
      'Save-the-date images',
      'Social media optimized',
      'Quick turnaround',
    ],
    price: 'From $800',
  },
  {
    icon: Users,
    title: 'Event Coverage',
    description:
      'Professional photography for corporate events, parties, and special celebrations.',
    features: [
      'Flexible hour packages',
      'On-site editing available',
      'Quick delivery',
      'Print options',
      'Group shots',
      'Candid coverage',
    ],
    price: 'From $500/hr',
  },
  {
    icon: Clock,
    title: 'Elopement Packages',
    description:
      'Intimate coverage for smaller ceremonies and destination elopements.',
    features: [
      '4 hours of coverage',
      'High-resolution photos',
      'Scenic location shoots',
      'Adventure photography',
      'Quick turnaround',
      'Travel available',
    ],
    price: 'From $2,000',
  },
];

const Services = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-32 pb-16 bg-card">
        <div className="container mx-auto px-6">
          <SectionHeading
            subtitle="What We Offer"
            title="Our Services"
            description="Comprehensive photography and videography services tailored to capture your most precious moments."
          />
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service, index) => (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group"
              >
                <div className="h-full p-8 bg-card border border-border rounded-lg hover:border-primary/30 transition-all duration-500">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <service.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-serif text-2xl text-foreground mb-3">{service.title}</h3>
                  <p className="font-sans text-sm text-muted-foreground mb-6">
                    {service.description}
                  </p>
                  <ul className="space-y-2 mb-6">
                    {service.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 font-sans text-sm text-foreground/70">
                        <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="pt-4 border-t border-border">
                    <span className="font-serif text-2xl text-primary">{service.price}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Custom Packages */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl mx-auto"
          >
            <span className="text-primary font-sans text-sm uppercase tracking-[0.25em] mb-4 block">
              Custom Solutions
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground mb-6">
              Need Something Different?
            </h2>
            <p className="font-sans text-muted-foreground mb-8">
              Every event is unique. Contact us to discuss a custom package tailored 
              specifically to your needs and vision.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/booking" className="btn-gold">
                Get a Quote
              </Link>
              <Link to="/contact" className="btn-luxury">
                Contact Us
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default Services;
