import { Link } from 'react-router-dom';
import { Instagram, Facebook, Mail, Phone, MapPin, MessageCircle } from 'lucide-react';
import { useStudioSettings } from '@/hooks/useStudioSettings';
import { Logo } from '@/components/shared/Logo';

const quickLinks = [
  { name: 'About Us', path: '/about' },
  { name: 'Services', path: '/services' },
  { name: 'Gallery', path: '/gallery' },
  { name: 'Contact', path: '/contact' },
];

export const Footer = () => {
  const { settings, identity, formatPhoneLink, formatWhatsAppLink, getPhoneArray } = useStudioSettings();
  const phones = getPhoneArray();

  const socialLinks = [
    { icon: Instagram, href: settings.instagram_url, label: 'Instagram' },
    { icon: Facebook, href: settings.facebook_url, label: 'Facebook' },
    { icon: MessageCircle, href: formatWhatsAppLink('Hello! I would like to inquire about your photography services.'), label: 'WhatsApp' },
  ];

  return (
    <footer className="bg-card border-t border-border">
      <div className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="mb-6">
              <Logo variant="large" linkTo="/" />
            </div>
            <p className="text-muted-foreground font-sans text-sm leading-relaxed mb-6">
              {identity.tagline}. {identity.description}.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all duration-300"
                >
                  <social.icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-serif text-xl mb-6 text-foreground">Quick Links</h4>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="font-sans text-sm text-muted-foreground hover:text-primary transition-colors duration-300"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-serif text-xl mb-6 text-foreground">Services</h4>
            <ul className="space-y-3 font-sans text-sm text-muted-foreground">
              <li>Wedding Photography</li>
              <li>Pre-Wedding Shoots</li>
              <li>Event Coverage</li>
              <li>Portrait Sessions</li>
              <li>Cinematic Films</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-serif text-xl mb-6 text-foreground">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin size={18} className="text-primary mt-1 flex-shrink-0" />
                <a 
                  href={settings.google_maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {settings.address_line1}<br />
                  {settings.address_line2} – {settings.pincode}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <Phone size={18} className="text-primary flex-shrink-0 mt-0.5" />
                <div className="font-sans text-sm text-muted-foreground">
                  {phones.map((phone, index) => (
                    <a 
                      key={index}
                      href={formatPhoneLink(phone)} 
                      className="block hover:text-primary transition-colors"
                    >
                      {phone}
                    </a>
                  ))}
                </div>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} className="text-primary flex-shrink-0" />
                <a 
                  href={`mailto:${settings.email}`} 
                  className="font-sans text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {settings.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-sans text-sm text-muted-foreground">
            © {new Date().getFullYear()} {identity.name}. All rights reserved.
          </p>
          <div className="flex gap-6 font-sans text-sm text-muted-foreground">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms-of-service" className="hover:text-primary transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
