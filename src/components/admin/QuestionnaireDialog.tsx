import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { 
  FileText, Calendar, MapPin, Camera, Video, Plane, Users, Heart, 
  Album, Clock, Lock, Unlock, Send, Download, Loader2, ExternalLink,
  CheckCircle, XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Questionnaire {
  id: string;
  booking_id: string;
  token: string;
  status: 'not_sent' | 'sent' | 'completed';
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
  created_at: string;
  updated_at: string;
}

interface QuestionnaireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  clientName: string;
  clientEmail: string;
}

export function QuestionnaireDialog({
  open,
  onOpenChange,
  bookingId,
  clientName,
  clientEmail,
}: QuestionnaireDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [sending, setSending] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (open && bookingId) {
      fetchQuestionnaire();
    }
  }, [open, bookingId]);

  const fetchQuestionnaire = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('event_questionnaires')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (error) throw error;
      setQuestionnaire(data);
    } catch (err) {
      console.error('Error fetching questionnaire:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendQuestionnaire = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-questionnaire', {
        body: { booking_id: bookingId, resend: !!questionnaire },
      });

      if (error) throw error;

      toast({
        title: 'Questionnaire Sent',
        description: `Email sent to ${clientEmail}`,
      });

      fetchQuestionnaire();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to send questionnaire',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleToggleLock = async () => {
    if (!questionnaire) return;
    setToggling(true);
    try {
      const { error } = await supabase
        .from('event_questionnaires')
        .update({ is_locked: !questionnaire.is_locked })
        .eq('id', questionnaire.id);

      if (error) throw error;

      toast({
        title: questionnaire.is_locked ? 'Questionnaire Unlocked' : 'Questionnaire Locked',
        description: questionnaire.is_locked 
          ? 'Client can now edit their responses'
          : 'Client can no longer edit their responses',
      });

      fetchQuestionnaire();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setToggling(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!questionnaire) return;
    
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Helper functions
    const addTitle = (text: string) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22);
      pdf.setTextColor(51, 51, 51);
      pdf.text(text, pageWidth / 2, y, { align: 'center' });
      y += 12;
    };

    const addSubtitle = (text: string) => {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(128, 128, 128);
      pdf.text(text, pageWidth / 2, y, { align: 'center' });
      y += 8;
    };

    const addSectionHeader = (text: string) => {
      if (y > 250) {
        pdf.addPage();
        y = 20;
      }
      y += 6;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(180, 142, 90); // Gold accent
      pdf.text(text.toUpperCase(), margin, y);
      y += 2;
      pdf.setDrawColor(180, 142, 90);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, margin + 50, y);
      y += 8;
    };

    const addField = (label: string, value: string | null | undefined) => {
      if (!value) return;
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(label + ':', margin, y);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(51, 51, 51);
      
      const splitText = pdf.splitTextToSize(value, contentWidth - 45);
      pdf.text(splitText, margin + 45, y);
      y += splitText.length * 5 + 3;
    };

    const addMultilineField = (label: string, value: string | null | undefined) => {
      if (!value) return;
      if (y > 260) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(label + ':', margin, y);
      y += 6;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(51, 51, 51);
      
      const splitText = pdf.splitTextToSize(value, contentWidth);
      pdf.text(splitText, margin, y);
      y += splitText.length * 5 + 4;
    };

    const addBooleanField = (label: string, value: boolean) => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(51, 51, 51);
      const icon = value ? '✓' : '✗';
      const color = value ? [34, 139, 34] : [169, 169, 169];
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.text(icon, margin, y);
      pdf.setTextColor(51, 51, 51);
      pdf.text(label, margin + 8, y);
      y += 6;
    };

    // Header
    addTitle('Event Questionnaire');
    addSubtitle('Ajanta Photography');
    y += 4;
    
    // Client info box
    pdf.setFillColor(250, 250, 250);
    pdf.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(51, 51, 51);
    pdf.text(clientName, margin + 6, y + 10);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.text(clientEmail, margin + 6, y + 18);
    pdf.text(
      questionnaire.submitted_at 
        ? `Submitted: ${format(new Date(questionnaire.submitted_at), 'PPpp')}`
        : 'Not submitted',
      margin + 6, 
      y + 25
    );
    y += 36;

    // Event Details
    addSectionHeader('Event Details');
    addField('Event Type', questionnaire.event_type);
    addField('Event Date', questionnaire.event_date ? format(new Date(questionnaire.event_date), 'PPPP') : null);
    addField('Venue', questionnaire.venue_name);
    addField('Location', questionnaire.venue_location);
    if (questionnaire.event_start_time && questionnaire.event_end_time) {
      addField('Time', `${questionnaire.event_start_time} - ${questionnaire.event_end_time}`);
    }

    // Coverage Requirements
    addSectionHeader('Coverage Requirements');
    addBooleanField('Photography', questionnaire.photography_required);
    addBooleanField('Videography', questionnaire.videography_required);
    addBooleanField('Drone Coverage', questionnaire.drone_coverage);
    addField('Number of Days', questionnaire.number_of_days?.toString());

    // Style Preferences
    addSectionHeader('Style Preferences');
    addField('Photography Style', questionnaire.photography_style?.join(', '));
    if (questionnaire.reference_links?.length) {
      addMultilineField('Reference Links', questionnaire.reference_links.join('\n'));
    }
    addMultilineField('Must-Capture Moments', questionnaire.must_capture_moments);

    // People Information
    addSectionHeader('People Information');
    addField('Primary Contacts', questionnaire.primary_contact_names);
    addMultilineField('Important Family Members', questionnaire.important_family_members);
    addMultilineField('VIP Focus List', questionnaire.vip_focus_list);

    // Deliverables
    addSectionHeader('Deliverables');
    addBooleanField('Photo Album Required', questionnaire.album_required);
    addField('Video Types', questionnaire.video_types?.join(', '));
    addField('Expected Delivery', questionnaire.expected_delivery_timeline);

    // Special Instructions
    addSectionHeader('Special Instructions');
    addMultilineField('Venue Rules', questionnaire.venue_rules);
    addMultilineField('Cultural Notes', questionnaire.cultural_notes);
    addMultilineField('Additional Instructions', questionnaire.additional_instructions);

    // Footer
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pdf.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Save
    pdf.save(`questionnaire-${clientName.replace(/\s+/g, '-').toLowerCase()}.pdf`);

    toast({
      title: 'Downloaded',
      description: 'Questionnaire exported as PDF',
    });
  };

  const getStatusBadge = () => {
    if (!questionnaire) {
      return <Badge variant="outline">Not Sent</Badge>;
    }
    switch (questionnaire.status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'sent':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      default:
        return <Badge variant="outline">Not Sent</Badge>;
    }
  };

  const questionnaireUrl = questionnaire 
    ? `${window.location.origin}/questionnaire/${questionnaire.token}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif">
            <FileText className="text-primary" />
            Event Questionnaire
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[70vh]">
            <div className="space-y-6 pr-4">
              {/* Status & Actions */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">Status:</span>
                  {getStatusBadge()}
                  {questionnaire?.is_locked && (
                    <Badge variant="outline" className="gap-1">
                      <Lock size={12} />
                      Locked
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendQuestionnaire}
                    disabled={sending}
                  >
                    {sending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {questionnaire ? 'Resend' : 'Send'} Email
                  </Button>
                  {questionnaire && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleToggleLock}
                        disabled={toggling}
                      >
                        {toggling ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : questionnaire.is_locked ? (
                          <Unlock className="mr-2 h-4 w-4" />
                        ) : (
                          <Lock className="mr-2 h-4 w-4" />
                        )}
                        {questionnaire.is_locked ? 'Unlock' : 'Lock'}
                      </Button>
                      {questionnaire.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDownloadPDF}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Export
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Link */}
              {questionnaireUrl && (
                <div className="p-3 rounded-lg bg-muted/50 text-sm flex items-center justify-between gap-2">
                  <code className="text-xs truncate flex-1">{questionnaireUrl}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(questionnaireUrl, '_blank')}
                  >
                    <ExternalLink size={14} />
                  </Button>
                </div>
              )}

              {questionnaire?.submitted_at && (
                <p className="text-sm text-muted-foreground">
                  Submitted: {format(new Date(questionnaire.submitted_at), 'PPpp')}
                </p>
              )}

              {questionnaire?.status === 'completed' && (
                <>
                  <Separator />

                  {/* Event Details */}
                  <Section title="Event Details" icon={Calendar}>
                    <Field label="Event Type" value={questionnaire.event_type} />
                    <Field 
                      label="Event Date" 
                      value={questionnaire.event_date ? format(new Date(questionnaire.event_date), 'PP') : null} 
                    />
                    <Field label="Venue" value={questionnaire.venue_name} />
                    <Field label="Location" value={questionnaire.venue_location} />
                    <Field 
                      label="Time" 
                      value={questionnaire.event_start_time && questionnaire.event_end_time 
                        ? `${questionnaire.event_start_time} - ${questionnaire.event_end_time}`
                        : null
                      } 
                    />
                  </Section>

                  {/* Coverage */}
                  <Section title="Coverage Requirements" icon={Camera}>
                    <div className="flex flex-wrap gap-2">
                      <CoverageBadge 
                        icon={Camera} 
                        label="Photography" 
                        active={questionnaire.photography_required} 
                      />
                      <CoverageBadge 
                        icon={Video} 
                        label="Videography" 
                        active={questionnaire.videography_required} 
                      />
                      <CoverageBadge 
                        icon={Plane} 
                        label="Drone" 
                        active={questionnaire.drone_coverage} 
                      />
                    </div>
                    <Field label="Number of Days" value={questionnaire.number_of_days?.toString()} />
                  </Section>

                  {/* Style */}
                  <Section title="Style Preferences" icon={Heart}>
                    <Field 
                      label="Photography Style" 
                      value={questionnaire.photography_style?.join(', ')} 
                    />
                    {questionnaire.reference_links?.length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground">Reference Links:</span>
                        <div className="mt-1 space-y-1">
                          {questionnaire.reference_links.map((link, i) => (
                            <a
                              key={i}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-sm text-primary hover:underline truncate"
                            >
                              {link}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    <Field label="Must-Capture Moments" value={questionnaire.must_capture_moments} multiline />
                  </Section>

                  {/* People */}
                  <Section title="People Information" icon={Users}>
                    <Field label="Primary Contacts" value={questionnaire.primary_contact_names} />
                    <Field label="Important Family Members" value={questionnaire.important_family_members} multiline />
                    <Field label="VIP Focus List" value={questionnaire.vip_focus_list} multiline />
                  </Section>

                  {/* Deliverables */}
                  <Section title="Deliverables" icon={Album}>
                    <div className="flex items-center gap-2">
                      {questionnaire.album_required ? (
                        <CheckCircle className="text-green-500" size={16} />
                      ) : (
                        <XCircle className="text-muted-foreground" size={16} />
                      )}
                      <span>Photo Album {questionnaire.album_required ? 'Required' : 'Not Required'}</span>
                    </div>
                    <Field label="Video Types" value={questionnaire.video_types?.join(', ')} />
                    <Field label="Expected Delivery" value={questionnaire.expected_delivery_timeline} />
                  </Section>

                  {/* Special Instructions */}
                  <Section title="Special Instructions" icon={FileText}>
                    <Field label="Venue Rules" value={questionnaire.venue_rules} multiline />
                    <Field label="Cultural Notes" value={questionnaire.cultural_notes} multiline />
                    <Field label="Additional Instructions" value={questionnaire.additional_instructions} multiline />
                  </Section>
                </>
              )}

              {!questionnaire && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No questionnaire sent yet.</p>
                  <p className="text-sm">Click "Send Email" to send the questionnaire to the client.</p>
                </div>
              )}

              {questionnaire?.status === 'sent' && (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
                  <p>Waiting for client response.</p>
                  <p className="text-sm">The questionnaire has been sent to {clientEmail}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ 
  title, 
  icon: Icon, 
  children 
}: { 
  title: string; 
  icon: any; 
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h4 className="font-medium flex items-center gap-2">
        <Icon size={16} className="text-primary" />
        {title}
      </h4>
      <div className="pl-6 space-y-2">{children}</div>
    </div>
  );
}

function Field({ 
  label, 
  value, 
  multiline = false 
}: { 
  label: string; 
  value: string | null | undefined; 
  multiline?: boolean;
}) {
  if (!value) return null;
  
  return (
    <div className={multiline ? 'space-y-1' : 'flex items-start gap-2'}>
      <span className="text-sm text-muted-foreground shrink-0">{label}:</span>
      <span className={`text-sm ${multiline ? 'block whitespace-pre-wrap' : ''}`}>{value}</span>
    </div>
  );
}

function CoverageBadge({ 
  icon: Icon, 
  label, 
  active 
}: { 
  icon: any; 
  label: string; 
  active: boolean;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
      active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
    }`}>
      <Icon size={14} />
      {label}
    </div>
  );
}
