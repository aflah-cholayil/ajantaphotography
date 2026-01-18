import { Layout } from '@/components/layout/Layout';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { FileText, Camera, Users, Image, CreditCard, AlertTriangle, RefreshCw, Mail } from 'lucide-react';

const TermsOfService = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative py-24 md:py-32 bg-card">
          <div className="container mx-auto px-6">
            <ScrollReveal animation="fadeUp">
              <div className="max-w-3xl mx-auto text-center">
                <FileText className="w-12 h-12 text-primary mx-auto mb-6" />
                <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-foreground mb-6">
                  Terms of Service
                </h1>
                <p className="text-muted-foreground text-lg">
                  Effective Date: January 2026
                </p>
              </div>
            </ScrollReveal>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-6">
            <div className="max-w-3xl mx-auto">
              <ScrollReveal animation="fadeUp">
                <p className="text-foreground text-lg leading-relaxed mb-12">
                  By using Ajanta Photography's website and services, you agree to the following terms.
                </p>
              </ScrollReveal>

              {/* Services */}
              <ScrollReveal animation="fadeUp" delay={0.1}>
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <Camera className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl md:text-3xl text-foreground">
                      Services
                    </h2>
                  </div>
                  <p className="text-muted-foreground ml-9">
                    Ajanta Photography provides professional photography and videography services for weddings and events.
                  </p>
                </div>
              </ScrollReveal>

              {/* Client Responsibilities */}
              <ScrollReveal animation="fadeUp" delay={0.15}>
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl md:text-3xl text-foreground">
                      Client Responsibilities
                    </h2>
                  </div>
                  <ul className="space-y-3 text-muted-foreground ml-9">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Provide accurate booking details</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Safeguard login credentials</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Do not share private gallery access publicly unless intended</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              {/* Gallery Access */}
              <ScrollReveal animation="fadeUp" delay={0.2}>
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <Image className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl md:text-3xl text-foreground">
                      Gallery Access
                    </h2>
                  </div>
                  <ul className="space-y-3 text-muted-foreground ml-9">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Galleries are delivered digitally</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Download access may be time-limited</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Shared links are client-controlled</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              {/* Intellectual Property */}
              <ScrollReveal animation="fadeUp" delay={0.25}>
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <Camera className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl md:text-3xl text-foreground">
                      Intellectual Property
                    </h2>
                  </div>
                  <ul className="space-y-3 text-muted-foreground ml-9">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>All photos and videos remain the property of Ajanta Photography unless agreed otherwise</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Clients receive usage rights for personal use</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              {/* Payments & Bookings */}
              <ScrollReveal animation="fadeUp" delay={0.3}>
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <CreditCard className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl md:text-3xl text-foreground">
                      Payments & Bookings
                    </h2>
                  </div>
                  <ul className="space-y-3 text-muted-foreground ml-9">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Booking requests are subject to confirmation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Ajanta Photography reserves the right to decline bookings</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              {/* Limitation of Liability */}
              <ScrollReveal animation="fadeUp" delay={0.35}>
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl md:text-3xl text-foreground">
                      Limitation of Liability
                    </h2>
                  </div>
                  <p className="text-muted-foreground ml-9 mb-4">
                    Ajanta Photography is not responsible for issues caused by:
                  </p>
                  <ul className="space-y-3 text-muted-foreground ml-9">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Internet failures</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Third-party service outages</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Unauthorized access via shared links</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              {/* Modifications */}
              <ScrollReveal animation="fadeUp" delay={0.4}>
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <RefreshCw className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl md:text-3xl text-foreground">
                      Modifications
                    </h2>
                  </div>
                  <p className="text-muted-foreground ml-9">
                    We may update these terms at any time. Continued use means acceptance of updated terms.
                  </p>
                </div>
              </ScrollReveal>

              {/* Contact */}
              <ScrollReveal animation="fadeUp" delay={0.45}>
                <div className="p-6 bg-card rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <Mail className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl text-foreground">
                      Contact
                    </h2>
                  </div>
                  <p className="text-muted-foreground">
                    For any questions regarding these terms, please contact us at{' '}
                    <a 
                      href="mailto:ajantastudiopandalur@gmail.com" 
                      className="text-primary hover:underline"
                    >
                      ajantastudiopandalur@gmail.com
                    </a>
                  </p>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default TermsOfService;
