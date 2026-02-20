import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Link } from 'react-router-dom';
import { Check, MessageCircle } from 'lucide-react';
import {
  Camera, Video, Heart, Star, Users, Clock, Briefcase, Image, Film,
  Award, Zap, Sun, Moon, Sparkles, Gift, Globe, MapPin, Aperture,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Camera, Video, Heart, Star, Users, Clock, Briefcase, Image, Film,
  Award, Zap, Sun, Moon, Sparkles, Gift, Globe, MapPin, Aperture,
};

interface ServiceFeature {
  id: string;
  feature_text: string;
  display_order: number;
}

interface Service {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  icon_name: string;
  category: string;
  price: string | null;
  show_price: boolean;
  show_book_button: boolean;
  book_button_text: string;
  is_active: boolean;
  display_order: number;
  features?: ServiceFeature[];
}

const Services = () => {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchServices() {
      const { data: servicesData, error } = await supabase
        .from('services' as any)
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error || !servicesData) {
        setIsLoading(false);
        return;
      }

      // Fetch features for all services in one query
      const serviceIds = (servicesData as any[]).map(s => s.id);
      const { data: featuresData } = await supabase
        .from('service_features' as any)
        .select('*')
        .in('service_id', serviceIds)
        .order('display_order');

      const features = (featuresData as unknown as (ServiceFeature & { service_id: string })[]) || [];

      // Map features to services
      const withFeatures: Service[] = (servicesData as unknown as Service[]).map(service => ({
        ...service,
        features: features.filter(f => (f as any).service_id === service.id),
      }));

      setServices(withFeatures);
      setIsLoading(false);
    }

    fetchServices();
  }, []);

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
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-80 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No services available at the moment.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map((service, index) => {
                const IconComponent = ICON_MAP[service.icon_name] || Camera;
                return (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="group"
                  >
                    <div className="h-full p-8 bg-card border border-border rounded-lg hover:border-primary/30 transition-all duration-500 flex flex-col">
                      <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                        <IconComponent className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="font-serif text-2xl text-foreground mb-3">{service.title}</h3>
                      <p className="font-sans text-sm text-muted-foreground mb-6">
                        {service.short_description}
                      </p>

                      {service.features && service.features.length > 0 && (
                        <ul className="space-y-2 mb-6 flex-1">
                          {service.features.map((feature) => (
                            <li key={feature.id} className="flex items-start gap-2 font-sans text-sm text-foreground/70">
                              <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                              {feature.feature_text}
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Price / CTA Footer */}
                      <div className="pt-4 border-t border-border mt-auto space-y-3">
                        {service.show_price && service.price && (
                          <span className="font-serif text-2xl text-primary block">{service.price}</span>
                        )}

                        {service.show_book_button && (
                          <Link
                            to={`/booking?service=${service.slug}`}
                            className="btn-gold inline-block text-center w-full"
                          >
                            {service.book_button_text}
                          </Link>
                        )}

                        {!service.show_price && !service.show_book_button && (
                          <Link
                            to="/contact"
                            className="flex items-center gap-2 font-sans text-sm text-primary hover:text-primary/80 transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                            Contact for Pricing
                          </Link>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
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
