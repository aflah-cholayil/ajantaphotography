import { motion } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Link } from 'react-router-dom';
import { Camera, Award, Users, Heart } from 'lucide-react';
import photographerImage from '@/assets/photographer.jpg';

const stats = [
  { icon: Camera, value: '10+', label: 'Years Experience' },
  { icon: Award, value: '50+', label: 'Awards Won' },
  { icon: Users, value: '500+', label: 'Happy Couples' },
  { icon: Heart, value: '1M+', label: 'Photos Delivered' },
];

const About = () => {
  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-32 pb-16 bg-card">
        <div className="container mx-auto px-6">
          <SectionHeading
            subtitle="Our Story"
            title="Passion for Perfection"
            description="Founded with a vision to capture love stories in their most authentic form."
          />
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="aspect-[4/5] rounded-lg overflow-hidden">
                <img
                  src={photographerImage}
                  alt="Lead Photographer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -top-4 -left-4 w-24 h-24 border-l-2 border-t-2 border-primary/30" />
              <div className="absolute -bottom-4 -right-4 w-24 h-24 border-r-2 border-b-2 border-primary/30" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <span className="text-primary font-sans text-sm uppercase tracking-[0.25em] mb-4 block">
                The Beginning
              </span>
              <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground mb-6">
                A Decade of Capturing Dreams
              </h2>
              <div className="space-y-4 font-sans text-muted-foreground leading-relaxed">
                <p>
                  Ajanta Photography was born from a simple belief: every love story deserves 
                  to be told with artistry, emotion, and timeless elegance. What started as 
                  a passion project has grown into a premier photography studio.
                </p>
                <p>
                  Our founder discovered a profound calling in wedding photography, that 
                  magical ability to freeze fleeting moments of joy, tears, and celebration 
                  into eternal memories.
                </p>
                <p>
                  Today, our team of talented photographers and filmmakers continues this 
                  legacy, approaching each wedding with fresh eyes and genuine enthusiasm 
                  for the unique story unfolding before us.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="text-center"
              >
                <stat.icon className="w-8 h-8 text-primary mx-auto mb-4" />
                <span className="block font-serif text-4xl md:text-5xl text-foreground mb-2">
                  {stat.value}
                </span>
                <span className="font-sans text-sm text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center">
            <SectionHeading
              subtitle="Our Philosophy"
              title="More Than Just Photos"
              description="We believe in capturing the essence of your celebration, not just the moments."
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-8 space-y-4 font-sans text-muted-foreground leading-relaxed"
            >
              <p>
                We approach each wedding as a unique story waiting to be told. Our style 
                blends documentary authenticity with artistic vision, creating images that 
                are both timeless and deeply personal.
              </p>
              <p>
                From the nervous excitement of getting ready to the joyous celebrations on 
                the dance floor, we are there to capture it all. But more importantly, we 
                capture the feelings, the connections, and the love that makes your day unique.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-card">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-serif text-4xl md:text-5xl font-light text-foreground mb-6">
              Ready to Work Together?
            </h2>
            <p className="font-sans text-muted-foreground mb-8 max-w-xl mx-auto">
              Let us be part of your special day and create memories that will last a lifetime.
            </p>
            <Link to="/booking" className="btn-gold">
              Book Your Session
            </Link>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
};

export default About;
