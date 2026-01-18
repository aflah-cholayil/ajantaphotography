import { motion } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Phone, MapPin, Send, MessageCircle, Instagram, Clock } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useStudioSettings } from '@/hooks/useStudioSettings';
import { studioConfig } from '@/config/studio';
import { supabase } from '@/integrations/supabase/client';

const Contact = () => {
  const { toast } = useToast();
  const { settings, formatPhoneLink, formatWhatsAppLink, getPhoneArray } = useStudioSettings();
  const phones = getPhoneArray();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  // Honeypot field - bots will fill this, humans won't see it
  const [honeypot, setHoneypot] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Honeypot check - if filled, it's a bot
    if (honeypot) {
      // Silently "succeed" to not alert the bot
      toast({
        title: 'Message Sent!',
        description: 'We will get back to you soon.',
      });
      setFormData({ name: '', email: '', subject: '', message: '' });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from('contact_messages').insert({
        name: formData.name,
        email: formData.email,
        subject: formData.subject || null,
        message: formData.message,
      });

      if (error) throw error;

      // Send email notifications (don't block on this)
      const emailData = {
        name: formData.name,
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
      };

      // Send confirmation to customer
      supabase.functions.invoke('send-email', {
        body: { type: 'contact_confirmation', to: formData.email, data: emailData }
      }).catch(err => console.error('Failed to send customer email:', err));

      // Notify admin
      supabase.functions.invoke('send-email', {
        body: { type: 'contact_admin', to: '', data: emailData }
      }).catch(err => console.error('Failed to send admin email:', err));

      toast({
        title: 'Message Sent!',
        description: 'We will get back to you soon.',
      });
      
      // Reset form
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      console.error('Contact form error:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-32 pb-16 bg-card">
        <div className="container mx-auto px-6">
          <SectionHeading
            subtitle="Get in Touch"
            title="We Would Love to Hear From You"
            description="Have questions or ready to book? Reach out and let us start the conversation."
          />
        </div>
      </section>

      {/* Contact Content */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div>
                <h3 className="font-serif text-3xl font-light text-foreground mb-6">
                  Contact Information
                </h3>
                <p className="font-sans text-muted-foreground leading-relaxed">
                  Whether you have a question about our services, want to discuss your upcoming 
                  event, or just want to say hello, we are here to help.
                </p>
              </div>

              <div className="space-y-6">
                {/* Phone Numbers */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-sans font-medium text-foreground mb-1">Phone</h4>
                    <div className="space-y-1">
                      {phones.map((phone, index) => (
                        <a 
                          key={index}
                          href={formatPhoneLink(phone)} 
                          className="block font-sans text-muted-foreground hover:text-primary transition-colors"
                        >
                          {phone}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-sans font-medium text-foreground mb-1">WhatsApp</h4>
                    <a 
                      href={formatWhatsAppLink('Hello! I would like to inquire about your photography services.')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-sans text-muted-foreground hover:text-green-500 transition-colors"
                    >
                      {settings.whatsapp}
                    </a>
                    <a 
                      href={formatWhatsAppLink('Hello! I would like to inquire about your photography services.')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full text-sm font-medium hover:bg-green-600 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Chat on WhatsApp
                    </a>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-sans font-medium text-foreground mb-1">Email</h4>
                    <a 
                      href={`mailto:${settings.email}`} 
                      className="font-sans text-muted-foreground hover:text-primary transition-colors"
                    >
                      {settings.email}
                    </a>
                  </div>
                </div>

                {/* Instagram */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                    <Instagram className="w-5 h-5 text-pink-500" />
                  </div>
                  <div>
                    <h4 className="font-sans font-medium text-foreground mb-1">Instagram</h4>
                    <a 
                      href={settings.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-sans text-muted-foreground hover:text-pink-500 transition-colors"
                    >
                      {settings.instagram}
                    </a>
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-sans font-medium text-foreground mb-1">Studio</h4>
                    <a 
                      href={settings.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-sans text-muted-foreground hover:text-primary transition-colors"
                    >
                      {settings.address_line1}<br />
                      {settings.address_line2} – {settings.pincode}
                    </a>
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-border">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-sans font-medium text-foreground mb-2">Studio Hours</h4>
                    <div className="font-sans text-sm text-muted-foreground space-y-1">
                      <p>Monday - Friday: {settings.hours_weekdays}</p>
                      <p>Saturday: {settings.hours_saturday}</p>
                      <p>Sunday: {settings.hours_sunday}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Google Maps Embed */}
              <div className="rounded-lg overflow-hidden border border-border">
                <iframe
                  src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3915.0!2d${studioConfig.address.coordinates.lng}!3d${studioConfig.address.coordinates.lat}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMTHCsDI5JzAwLjAiTiA3NsKwMzknMDAuMCJF!5e0!3m2!1sen!2sin!4v1234567890`}
                  width="100%"
                  height="200"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Ajanta Photography Location"
                />
              </div>
            </motion.div>

            {/* Contact Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="glass p-8 rounded-lg"
            >
              <h3 className="font-serif text-2xl font-light text-foreground mb-6">
                Send a Message
              </h3>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Honeypot field - hidden from users, bots will fill it */}
                <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
                  <label htmlFor="company">Company</label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground font-sans">
                      Name
                    </Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="bg-background/50 border-border focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground font-sans">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="bg-background/50 border-border focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-foreground font-sans">
                    Subject
                  </Label>
                  <Input
                    id="subject"
                    placeholder="What is this about?"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className="bg-background/50 border-border focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-foreground font-sans">
                    Message
                  </Label>
                  <Textarea
                    id="message"
                    placeholder="Your message..."
                    rows={5}
                    required
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    className="bg-background/50 border-border focus:border-primary resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn-gold"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                  <Send className="ml-2 w-4 h-4" />
                </Button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Contact;
