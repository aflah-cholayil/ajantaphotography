import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { studioConfig } from "@/config/studio";
import { 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Instagram, 
  Facebook,
  Clock,
  Globe,
  MessageCircle,
  Copy,
  Check
} from "lucide-react";

const Settings = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: "Copied!",
      description: `${field} copied to clipboard`,
    });
  };

  const InfoRow = ({ 
    icon: Icon, 
    label, 
    value, 
    copyable = true 
  }: { 
    icon: React.ElementType; 
    label: string; 
    value: string | string[]; 
    copyable?: boolean;
  }) => {
    const displayValue = Array.isArray(value) ? value.join(", ") : value;
    return (
      <div className="flex items-start gap-4 py-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-foreground font-medium truncate">{displayValue}</p>
            {copyable && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 flex-shrink-0"
                onClick={() => copyToClipboard(displayValue, label)}
              >
                {copied === label ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3 text-muted-foreground" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Studio Settings</h1>
          <p className="text-muted-foreground">
            View your studio's business information. These details are used across the website and email templates.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Studio Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Studio Identity
              </CardTitle>
              <CardDescription>
                Your business name and branding information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow icon={Building2} label="Studio Name" value={studioConfig.name} />
              <InfoRow icon={Globe} label="Website" value={studioConfig.domain} />
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Contact Information
              </CardTitle>
              <CardDescription>
                Phone numbers and email addresses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow icon={Phone} label="Primary Phone" value={studioConfig.contact.primaryPhone} />
              <InfoRow icon={Phone} label="Secondary Phone" value={studioConfig.contact.phones[1]} />
              <InfoRow icon={MessageCircle} label="WhatsApp" value={studioConfig.contact.whatsapp} />
              <InfoRow icon={Mail} label="Email" value={studioConfig.contact.email} />
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Studio Address
              </CardTitle>
              <CardDescription>
                Physical location and map coordinates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow icon={MapPin} label="Address Line 1" value={studioConfig.address.line1} />
              <InfoRow icon={MapPin} label="Address Line 2" value={studioConfig.address.line2} />
              <InfoRow icon={MapPin} label="Pincode" value={studioConfig.address.pincode} />
              <Separator className="my-3" />
              <div className="pt-2">
                <a
                  href={studioConfig.address.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-primary hover:underline text-sm"
                >
                  <MapPin className="h-4 w-4" />
                  Open in Google Maps
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Social Media */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Instagram className="h-5 w-5 text-primary" />
                Social Media
              </CardTitle>
              <CardDescription>
                Social media profiles and links
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow icon={Instagram} label="Instagram Handle" value={studioConfig.social.instagram} />
              <InfoRow icon={Facebook} label="Facebook Page" value={studioConfig.social.facebook} />
              <Separator className="my-3" />
              <div className="flex gap-3 pt-2">
                <a
                  href={studioConfig.social.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
                >
                  <Instagram className="h-4 w-4" />
                  Instagram
                </a>
                <a
                  href={studioConfig.contact.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg text-sm hover:opacity-90 transition-opacity"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Business Hours */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Business Hours
              </CardTitle>
              <CardDescription>
                Studio operating hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Monday - Friday</p>
                  <p className="font-medium">{studioConfig.hours.weekdays}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Saturday</p>
                  <p className="font-medium">{studioConfig.hours.saturday}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Sunday</p>
                  <p className="font-medium">{studioConfig.hours.sunday}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Note */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-1">Need to update these details?</h4>
                <p className="text-sm text-muted-foreground">
                  To update your studio information, edit the configuration file at{" "}
                  <code className="px-1.5 py-0.5 rounded bg-muted text-xs">src/config/studio.ts</code>.
                  Changes will automatically reflect across the website, emails, and all admin pages.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Settings;
