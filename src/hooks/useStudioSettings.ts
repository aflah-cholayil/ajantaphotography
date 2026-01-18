import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { studioConfig } from '@/config/studio';

export interface StudioSettings {
  phones: string;
  primary_phone: string;
  whatsapp: string;
  email: string;
  landline: string;
  instagram: string;
  instagram_url: string;
  facebook: string;
  facebook_url: string;
  address_line1: string;
  address_line2: string;
  pincode: string;
  google_maps_url: string;
  hours_weekdays: string;
  hours_saturday: string;
  hours_sunday: string;
  showcase_video_key: string;
  showcase_video_visible: string;
}

// Default values from static config
const defaultSettings: StudioSettings = {
  phones: studioConfig.contact.phones.join(', '),
  primary_phone: studioConfig.contact.primaryPhone,
  whatsapp: studioConfig.contact.whatsapp,
  email: studioConfig.contact.email,
  landline: studioConfig.contact.landline,
  instagram: studioConfig.social.instagram,
  instagram_url: studioConfig.social.instagramUrl,
  facebook: studioConfig.social.facebook,
  facebook_url: studioConfig.social.facebookUrl,
  address_line1: studioConfig.address.line1,
  address_line2: studioConfig.address.line2,
  pincode: studioConfig.address.pincode,
  google_maps_url: studioConfig.address.googleMapsUrl,
  hours_weekdays: studioConfig.hours.weekdays,
  hours_saturday: studioConfig.hours.saturday,
  hours_sunday: studioConfig.hours.sunday,
  showcase_video_key: '',
  showcase_video_visible: 'false',
};

export function useStudioSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['studio-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('studio_settings')
        .select('setting_key, setting_value');

      if (error) {
        console.error('Error fetching studio settings:', error);
        return defaultSettings;
      }

      if (!data || data.length === 0) {
        return defaultSettings;
      }

      // Convert array to object
      const settingsObj: Record<string, string> = {};
      data.forEach((row) => {
        settingsObj[row.setting_key] = row.setting_value;
      });

      return {
        ...defaultSettings,
        ...settingsObj,
      } as StudioSettings;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('studio_settings')
        .update({ setting_value: value })
        .eq('setting_key', key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-settings'] });
    },
  });

  const updateMultipleSettings = useMutation({
    mutationFn: async (updates: Partial<StudioSettings>) => {
      const promises = Object.entries(updates).map(([key, value]) =>
        supabase
          .from('studio_settings')
          .upsert({ setting_key: key, setting_value: value || '' }, { onConflict: 'setting_key' })
      );

      const results = await Promise.all(promises);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        console.error('Settings update errors:', errors);
        throw new Error('Failed to update some settings');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-settings'] });
    },
  });

  // Helper functions similar to studio.ts
  const formatPhoneLink = (phone: string) => {
    return `tel:${phone.replace(/\s/g, '')}`;
  };

  const formatWhatsAppLink = (message?: string) => {
    const whatsappNumber = settings?.whatsapp || defaultSettings.whatsapp;
    const baseUrl = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`;
    if (message) {
      return `${baseUrl}?text=${encodeURIComponent(message)}`;
    }
    return baseUrl;
  };

  const getPhoneArray = () => {
    const phonesStr = settings?.phones || defaultSettings.phones;
    return phonesStr.split(',').map((p) => p.trim());
  };

  const getFullAddress = () => {
    const s = settings || defaultSettings;
    return `${s.address_line1}, ${s.address_line2} – ${s.pincode}`;
  };

  return {
    settings: settings || defaultSettings,
    isLoading,
    error,
    updateSetting: updateSettingMutation.mutate,
    updateMultipleSettings: updateMultipleSettings.mutate,
    isUpdating: updateSettingMutation.isPending || updateMultipleSettings.isPending,
    formatPhoneLink,
    formatWhatsAppLink,
    getPhoneArray,
    getFullAddress,
    // Static identity info (non-editable)
    identity: {
      name: studioConfig.name,
      tagline: studioConfig.tagline,
      description: studioConfig.description,
      domain: studioConfig.domain,
      baseUrl: studioConfig.baseUrl,
      seo: studioConfig.seo,
    },
  };
}
