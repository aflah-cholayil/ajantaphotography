import { useState, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useStudioSettings, StudioSettings } from "@/hooks/useStudioSettings";
import { studioConfig } from "@/config/studio";
import { VideoUploader } from "@/components/admin/VideoUploader";
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
  Save,
  Loader2,
  Pencil,
  X,
  Video
} from "lucide-react";

const Settings = () => {
  const { toast } = useToast();
  const { settings, isLoading, updateMultipleSettings, isUpdating } = useStudioSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<StudioSettings>>({});

  const handleVideoUploadComplete = useCallback((s3Key: string) => {
    updateMultipleSettings(
      { showcase_video_key: s3Key },
      {
        onSuccess: () => {
          toast({
            title: "Video saved",
            description: "Your showcase video has been updated",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to save video setting",
            variant: "destructive",
          });
        },
      }
    );
  }, [updateMultipleSettings, toast]);

  const handleVideoRemove = useCallback(() => {
    updateMultipleSettings(
      { showcase_video_key: '' },
      {
        onSuccess: () => {
          toast({
            title: "Video removed",
            description: "The showcase video has been removed",
          });
        },
      }
    );
  }, [updateMultipleSettings, toast]);

  const handleStartEditing = () => {
    setFormData({ ...settings });
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setFormData({});
    setIsEditing(false);
  };

  const handleInputChange = (key: keyof StudioSettings, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Filter out unchanged values
    const changes: Partial<StudioSettings> = {};
    Object.keys(formData).forEach((key) => {
      const k = key as keyof StudioSettings;
      if (formData[k] !== settings[k]) {
        changes[k] = formData[k];
      }
    });

    if (Object.keys(changes).length === 0) {
      toast({
        title: "No changes",
        description: "No settings were modified",
      });
      setIsEditing(false);
      return;
    }

    updateMultipleSettings(changes, {
      onSuccess: () => {
        toast({
          title: "Settings updated",
          description: "Your studio settings have been saved successfully",
        });
        setIsEditing(false);
        setFormData({});
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to update settings. Please try again.",
          variant: "destructive",
        });
      },
    });
  };

  const EditableField = ({
    label,
    settingKey,
    icon: Icon,
    type = "text",
  }: {
    label: string;
    settingKey: keyof StudioSettings;
    icon: React.ElementType;
    type?: string;
  }) => {
    const currentValue = isEditing ? formData[settingKey] || "" : settings[settingKey];
    
    return (
      <div className="flex items-start gap-4 py-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
          {isEditing ? (
            <Input
              type={type}
              value={currentValue}
              onChange={(e) => handleInputChange(settingKey, e.target.value)}
              className="mt-1"
            />
          ) : (
            <p className="text-foreground font-medium mt-1">{currentValue}</p>
          )}
        </div>
      </div>
    );
  };

  const StaticInfoRow = ({ 
    icon: Icon, 
    label, 
    value, 
  }: { 
    icon: React.ElementType; 
    label: string; 
    value: string; 
  }) => {
    return (
      <div className="flex items-start gap-4 py-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
          <p className="text-foreground font-medium mt-1">{value}</p>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Studio Settings</h1>
            <p className="text-muted-foreground">
              Manage your studio's business information. These details are used across the website and email templates.
            </p>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancelEditing} disabled={isUpdating}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isUpdating}>
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </>
            ) : (
              <Button onClick={handleStartEditing}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Settings
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Studio Identity - Not Editable */}
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Studio Identity
              </CardTitle>
              <CardDescription>
                Business name and branding (contact developer to change)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <StaticInfoRow icon={Building2} label="Studio Name" value={studioConfig.name} />
              <StaticInfoRow icon={Globe} label="Website" value={studioConfig.domain} />
            </CardContent>
          </Card>

          {/* Contact Information - Editable */}
          <Card className={isEditing ? "ring-2 ring-primary" : ""}>
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
              <EditableField icon={Phone} label="Primary Phone" settingKey="primary_phone" />
              <EditableField icon={Phone} label="All Phone Numbers (comma-separated)" settingKey="phones" />
              <EditableField icon={MessageCircle} label="WhatsApp Number" settingKey="whatsapp" />
              <EditableField icon={Mail} label="Email" settingKey="email" type="email" />
              <EditableField icon={Phone} label="Landline" settingKey="landline" />
            </CardContent>
          </Card>

          {/* Address - Editable */}
          <Card className={isEditing ? "ring-2 ring-primary" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Studio Address
              </CardTitle>
              <CardDescription>
                Physical location details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <EditableField icon={MapPin} label="Address Line 1" settingKey="address_line1" />
              <EditableField icon={MapPin} label="Address Line 2" settingKey="address_line2" />
              <EditableField icon={MapPin} label="Pincode" settingKey="pincode" />
              <EditableField icon={Globe} label="Google Maps URL" settingKey="google_maps_url" />
            </CardContent>
          </Card>

          {/* Social Media - Editable */}
          <Card className={isEditing ? "ring-2 ring-primary" : ""}>
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
              <EditableField icon={Instagram} label="Instagram Handle" settingKey="instagram" />
              <EditableField icon={Globe} label="Instagram URL" settingKey="instagram_url" />
              <EditableField icon={Facebook} label="Facebook Page Name" settingKey="facebook" />
              <EditableField icon={Globe} label="Facebook URL" settingKey="facebook_url" />
            </CardContent>
          </Card>

          {/* Business Hours - Editable */}
          <Card className={isEditing ? "ring-2 ring-primary md:col-span-2" : "md:col-span-2"}>
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
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Monday - Friday</Label>
                  {isEditing ? (
                    <Input
                      value={formData.hours_weekdays || ""}
                      onChange={(e) => handleInputChange("hours_weekdays", e.target.value)}
                    />
                  ) : (
                    <p className="font-medium p-2 rounded-lg bg-muted/50">{settings.hours_weekdays}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Saturday</Label>
                  {isEditing ? (
                    <Input
                      value={formData.hours_saturday || ""}
                      onChange={(e) => handleInputChange("hours_saturday", e.target.value)}
                    />
                  ) : (
                    <p className="font-medium p-2 rounded-lg bg-muted/50">{settings.hours_saturday}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">Sunday</Label>
                  {isEditing ? (
                    <Input
                      value={formData.hours_sunday || ""}
                      onChange={(e) => handleInputChange("hours_sunday", e.target.value)}
                    />
                  ) : (
                    <p className="font-medium p-2 rounded-lg bg-muted/50">{settings.hours_sunday}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Showcase Video */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                Homepage Showcase Video
              </CardTitle>
              <CardDescription>
                Upload a cinematic wedding video to display on the homepage. This video will autoplay (muted) when visitors scroll to the video section.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VideoUploader
                currentVideoKey={settings.showcase_video_key || undefined}
                onUploadComplete={handleVideoUploadComplete}
                onRemove={handleVideoRemove}
              />
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
                <h4 className="font-medium text-foreground mb-1">How it works</h4>
                <p className="text-sm text-muted-foreground">
                  Changes you make here will automatically reflect across the website footer, contact page, 
                  about page, email templates, and booking confirmations. Studio identity (name & website) 
                  requires developer access to modify.
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
