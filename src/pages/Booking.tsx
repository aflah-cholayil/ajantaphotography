import { useState } from 'react';
import { motion } from 'framer-motion';
import { Layout } from '@/components/layout/Layout';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
const eventTypes = [
  'Wedding',
  'Pre-Wedding Shoot',
  'Engagement',
  'Reception',
  'Birthday Party',
  'Corporate Event',
  'Other',
];

const Booking = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    eventType: '',
    eventDate: '',
    message: '',
  });
  // Honeypot field - bots will fill this, humans won't see it
  const [honeypot, setHoneypot] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Honeypot check - if filled, it's a bot
    if (honeypot) {
      // Silently "succeed" to not alert the bot
      setIsSubmitted(true);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from('bookings').insert({
        client_name: formData.name,
        client_email: formData.email,
        phone: formData.phone || null,
        event_type: formData.eventType,
        event_date: formData.eventDate || null,
        message: formData.message || null,
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: 'Booking Request Sent!',
        description: 'We will get back to you within 24 hours.',
      });
    } catch (error) {
      console.error('Booking submission error:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit booking. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isSubmitted) {
    return (
      <Layout>
        <section className="min-h-screen flex items-center justify-center px-6 py-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center max-w-md"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-primary" />
            </div>
            <h1 className="font-serif text-4xl font-light text-foreground mb-4">
              Thank You!
            </h1>
            <p className="font-sans text-muted-foreground mb-8">
              Your booking request has been submitted successfully. We will review your 
              details and get back to you within 24 hours to discuss your event.
            </p>
            <Button onClick={() => setIsSubmitted(false)} className="btn-luxury">
              Submit Another Request
            </Button>
          </motion.div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Hero */}
      <section className="relative pt-32 pb-16 bg-card">
        <div className="container mx-auto px-6">
          <SectionHeading
            subtitle="Book a Session"
            title="Start Your Journey"
            description="Tell us about your special day and let us create something beautiful together."
          />
        </div>
      </section>

      {/* Booking Form */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="glass p-8 md:p-12 rounded-lg"
            >
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Honeypot field - hidden from users, bots will fill it */}
                <div className="absolute -left-[9999px] opacity-0 h-0 overflow-hidden" aria-hidden="true">
                  <label htmlFor="website">Website</label>
                  <input
                    type="text"
                    id="website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground font-sans">
                      Full Name *
                    </Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      required
                      className="bg-background/50 border-border focus:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground font-sans">
                      Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      required
                      className="bg-background/50 border-border focus:border-primary"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-foreground font-sans">
                      Phone Number *
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (234) 567-890"
                      value={formData.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      required
                      className="bg-background/50 border-border focus:border-primary"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="eventType" className="text-foreground font-sans">
                      Event Type *
                    </Label>
                    <Select
                      value={formData.eventType}
                      onValueChange={(value) => handleChange('eventType', value)}
                      required
                    >
                      <SelectTrigger className="bg-background/50 border-border focus:border-primary">
                        <SelectValue placeholder="Select event type" />
                      </SelectTrigger>
                      <SelectContent>
                        {eventTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventDate" className="text-foreground font-sans flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Event Date *
                  </Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={formData.eventDate}
                    onChange={(e) => handleChange('eventDate', e.target.value)}
                    required
                    className="bg-background/50 border-border focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-foreground font-sans">
                    Tell Us About Your Event
                  </Label>
                  <Textarea
                    id="message"
                    placeholder="Share details about your venue, style preferences, or any special requests..."
                    value={formData.message}
                    onChange={(e) => handleChange('message', e.target.value)}
                    rows={5}
                    className="bg-background/50 border-border focus:border-primary resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn-gold"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Booking Request'}
                </Button>

                <p className="text-center font-sans text-sm text-muted-foreground">
                  We typically respond within 24 hours
                </p>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-16 bg-card">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6">
              <Calendar className="w-8 h-8 text-primary mx-auto mb-4" />
              <h3 className="font-serif text-xl mb-2 text-foreground">Flexible Scheduling</h3>
              <p className="font-sans text-sm text-muted-foreground">
                We work around your timeline to capture every moment perfectly.
              </p>
            </div>
            <div className="p-6">
              <Clock className="w-8 h-8 text-primary mx-auto mb-4" />
              <h3 className="font-serif text-xl mb-2 text-foreground">Quick Turnaround</h3>
              <p className="font-sans text-sm text-muted-foreground">
                Receive your edited photos within 2-4 weeks after your event.
              </p>
            </div>
            <div className="p-6">
              <CheckCircle className="w-8 h-8 text-primary mx-auto mb-4" />
              <h3 className="font-serif text-xl mb-2 text-foreground">Satisfaction Guaranteed</h3>
              <p className="font-sans text-sm text-muted-foreground">
                Your happiness is our priority. We ensure you love every image.
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Booking;
