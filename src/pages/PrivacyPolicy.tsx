import { Layout } from '@/components/layout/Layout';
import { ScrollReveal } from '@/components/ui/ScrollReveal';
import { Shield, Lock, Eye, Mail, Database, Users } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="relative py-24 md:py-32 bg-card">
          <div className="container mx-auto px-6">
            <ScrollReveal animation="fadeUp">
              <div className="max-w-3xl mx-auto text-center">
                <Shield className="w-12 h-12 text-primary mx-auto mb-6" />
                <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light text-foreground mb-6">
                  Privacy Policy
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
                  Ajanta Photography respects your privacy and is committed to protecting your personal information. This policy outlines how we collect, use, and safeguard your data.
                </p>
              </ScrollReveal>

              {/* Information We Collect */}
              <ScrollReveal animation="fadeUp" delay={0.1}>
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <Database className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl md:text-3xl text-foreground">
                      Information We Collect
                    </h2>
                  </div>
                  <ul className="space-y-3 text-muted-foreground ml-9">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Name, email, phone number</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Event and booking details</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Login credentials for client galleries</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Uploaded photos and videos</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              {/* How We Use Your Information */}
              <ScrollReveal animation="fadeUp" delay={0.15}>
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl md:text-3xl text-foreground">
                      How We Use Your Information
                    </h2>
                  </div>
                  <ul className="space-y-3 text-muted-foreground ml-9">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>To provide photography services</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>To deliver client galleries</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>To respond to bookings and enquiries</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>To send important service-related emails</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              {/* Media & Galleries */}
              <ScrollReveal animation="fadeUp" delay={0.2}>
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <Eye className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl md:text-3xl text-foreground">
                      Media & Galleries
                    </h2>
                  </div>
                  <ul className="space-y-3 text-muted-foreground ml-9">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Client photos and videos are private by default</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Shared galleries are accessible only via secure links</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>We do not sell or share your media with third parties</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              {/* Data Security */}
              <ScrollReveal animation="fadeUp" delay={0.25}>
                <div className="mb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <Lock className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl md:text-3xl text-foreground">
                      Data Security
                    </h2>
                  </div>
                  <ul className="space-y-3 text-muted-foreground ml-9">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Secure authentication</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Encrypted storage</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Restricted admin access</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              {/* Third-Party Services */}
              <ScrollReveal animation="fadeUp" delay={0.3}>
                <div className="mb-12">
                  <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-4">
                    Third-Party Services
                  </h2>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Cloud storage (for media)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Email services (for notifications)</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              {/* Your Rights */}
              <ScrollReveal animation="fadeUp" delay={0.35}>
                <div className="mb-12">
                  <h2 className="font-serif text-2xl md:text-3xl text-foreground mb-4">
                    Your Rights
                  </h2>
                  <ul className="space-y-3 text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Request access to your data</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1.5">•</span>
                      <span>Request corrections or deletion</span>
                    </li>
                  </ul>
                </div>
              </ScrollReveal>

              {/* Contact */}
              <ScrollReveal animation="fadeUp" delay={0.4}>
                <div className="p-6 bg-card rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <Mail className="w-6 h-6 text-primary" />
                    <h2 className="font-serif text-2xl text-foreground">
                      Contact
                    </h2>
                  </div>
                  <p className="text-muted-foreground">
                    For any privacy-related inquiries, please contact us at{' '}
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

export default PrivacyPolicy;
