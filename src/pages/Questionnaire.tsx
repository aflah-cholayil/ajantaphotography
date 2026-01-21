import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, Video, Plane, Users, Calendar, MapPin, Clock, Heart, 
  Film, Album, FileText, CheckCircle, ChevronRight, ChevronLeft,
  Loader2, Lock, AlertCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MinimalFooter } from '@/components/shared/MinimalFooter';
import { Logo } from '@/components/shared/Logo';

interface QuestionnaireData {
  id: string;
  booking_id: string;
  token: string;
  status: string;
  is_locked: boolean;
  is_editable: boolean;
  event_type: string | null;
  event_date: string | null;
  venue_name: string | null;
  venue_location: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  photography_required: boolean;
  videography_required: boolean;
  drone_coverage: boolean;
  number_of_days: number;
  photography_style: string[] | null;
  reference_links: string[] | null;
  must_capture_moments: string | null;
  primary_contact_names: string | null;
  important_family_members: string | null;
  vip_focus_list: string | null;
  album_required: boolean;
  video_types: string[] | null;
  expected_delivery_timeline: string | null;
  venue_rules: string | null;
  cultural_notes: string | null;
  additional_instructions: string | null;
  confirmed: boolean;
  submitted_at: string | null;
  bookings: {
    client_name: string;
    client_email: string;
    event_type: string;
    event_date: string | null;
    phone: string | null;
    message: string | null;
  };
}

const STEPS = [
  { id: 'event', title: 'Event Details', icon: Calendar },
  { id: 'coverage', title: 'Coverage', icon: Camera },
  { id: 'style', title: 'Style', icon: Heart },
  { id: 'people', title: 'People', icon: Users },
  { id: 'deliverables', title: 'Deliverables', icon: Album },
  { id: 'special', title: 'Special Notes', icon: FileText },
  { id: 'confirm', title: 'Confirm', icon: CheckCircle },
];

const PHOTOGRAPHY_STYLES = ['Traditional', 'Candid', 'Cinematic', 'Documentary'];
const VIDEO_TYPES = ['Highlight Reel', 'Full Coverage', 'Social Reels', 'Teaser'];

