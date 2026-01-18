import { Layout } from '@/components/layout/Layout';
import { HeroSection } from '@/components/home/HeroSection';
import { ServicesSection } from '@/components/home/ServicesSection';
import { GalleryPreview } from '@/components/home/GalleryPreview';
import { CinematicVideoSection } from '@/components/home/CinematicVideoSection';
import { AboutPreview } from '@/components/home/AboutPreview';
import { TestimonialsSection } from '@/components/home/TestimonialsSection';
import { CTASection } from '@/components/home/CTASection';

const Index = () => {
  return (
    <Layout>
      <HeroSection />
      <ServicesSection />
      <GalleryPreview />
      <CinematicVideoSection />
      <AboutPreview />
      <TestimonialsSection />
      <CTASection />
    </Layout>
  );
};

export default Index;
