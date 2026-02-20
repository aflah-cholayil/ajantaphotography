import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical } from 'lucide-react';

const ICON_OPTIONS = [
  'Camera', 'Video', 'Heart', 'Star', 'Users', 'Clock',
  'Briefcase', 'Image', 'Film', 'Award', 'Zap', 'Sun',
  'Moon', 'Sparkles', 'Gift', 'Globe', 'MapPin', 'Aperture',
];

const CATEGORY_OPTIONS = [
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'event', label: 'Event' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'other', label: 'Other' },
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

const schema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  short_description: z.string().min(1, 'Short description is required'),
  full_description: z.string().optional(),
  icon_name: z.string().min(1),
  category: z.string().min(1),
  price: z.string().optional(),
  show_price: z.boolean(),
  show_book_button: z.boolean(),
  book_button_text: z.string().min(1),
  estimated_delivery: z.string().optional(),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

interface Feature {
  id?: string;
  feature_text: string;
  display_order: number;
}

interface Service {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  full_description?: string | null;
  icon_name: string;
  category: string;
  price?: string | null;
  show_price: boolean;
  show_book_button: boolean;
  book_button_text: string;
  estimated_delivery?: string | null;
  is_active: boolean;
  display_order: number;
}

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
  onSuccess: () => void;
}