export default function Questionnaire() {
  const { token } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<QuestionnaireData | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    event_type: '',
    event_date: '',
    venue_name: '',
    venue_location: '',
    event_start_time: '',
    event_end_time: '',
    photography_required: true,
    videography_required: false,
    drone_coverage: false,
    number_of_days: 1,
    photography_style: [] as string[],
    reference_links: [''],
    must_capture_moments: '',
    primary_contact_names: '',
    important_family_members: '',
    vip_focus_list: '',
    album_required: false,
    video_types: [] as string[],
    expected_delivery_timeline: '',
    venue_rules: '',
    cultural_notes: '',
    additional_instructions: '',
    confirmed: false,
  });

  useEffect(() => {
    if (token) {
      fetchQuestionnaire();
    }
  }, [token]);

  const fetchQuestionnaire = async () => {
    try {
      const { data: response, error } = await supabase.functions.invoke('questionnaire', {
        body: null,
        method: 'GET',
      });

      // Use fetch directly for GET with query params
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/questionnaire?token=${token}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await res.json();

      if (result.locked) {
        setIsLocked(true);
        setData(result.data);
      } else if (result.completed) {
        setIsCompleted(true);
        setData(result.data);
      } else if (result.error) {
        setError(result.error);
      } else if (result.data) {
        setData(result.data);
        // Populate form with existing data
        const q = result.data;
        setFormData({
          event_type: q.event_type || q.bookings?.event_type || '',
          event_date: q.event_date || q.bookings?.event_date || '',
          venue_name: q.venue_name || '',
          venue_location: q.venue_location || '',
          event_start_time: q.event_start_time || '',
          event_end_time: q.event_end_time || '',
          photography_required: q.photography_required ?? true,
          videography_required: q.videography_required ?? false,
          drone_coverage: q.drone_coverage ?? false,
          number_of_days: q.number_of_days || 1,
          photography_style: q.photography_style || [],
          reference_links: q.reference_links?.length ? q.reference_links : [''],
          must_capture_moments: q.must_capture_moments || '',
          primary_contact_names: q.primary_contact_names || '',
          important_family_members: q.important_family_members || '',
          vip_focus_list: q.vip_focus_list || '',
          album_required: q.album_required ?? false,
          video_types: q.video_types || [],
          expected_delivery_timeline: q.expected_delivery_timeline || '',
          venue_rules: q.venue_rules || '',
          cultural_notes: q.cultural_notes || '',
          additional_instructions: q.additional_instructions || '',
          confirmed: false,
        });
      }
    } catch (err) {
      console.error('Error fetching questionnaire:', err);
      setError('Failed to load questionnaire');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (submit = false) => {
    setSaving(true);
    try {
      const payload = {
        ...formData,
        reference_links: formData.reference_links.filter(l => l.trim()),
        confirmed: submit ? true : formData.confirmed,
      };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/questionnaire?token=${token}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await res.json();

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: submit ? 'Questionnaire Submitted!' : 'Progress Saved',
        description: submit 
          ? 'Thank you for completing the questionnaire. We will be in touch soon.'
          : 'Your progress has been saved.',
      });

      if (submit) {
        setIsCompleted(true);
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save questionnaire',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: 'photography_style' | 'video_types', item: string) => {
    setFormData(prev => {
      const current = prev[field];
      const updated = current.includes(item)
        ? current.filter(i => i !== item)
        : [...current, item];
      return { ...prev, [field]: updated };
    });
  };

  const addReferenceLink = () => {
    setFormData(prev => ({
      ...prev,
      reference_links: [...prev.reference_links, ''],
    }));
  };

  const updateReferenceLink = (index: number, value: string) => {
    setFormData(prev => {
      const updated = [...prev.reference_links];
      updated[index] = value;
      return { ...prev, reference_links: updated };
    });
  };

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading questionnaire...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-serif mb-2">Questionnaire Not Found</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Lock className="w-16 h-16 text-primary mx-auto mb-4" />
            <h2 className="text-xl font-serif mb-2">Questionnaire Locked</h2>
            <p className="text-muted-foreground">
              This questionnaire has been locked by the admin and cannot be modified.
              Please contact us if you need to make changes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
              >
                <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
              </motion.div>
              <h2 className="text-2xl font-serif mb-2">Thank You!</h2>
              <p className="text-muted-foreground mb-4">
                Your questionnaire has been submitted successfully. We have all the 
                information we need to make your event perfect.
              </p>
              <p className="text-sm text-muted-foreground">
                Our team will review your responses and get in touch with you soon.
              </p>
            </CardContent>
          </Card>
        </div>
        <MinimalFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Logo className="h-10" />
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Event Questionnaire</p>
              <p className="text-sm font-medium">{data?.bookings?.client_name}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Indicator */}
      <div className="border-b border-border bg-card/30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between overflow-x-auto pb-2">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(index)}
                  className={`flex flex-col items-center gap-1 min-w-[80px] transition-colors ${
                    isActive 
                      ? 'text-primary' 
                      : isCompleted 
                        ? 'text-green-500' 
                        : 'text-muted-foreground'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isActive 
                      ? 'border-primary bg-primary/10' 
                      : isCompleted 
                        ? 'border-green-500 bg-green-500/10' 
                        : 'border-muted'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle size={20} />
                    ) : (
                      <Icon size={20} />
                    )}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">{step.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Step 0: Event Details */}
            {currentStep === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif">
                    <Calendar className="text-primary" />
                    Event Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="event_type">Event Type</Label>
                      <Input
                        id="event_type"
                        value={formData.event_type}
                        onChange={e => updateField('event_type', e.target.value)}
                        placeholder="e.g., Wedding, Engagement"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event_date">Event Date</Label>
                      <Input
                        id="event_date"
                        type="date"
                        value={formData.event_date}
                        onChange={e => updateField('event_date', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="venue_name">Venue Name</Label>
                    <Input
                      id="venue_name"
                      value={formData.venue_name}
                      onChange={e => updateField('venue_name', e.target.value)}
                      placeholder="Name of the venue"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="venue_location">Venue Location / Address</Label>
                    <Textarea
                      id="venue_location"
                      value={formData.venue_location}
                      onChange={e => updateField('venue_location', e.target.value)}
                      placeholder="Full address of the venue"
                      rows={2}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="event_start_time">Start Time</Label>
                      <Input
                        id="event_start_time"
                        type="time"
                        value={formData.event_start_time}
                        onChange={e => updateField('event_start_time', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="event_end_time">End Time</Label>
                      <Input
                        id="event_end_time"
                        type="time"
                        value={formData.event_end_time}
                        onChange={e => updateField('event_end_time', e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Coverage Requirements */}
            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif">
                    <Camera className="text-primary" />
                    Coverage Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div 
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.photography_required 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => updateField('photography_required', !formData.photography_required)}
                    >
                      <Camera className={`w-8 h-8 mb-2 ${formData.photography_required ? 'text-primary' : 'text-muted-foreground'}`} />
                      <h4 className="font-medium">Photography</h4>
                      <p className="text-sm text-muted-foreground">Still photos</p>
                    </div>

                    <div 
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.videography_required 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => updateField('videography_required', !formData.videography_required)}
                    >
                      <Video className={`w-8 h-8 mb-2 ${formData.videography_required ? 'text-primary' : 'text-muted-foreground'}`} />
                      <h4 className="font-medium">Videography</h4>
                      <p className="text-sm text-muted-foreground">Video coverage</p>
                    </div>

                    <div 
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.drone_coverage 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => updateField('drone_coverage', !formData.drone_coverage)}
                    >
                      <Plane className={`w-8 h-8 mb-2 ${formData.drone_coverage ? 'text-primary' : 'text-muted-foreground'}`} />
                      <h4 className="font-medium">Drone</h4>
                      <p className="text-sm text-muted-foreground">Aerial shots</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="number_of_days">Number of Days/Events</Label>
                    <Input
                      id="number_of_days"
                      type="number"
                      min={1}
                      value={formData.number_of_days}
                      onChange={e => updateField('number_of_days', parseInt(e.target.value) || 1)}
                    />
                    <p className="text-sm text-muted-foreground">
                      How many days or separate events do you need coverage for?
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Style Preferences */}
            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif">
                    <Heart className="text-primary" />
                    Style Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <Label>Photography Style (select all that apply)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {PHOTOGRAPHY_STYLES.map(style => (
                        <div
                          key={style}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            formData.photography_style.includes(style)
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => toggleArrayItem('photography_style', style)}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox checked={formData.photography_style.includes(style)} />
                            <span>{style}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Reference Links (Pinterest, Instagram, etc.)</Label>
                    {formData.reference_links.map((link, index) => (
                      <Input
                        key={index}
                        value={link}
                        onChange={e => updateReferenceLink(index, e.target.value)}
                        placeholder="https://..."
                      />
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={addReferenceLink}>
                      + Add Another Link
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="must_capture_moments">Must-Capture Moments</Label>
                    <Textarea
                      id="must_capture_moments"
                      value={formData.must_capture_moments}
                      onChange={e => updateField('must_capture_moments', e.target.value)}
                      placeholder="List any specific moments, rituals, or shots you definitely want captured..."
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3: People Information */}
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif">
                    <Users className="text-primary" />
                    People Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="primary_contact_names">Primary Contact Names</Label>
                    <Input
                      id="primary_contact_names"
                      value={formData.primary_contact_names}
                      onChange={e => updateField('primary_contact_names', e.target.value)}
                      placeholder="Bride & Groom names, or main contact"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="important_family_members">Important Family Members</Label>
                    <Textarea
                      id="important_family_members"
                      value={formData.important_family_members}
                      onChange={e => updateField('important_family_members', e.target.value)}
                      placeholder="List key family members we should know about (parents, grandparents, etc.)"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vip_focus_list">VIP Focus List (Optional)</Label>
                    <Textarea
                      id="vip_focus_list"
                      value={formData.vip_focus_list}
                      onChange={e => updateField('vip_focus_list', e.target.value)}
                      placeholder="Any special guests who should receive extra focus in photos..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4: Deliverables */}
            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif">
                    <Album className="text-primary" />
                    Deliverables
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div 
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      formData.album_required 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => updateField('album_required', !formData.album_required)}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox checked={formData.album_required} />
                      <div>
                        <h4 className="font-medium">Photo Album Required</h4>
                        <p className="text-sm text-muted-foreground">Physical printed album</p>
                      </div>
                    </div>
                  </div>

                  {formData.videography_required && (
                    <div className="space-y-3">
                      <Label>Video Types (select all that apply)</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {VIDEO_TYPES.map(type => (
                          <div
                            key={type}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              formData.video_types.includes(type)
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => toggleArrayItem('video_types', type)}
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox checked={formData.video_types.includes(type)} />
                              <span>{type}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Expected Delivery Timeline</Label>
                    <RadioGroup
                      value={formData.expected_delivery_timeline}
                      onValueChange={value => updateField('expected_delivery_timeline', value)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="2-weeks" id="2-weeks" />
                        <Label htmlFor="2-weeks">Within 2 weeks</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="1-month" id="1-month" />
                        <Label htmlFor="1-month">Within 1 month</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="2-months" id="2-months" />
                        <Label htmlFor="2-months">Within 2 months</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="flexible" id="flexible" />
                        <Label htmlFor="flexible">Flexible / No rush</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 5: Special Instructions */}
            {currentStep === 5 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif">
                    <FileText className="text-primary" />
                    Special Instructions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="venue_rules">Venue Rules & Restrictions</Label>
                    <Textarea
                      id="venue_rules"
                      value={formData.venue_rules}
                      onChange={e => updateField('venue_rules', e.target.value)}
                      placeholder="Any photography/videography restrictions at the venue..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cultural_notes">Cultural / Religious Notes</Label>
                    <Textarea
                      id="cultural_notes"
                      value={formData.cultural_notes}
                      onChange={e => updateField('cultural_notes', e.target.value)}
                      placeholder="Any cultural or religious considerations we should be aware of..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="additional_instructions">Additional Instructions</Label>
                    <Textarea
                      id="additional_instructions"
                      value={formData.additional_instructions}
                      onChange={e => updateField('additional_instructions', e.target.value)}
                      placeholder="Any other special requests or information..."
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 6: Confirmation */}
            {currentStep === 6 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-serif">
                    <CheckCircle className="text-primary" />
                    Review & Submit
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary */}
                  <div className="space-y-4 p-4 rounded-lg bg-muted/50">
                    <h4 className="font-medium">Event Summary</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-muted-foreground">Event:</span>
                      <span>{formData.event_type || 'Not specified'}</span>
                      <span className="text-muted-foreground">Date:</span>
                      <span>{formData.event_date || 'Not specified'}</span>
                      <span className="text-muted-foreground">Venue:</span>
                      <span>{formData.venue_name || 'Not specified'}</span>
                      <span className="text-muted-foreground">Coverage:</span>
                      <span>
                        {[
                          formData.photography_required && 'Photo',
                          formData.videography_required && 'Video',
                          formData.drone_coverage && 'Drone',
                        ].filter(Boolean).join(', ') || 'Not specified'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div 
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        formData.confirmed 
                          ? 'border-green-500 bg-green-500/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => updateField('confirmed', !formData.confirmed)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox checked={formData.confirmed} className="mt-1" />
                        <div>
                          <h4 className="font-medium">I confirm the above information is accurate</h4>
                          <p className="text-sm text-muted-foreground">
                            By checking this box, you confirm that all the information provided is 
                            accurate to the best of your knowledge.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    disabled={!formData.confirmed || saving}
                    onClick={() => handleSave(true)}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Submit Questionnaire
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <Button
            variant="ghost"
            onClick={() => handleSave(false)}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Progress
          </Button>

          {currentStep < STEPS.length - 1 && (
            <Button onClick={nextStep}>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          {currentStep === STEPS.length - 1 && <div />}
        </div>
      </main>

      <MinimalFooter />
    </div>
  );
}
