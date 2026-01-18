import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { SectionHeading } from '@/components/ui/SectionHeading';

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
  return (
    <section className="py-24 md:py-32 bg-card">
      <div className="container mx-auto px-6">
        <SectionHeading
          subtitle="Testimonials"
          title="Love Stories Shared"
          description="Words from couples whose moments we have had the honor to capture."
        />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className="relative"
            >
              <div className="h-full p-8 bg-background border border-border rounded-lg">
                <Quote className="w-10 h-10 text-primary/30 mb-6" />
                <p className="font-sans text-foreground/80 leading-relaxed mb-6">
                  &ldquo;{testimonial.content}&rdquo;
                </p>
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <div>
                  <span className="block font-serif text-xl text-foreground">
                    {testimonial.name}
                  </span>
                  <span className="font-sans text-sm text-muted-foreground">
                    {testimonial.event}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