export function ServiceFormDialog({ open, onOpenChange, service, onSuccess }: ServiceFormDialogProps) {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!service;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      slug: '',
      short_description: '',
      full_description: '',
      icon_name: 'Camera',
      category: 'wedding',
      price: '',
      show_price: true,
      show_book_button: false,
      book_button_text: 'Book Now',
      estimated_delivery: '',
      is_active: true,
    },
  });

  const { watch, setValue } = form;
  const titleValue = watch('title');
  const showPrice = watch('show_price');
  const showBookButton = watch('show_book_button');

  // Auto-generate slug from title (only on create)
  useEffect(() => {
    if (!isEdit && titleValue) {
      setValue('slug', slugify(titleValue));
    }
  }, [titleValue, isEdit, setValue]);

  // Reset form when dialog opens/closes or service changes
  useEffect(() => {
    if (open) {
      if (service) {
        form.reset({
          title: service.title,
          slug: service.slug,
          short_description: service.short_description,
          full_description: service.full_description ?? '',
          icon_name: service.icon_name,
          category: service.category,
          price: service.price ?? '',
          show_price: service.show_price,
          show_book_button: service.show_book_button,
          book_button_text: service.book_button_text,
          estimated_delivery: service.estimated_delivery ?? '',
          is_active: service.is_active,
        });
        // Load existing features
        loadFeatures(service.id);
      } else {
        form.reset({
          title: '',
          slug: '',
          short_description: '',
          full_description: '',
          icon_name: 'Camera',
          category: 'wedding',
          price: '',
          show_price: true,
          show_book_button: false,
          book_button_text: 'Book Now',
          estimated_delivery: '',
          is_active: true,
        });
        setFeatures([]);
      }
    }
  }, [open, service]);

  async function loadFeatures(serviceId: string) {
    const { data } = await supabase
      .from('service_features' as any)
      .select('*')
      .eq('service_id', serviceId)
      .order('display_order');
    if (data) setFeatures(data as unknown as Feature[]);
  }

  function addFeature() {
    setFeatures(prev => [...prev, { feature_text: '', display_order: prev.length }]);
  }

  function removeFeature(index: number) {
    setFeatures(prev => prev.filter((_, i) => i !== index).map((f, i) => ({ ...f, display_order: i })));
  }

  function updateFeature(index: number, text: string) {
    setFeatures(prev => prev.map((f, i) => i === index ? { ...f, feature_text: text } : f));
  }

  function moveFeature(index: number, direction: 'up' | 'down') {
    const newFeatures = [...features];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFeatures.length) return;
    [newFeatures[index], newFeatures[targetIndex]] = [newFeatures[targetIndex], newFeatures[index]];
    setFeatures(newFeatures.map((f, i) => ({ ...f, display_order: i })));
  }

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      let serviceId = service?.id;

      const payload = {
        title: values.title,
        slug: values.slug,
        short_description: values.short_description,
        full_description: values.full_description || null,
        icon_name: values.icon_name,
        category: values.category,
        price: values.price || null,
        show_price: values.show_price,
        show_book_button: values.show_book_button,
        book_button_text: values.book_button_text,
        estimated_delivery: values.estimated_delivery || null,
        is_active: values.is_active,
      };

      if (isEdit && serviceId) {
        const { error } = await supabase
          .from('services' as any)
          .update(payload)
          .eq('id', serviceId);
        if (error) throw error;
      } else {
        // Get max display_order
        const { data: existing } = await supabase
          .from('services' as any)
          .select('display_order')
          .order('display_order', { ascending: false })
          .limit(1);
        const maxOrder = (existing as any)?.[0]?.display_order ?? -1;

        const { data, error } = await supabase
          .from('services' as any)
          .insert({ ...payload, display_order: maxOrder + 1 })
          .select('id')
          .single();
        if (error) throw error;
        serviceId = (data as any).id;
      }

      // Sync features: delete all old, insert new
      if (serviceId) {
        await supabase
          .from('service_features' as any)
          .delete()
          .eq('service_id', serviceId);

        const validFeatures = features.filter(f => f.feature_text.trim());
        if (validFeatures.length > 0) {
          const { error: featError } = await supabase
            .from('service_features' as any)
            .insert(validFeatures.map((f, i) => ({
              service_id: serviceId,
              feature_text: f.feature_text.trim(),
              display_order: i,
            })));
          if (featError) throw featError;
        }
      }

      toast.success(isEdit ? 'Service updated successfully' : 'Service created successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save service');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {isEdit ? 'Edit Service' : 'Create New Service'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Title + Slug */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title *</FormLabel>
                    <FormControl>
                      <Input placeholder="Wedding Photography" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug *</FormLabel>
                    <FormControl>
                      <Input placeholder="wedding-photography" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Icon + Category */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="icon_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ICON_OPTIONS.map(icon => (
                          <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORY_OPTIONS.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            {/* Short Description */}
            <FormField
              control={form.control}
              name="short_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Description *</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Brief description shown on the card..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Full Description */}
            <FormField
              control={form.control}
              name="full_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Description <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Detailed description..." {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Estimated Delivery */}
            <FormField
              control={form.control}
              name="estimated_delivery"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Delivery <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 4-6 weeks" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Pricing */}
            <div className="border border-border rounded-lg p-4 space-y-4">
              <h3 className="font-medium text-sm text-foreground">Pricing & CTA</h3>

              <FormField
                control={form.control}
                name="show_price"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="cursor-pointer">Show Price</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              {showPrice && (
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. From $3,500" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="show_book_button"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel className="cursor-pointer">Show Book Button</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              {showBookButton && (
                <FormField
                  control={form.control}
                  name="book_button_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Button Text</FormLabel>
                      <FormControl>
                        <Input placeholder="Book Now" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {!showPrice && !showBookButton && (
                <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  ℹ️ When both are off, the card will show "Contact for Pricing" linking to /contact
                </p>
              )}
            </div>

            {/* Active Toggle */}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <div>
                      <FormLabel>Active</FormLabel>
                      <p className="text-xs text-muted-foreground">Inactive services are hidden from the public</p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />

            {/* Feature Points */}
            <div className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-sm text-foreground">Feature Points</h3>
                <Button type="button" variant="outline" size="sm" onClick={addFeature}>
                  <Plus size={14} className="mr-1" />
                  Add Feature
                </Button>
              </div>

              {features.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  No features yet. Add bullet points to highlight what's included.
                </p>
              )}

              <div className="space-y-2">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveFeature(index, 'up')}
                        disabled={index === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveFeature(index, 'down')}
                        disabled={index === features.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 leading-none"
                      >
                        ▼
                      </button>
                    </div>
                    <GripVertical size={14} className="text-muted-foreground flex-shrink-0" />
                    <Input
                      value={feature.feature_text}
                      onChange={e => updateFeature(index, e.target.value)}
                      placeholder="e.g. Unlimited high-resolution photos"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFeature(index)}
                      className="text-destructive hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="btn-gold">
                {isSubmitting ? 'Saving...' : isEdit ? 'Update Service' : 'Create Service'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
